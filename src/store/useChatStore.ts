
import { create } from 'zustand';
import { db, auth } from '../firebase';
import { 
    collection, 
    onSnapshot, 
    doc, 
    setDoc, 
    deleteDoc 
} from 'firebase/firestore';
import { Chat, Content, GenerateContentResponse } from '@google/genai';
import { SavedChat } from '../../types';
import { useUIStore } from './useUIStore';
import { useGarageStore } from './useGarageStore';
import { createChatSession, sendDirectChatMessage } from '../../services/geminiService';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';

interface ChatState {
    savedChats: SavedChat[];
    activeChatId: string | null;
    chatSession: Chat | null;
    chatHistory: Content[];
    
    // Actions
    initChats: (userId: string) => () => void;
    sendMessage: (message: string) => Promise<boolean>;
    clearActiveChat: () => void;
    saveCurrentChat: () => Promise<void>;
    loadChatHistory: (id: string) => void;
    deleteSavedChat: (id: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
    savedChats: [],
    activeChatId: null,
    chatSession: null,
    chatHistory: [],

    initChats: (userId) => {
        const unsub = onSnapshot(collection(db, `users/${userId}/chats`), (snapshot) => {
            set({ savedChats: snapshot.docs.map(doc => doc.data().data as SavedChat) });
        });
        return unsub;
    },

    sendMessage: async (message) => {
        const { showNotification, setLoading } = useUIStore.getState();
        const { activeVehicle } = useGarageStore.getState();
        const { chatSession, chatHistory } = get();

        setLoading('isChatLoading', true);
        
        let session = chatSession;
        if (!session) {
            try {
                session = createChatSession(activeVehicle, chatHistory);
                set({ chatSession: session });
            } catch (initErr: any) {
                console.warn("Init chat session error:", initErr);
            }
        }

        const userMsg: Content = { role: 'user', parts: [{ text: message }] };
        const historyBeforeMessage = chatHistory;
        const updatedHistory = [...historyBeforeMessage, userMsg];
        set({ chatHistory: updatedHistory });

        const trySendMessage = async (attempt = 1): Promise<boolean> => {
            try {
                if (!session) {
                    session = createChatSession(activeVehicle, historyBeforeMessage);
                    set({ chatSession: session });
                }

                if (session) {
                    const streamResponse = await session.sendMessageStream({ message });
                    let fullText = "";
                    for await (const chunk of streamResponse) {
                        const c = chunk as GenerateContentResponse;
                        fullText += c.text || "";
                        set({ chatHistory: [...updatedHistory, { role: 'model', parts: [{ text: fullText }] }] });
                    }
                    return true;
                }
                throw new Error("Sessione chat non disponibile.");
            } catch (err: any) {
                console.warn(`Chat attempt ${attempt} stream failed:`, err);
                
                // Fallback trasparente: chiamata diretta standard
                try {
                    const directResponse = await sendDirectChatMessage(activeVehicle, historyBeforeMessage, message);
                    if (directResponse) {
                        set({ chatHistory: [...updatedHistory, { role: 'model', parts: [{ text: directResponse }] }] });
                        return true;
                    }
                } catch (directErr: any) {
                    console.error("Direct fallback failed:", directErr);
                }

                const isTransient = err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED") || err.message?.includes("fetch");
                if (isTransient && attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, attempt * 1500));
                    session = null;
                    return await trySendMessage(attempt + 1);
                }
                
                const errorMsg = err.message?.includes("safety") 
                    ? "Bloccato dai filtri di sicurezza." 
                    : (err.message || "Errore connessione chat.");
                showNotification(errorMsg, "error");
                set({ chatHistory: historyBeforeMessage, chatSession: null });
                return false;
            }
        };

        const success = await trySendMessage();
        setLoading('isChatLoading', false);
        return success;
    },

    clearActiveChat: () => set({ chatHistory: [], chatSession: null, activeChatId: null }),

    saveCurrentChat: async () => {
        const { chatHistory, activeChatId, savedChats } = get();
        const { showNotification } = useUIStore.getState();
        const { activeVehicle } = useGarageStore.getState();
        const userId = auth.currentUser?.uid;
        if (chatHistory.length === 0 || !userId) return;

        if (activeChatId) {
            const existing = savedChats.find(c => c.id === activeChatId);
            if (existing) {
                const updatedChat = { ...existing, history: [...chatHistory], timestamp: new Date().toISOString() };
                try {
                    await setDoc(doc(db, `users/${userId}/chats`, updatedChat.id), { id: updatedChat.id, userId, data: updatedChat });
                    showNotification("Conversazione aggiornata.");
                } catch (e: any) {
                    handleFirestoreError(e, OperationType.WRITE, `users/${userId}/chats/${updatedChat.id}`);
                }
            }
        } else {
            const newId = crypto.randomUUID();
            const newChat: SavedChat = {
                id: newId,
                vehicleName: activeVehicle?.model || "Generica",
                timestamp: new Date().toISOString(),
                history: [...chatHistory]
            };
            try {
                await setDoc(doc(db, `users/${userId}/chats`, newId), { id: newId, userId, data: newChat });
                set({ activeChatId: newId });
                showNotification("Conversazione salvata.");
            } catch (e: any) {
                handleFirestoreError(e, OperationType.WRITE, `users/${userId}/chats/${newId}`);
            }
        }
    },

    loadChatHistory: (id) => {
        const chat = get().savedChats.find(c => c.id === id);
        if (chat) {
            set({ chatHistory: chat.history, chatSession: null, activeChatId: chat.id });
        }
    },

    deleteSavedChat: async (id) => {
        const { showNotification } = useUIStore.getState();
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        try {
            await deleteDoc(doc(db, `users/${userId}/chats`, id));
            if (get().activeChatId === id) set({ activeChatId: null });
            showNotification("Conversazione eliminata.");
        } catch (e: any) {
            handleFirestoreError(e, OperationType.DELETE, `users/${userId}/chats/${id}`);
        }
    }
}));
