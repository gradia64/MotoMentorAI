import { GoogleGenAI, Chat, Content } from "@google/genai";
import { ITINERARY_SCHEMA, Itinerary, Day, MAINTENANCE_TIPS_SCHEMA, MaintenanceTips, GarageVehicle, VEHICLE_SPECS_SCHEMA, DiaryEntry, RECEIPT_SCAN_SCHEMA, ScannedReceiptData } from '../types';
import { todayLocalISO } from '../src/utils/hooks';

export const PRIMARY_MODEL = 'gemini-3.7-flash';
export const FALLBACK_MODEL = 'gemini-3.5-flash';

// Errori per cui ha senso riprovare con il modello di fallback: transitori
// (503/429/overload) o modello non disponibile (404/not found). Per gli altri
// (es. chiave non valida, safety) il fallback fallirebbe allo stesso modo.
export const isTransientGeminiError = (e: any): boolean => {
    const raw = String(e?.message || e || '');
    return /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|temporarily unavailable|overload|404|not found/i.test(raw);
};

// Gemini accetta al massimo ~20 MB di dati inline per richiesta e il base64
// aumenta la dimensione di circa un terzo: 10 MB di immagini restano nel limite.
export const MAX_AI_IMAGES_BYTES = 10 * 1024 * 1024;

export const imagesTooLargeMessage = (): string =>
    `Immagini troppo grandi: il totale non può superare ${MAX_AI_IMAGES_BYTES / (1024 * 1024)} MB.`;

const assertImagesSize = (files: (File | null | undefined)[]) => {
    const total = files.reduce((sum, f) => sum + (f?.size || 0), 0);
    if (total > MAX_AI_IMAGES_BYTES) throw new Error(imagesTooLargeMessage());
};

// Legge un File e ne restituisce il base64 (senza prefisso data URL).
const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Errore lettura del file "${file.name}".`));
    reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== 'string' || !result.includes(',')) {
            reject(new Error(`Errore lettura del file "${file.name}".`));
            return;
        }
        resolve(result.split(',')[1]);
    };
    reader.readAsDataURL(file);
});

const getApiKey = (): string => {
    let key = '';
    try {
        if (typeof process !== 'undefined' && process.env) {
            key = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.VITE_API_KEY || '';
        }
    } catch (e) {}

    if (!key) {
        try {
            const metaEnv = (import.meta as any).env;
            if (metaEnv) {
                key = metaEnv.VITE_GEMINI_API_KEY || metaEnv.VITE_API_KEY || metaEnv.GEMINI_API_KEY || metaEnv.API_KEY || '';
            }
        } catch (e) {}
    }

    if (!key && typeof window !== 'undefined') {
        key = (window as any).GEMINI_API_KEY || (window as any).API_KEY || (window as any).VITE_GEMINI_API_KEY || '';
    }

    return typeof key === 'string' ? key.trim() : '';
};

export const formatGeminiError = (e: any): string => {
    const raw = e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
    
    if (raw.includes("503") || raw.includes("high demand") || raw.includes("UNAVAILABLE") || raw.includes("temporarily unavailable")) {
        return "I server di Gemini sono momentaneamente carichi. Riprova tra qualche istante.";
    }
    if (raw.includes("API_KEY_INVALID") || raw.includes("API key not valid")) {
        return "Chiave Gemini API non valida. Verifica la chiave nelle Impostazioni dell'app.";
    }
    if (raw.includes("PERMISSION_DENIED")) {
        return "Accesso negato dall'API Gemini. Controlla le restrizioni della chiave.";
    }
    if (raw.includes("Quota exceeded") || raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED") || raw.includes("quota")) {
        return "Limite richieste raggiunto. Attendi un momento prima di riprovare.";
    }
    if (raw.includes("SAFETY") || raw.includes("blocked") || raw.includes("safety")) {
        return "La risposta è stata bloccata dai filtri di sicurezza dell'IA.";
    }
    if (raw.includes("Requested entity was not found") || raw.includes("not found")) {
        return "Modello AI non disponibile per questa chiave API.";
    }

    try {
        const match = raw.match(/"message":\s*"([^"]+)"/);
        if (match && match[1]) {
            return match[1];
        }
    } catch (_) {}

    return raw.length > 120 ? "Errore di connessione con il servizio AI." : raw;
};

const getAi = () => {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("Chiave API Gemini non configurata. Aprila dalle Impostazioni dell'app (icona chiave in alto) e riprova.");
    }
    return new GoogleGenAI({ apiKey });
};

// Pulisce la stringa rimuovendo markdown e testo superfluo prima e dopo il JSON
const cleanJsonString = (text: string): string => {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "");
    
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let start = -1;
    if (firstBrace !== -1 && firstBracket !== -1) start = Math.min(firstBrace, firstBracket);
    else start = Math.max(firstBrace, firstBracket);

    if (start > 0) cleaned = cleaned.substring(start);

    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    const end = Math.max(lastBrace, lastBracket);
    if (end !== -1 && end < cleaned.length - 1) cleaned = cleaned.substring(0, end + 1);

    return cleaned;
};

const apiProxy = async (model: string, contents: any, config?: any) => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({ model, contents, config });
        const rawText = response.text || "";
        const cleanedText = cleanJsonString(rawText);
        if (!cleanedText) throw new Error("L'IA ha restituito una risposta vuota.");
        
        try {
            return JSON.parse(cleanedText);
        } catch (parseError: any) {
            console.error("JSON Parse Error. Raw text:", rawText);
            throw new Error(`Errore di sintassi nella risposta dell'IA: ${parseError.message}`);
        }
    } catch (e: any) {
        console.error(`Gemini API Error (${model}):`, e);

        // Fallback automatico su FALLBACK_MODEL solo per errori transitori o
        // modello non disponibile (503, 429, 404, overload).
        if (model === PRIMARY_MODEL && isTransientGeminiError(e)) {
            console.warn(`Fallback da ${PRIMARY_MODEL} a ${FALLBACK_MODEL}...`);
            return await apiProxy(FALLBACK_MODEL, contents, config);
        }

        if (e.message?.includes("Requested entity was not found")) {
            throw new Error("Modello non trovato o non accessibile.");
        }
        
        throw e;
    }
};

const textApiProxy = async (model: string, contents: any, config?: any) => {
    try {
         const ai = getAi();
         const response = await ai.models.generateContent({ model, contents, config });
         return response.text || "Nessuna risposta generata.";
    } catch (e: any) {
         console.error(`Gemini Text API Error (${model}):`, e);
         if (model === PRIMARY_MODEL && isTransientGeminiError(e)) {
             console.warn(`Fallback testo da ${PRIMARY_MODEL} a ${FALLBACK_MODEL}...`);
             return await textApiProxy(FALLBACK_MODEL, contents, config);
         }
         throw e;
    }
};

const mapApiItineraryToAppItinerary = (apiResponse: any): Itinerary => {
    return {
        tripTitle: apiResponse.titolo_viaggio || "Viaggio Senza Titolo",
        generalDescription: apiResponse.descrizione_generale || "Nessuna descrizione fornita.",
        dailySchedule: (apiResponse.programma_giornaliero || []).map((day: any): Day => ({
            day: day.giorno || 0,
            stageTitle: day.titolo_tappa || "Tappa",
            routeDescription: day.descrizione_percorso || "",
            stageKilometers: day.chilometri_tappa || 0,
            activities: day.attivita_luoghi_interesse || [],
            gpxTrack: day.tracciato_gpx || [],
            weatherForecast: {
                temperatureMin: day.previsioni_meteo?.temperatura_min ?? 10,
                temperatureMax: day.previsioni_meteo?.temperatura_max ?? 20,
                conditions: day.previsioni_meteo?.condizioni || "Variabile",
                icon: day.previsioni_meteo?.icona || "cloud",
            },
            drivingTips: day.consigli_di_guida || "",
            restaurantOption: day.opzione_ristoro || "",
            accommodation: day.alloggio_consigliato || "",
            alternativeRouteSuggestion: day.suggerimento_strada_alternativa,
        }))
    };
};

export const generateItinerary = async (options: any): Promise<Itinerary> => {
    const { 
        tripType,
        departure, 
        destination, 
        returnPoint,
        selectedTour, 
        duration, 
        roadPreference, 
        customRoadPreferenceText,
        period, 
        motorcycle, 
        customPrompt,
        mapImages
    } = options;
    
    const roadPref = roadPreference === 'Percorso personalizzato' ? customRoadPreferenceText : roadPreference;
    
    const prompt = `Agisci come MotoMentor, esperto di mototurismo.
Pianifica un itinerario di ${duration} giorni ${tripType === 'tour' ? `per il tour denominato "${selectedTour}"` : `con partenza da ${departure}, destinazione/giro di boa a ${destination} e ritorno a ${returnPoint}`}.
${tripType === 'tour' ? `Punto di partenza dell'utente: ${departure}.` : ''}
Periodo: ${period}. Preferenza strade: ${roadPref}.
${motorcycle ? `Veicolo: ${motorcycle.model} (${motorcycle.year}).` : ''}
${mapImages && mapImages.length > 0 ? `L'utente ha fornito ${mapImages.length} screenshot di Google Maps con percorsi desiderati. Analizzali e integrali nell'itinerario.` : ""}
FILOSOFIA: Massima precisione geografica, strade panoramiche, tappe bilanciate.
Richieste aggiuntive: ${customPrompt || 'Nessuna'}.

REGOLE JSON: Restituisci esclusivamente l'oggetto JSON richiesto secondo ITINERARY_SCHEMA.`;

    const config = {
        responseMimeType: "application/json",
        responseSchema: ITINERARY_SCHEMA,
    };
    
    const parts: any[] = [{ text: prompt }];
    if (mapImages && mapImages.length > 0) {
        assertImagesSize(mapImages);
        for (const img of mapImages) {
            const base64Data = await fileToBase64(img);
            parts.push({ inlineData: { data: base64Data, mimeType: img.type } });
        }
    }

    const response = await apiProxy(PRIMARY_MODEL, { parts }, config);
    return mapApiItineraryToAppItinerary(response);
};

export const diagnoseProblem = async (problemDescription: string, motorcycle: GarageVehicle, image?: File): Promise<string> => {
    const prompt = `MotoMentor Meccanico: Diagnosi per ${motorcycle.model} (${motorcycle.year}), ${motorcycle.kilometers}km.
Problema: "${problemDescription}".
Esegui un'analisi tecnica dettagliata.`;
    
    const parts: any[] = [{ text: prompt }];
    if (image) {
        assertImagesSize([image]);
        const base64Data = await fileToBase64(image);
        parts.push({ inlineData: { data: base64Data, mimeType: image.type } });
    }
    return await textApiProxy(PRIMARY_MODEL, { parts });
};

export const getMaintenanceTips = async (itinerary: Itinerary, motorcycle: GarageVehicle): Promise<MaintenanceTips> => {
    const prompt = `Checklist pre-viaggio per ${motorcycle.model} destinazione ${itinerary.tripTitle}.`;
    const config = { responseMimeType: "application/json", responseSchema: MAINTENANCE_TIPS_SCHEMA };
    const response = await apiProxy(PRIMARY_MODEL, { parts: [{ text: prompt }] }, config);
    return {
        essentialChecks: response.controlli_essenziali || [],
        tripSpecificTips: response.suggerimenti_specifici_viaggio || [],
        emergencyEquipment: response.equipaggiamento_emergenza || [],
    };
};

export const generateTripDiarySummary = async (itinerary: Itinerary, entries: DiaryEntry[]): Promise<string> => {
    const diaryContent = entries.map(e => `Giorno ${e.day}: "${e.content}"`).join('\n');
    const prompt = `Scrivi il racconto epico del viaggio "${itinerary.tripTitle}" basandoti su queste note: ${diaryContent}.`;
    return await textApiProxy(PRIMARY_MODEL, { parts: [{ text: prompt }] });
};

export const getVehicleSpecs = async (model: string, year: string) => {
    const prompt = `Restituisci i dati tecnici ufficiali per la moto ${model} (${year}). Assicurati di restituire un JSON valido e che tutti i valori numerici includano l'unità di misura e siano racchiusi tra virgolette come stringhe (es. "776 cc", "84 CV").`;
    const config = { responseMimeType: "application/json", responseSchema: VEHICLE_SPECS_SCHEMA };
    const response = await apiProxy(PRIMARY_MODEL, { parts: [{ text: prompt }] }, config);
    return {
        displacement: response.cilindrata || '',
        power: response.potenza || '',
        frontTire: response.pneumatico_anteriore || '',
        rearTire: response.pneumatico_posteriore || ''
    };
};

export const createChatSession = (vehicle: GarageVehicle | null, history: Content[] = []): Chat => {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("Chiave API Gemini non configurata. Aprila dalle Impostazioni dell'app.");
    }
    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `Sei MotoMentor, l'assistente definitivo per motociclisti. ${vehicle ? `Aiuta l'utente con la sua ${vehicle.model}.` : ''}`;

    return ai.chats.create({
        model: PRIMARY_MODEL,
        config: { systemInstruction },
        history: history
    });
};

export const sendDirectChatMessage = async (
    vehicle: GarageVehicle | null,
    history: Content[],
    newMessage: string
): Promise<string> => {
    const systemInstruction = `Sei MotoMentor, l'assistente definitivo per motociclisti. ${vehicle ? `Aiuta l'utente con la sua ${vehicle.model}.` : ''}`;
    const contents: any[] = [...history, { role: 'user', parts: [{ text: newMessage }] }];
    return await textApiProxy(PRIMARY_MODEL, contents, { systemInstruction });
};

export const scanReceiptImage = async (image: File): Promise<ScannedReceiptData> => {
    const prompt = `Analizza questa immagine di uno scontrino o ricevuta di manutenzione moto. Estrai: data, descrizione sintetica dei lavori, costo totale, chilometri (se presenti) e tipo di intervento (Ordinaria, Straordinaria, Eccezionale).`;
    const config = { responseMimeType: "application/json", responseSchema: RECEIPT_SCAN_SCHEMA };
    
    assertImagesSize([image]);
    const base64Data = await fileToBase64(image);

    const response = await apiProxy(PRIMARY_MODEL, { 
        parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType: image.type } }
        ] 
    }, config);

    return {
        date: response.data || todayLocalISO(),
        description: response.descrizione || '',
        cost: response.costo || 0,
        kilometers: response.chilometri || 0,
        type: response.tipo || 'Ordinaria'
    };
};
