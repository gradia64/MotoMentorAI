
import { GoogleGenAI, Chat, Content } from "@google/genai";
import { ITINERARY_SCHEMA, Itinerary, Day, MAINTENANCE_TIPS_SCHEMA, MaintenanceTips, GarageVehicle, VEHICLE_SPECS_SCHEMA, DiaryEntry } from '../types';

const getAi = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY non configurata nel sistema.");
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

const apiProxy = async (model: string, contents: any, config: any) => {
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

        // Se l'errore è 429 (Quota esaurita) e stiamo usando il Pro, tentiamo il fallback sul Flash
        if ((e.message?.includes("429") || e.message?.includes("RESOURCE_EXHAUSTED")) && model === 'gemini-3.1-pro-preview') {
            console.warn("Quota Pro esaurita, tentativo di fallback su Gemini 3.1 Flash...");
            return await apiProxy('gemini-3-flash-preview', contents, config);
        }

        if (e.message?.includes("Requested entity was not found")) {
            throw new Error("Modello non trovato o non accessibile.");
        }
        
        if (e.message?.includes("429") || e.message?.includes("RESOURCE_EXHAUSTED")) {
            throw new Error("Limite di richieste raggiunto. Attendi un minuto o seleziona una chiave API 'Paid' se disponibile.");
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
         if ((e.message?.includes("429") || e.message?.includes("RESOURCE_EXHAUSTED")) && model === 'gemini-3.1-pro-preview') {
            return await textApiProxy('gemini-3-flash-preview', contents, config);
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
Pianifica un itinerario di ${duration} giorni ${tripType === 'tour' ? `per il tour denominato "${selectedTour}"` : `da ${departure} a ${destination}`}.
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
        for (const img of mapImages) {
            const base64Data = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.readAsDataURL(img);
            });
            parts.push({ inlineData: { data: base64Data, mimeType: img.type } });
        }
    }

    // Tenta prima con il modello Pro, apiProxy gestirà il fallback a Flash in caso di errore 429
    const response = await apiProxy('gemini-3.1-pro-preview', { parts }, config);
    return mapApiItineraryToAppItinerary(response);
};

export const diagnoseProblem = async (problemDescription: string, motorcycle: GarageVehicle, image?: File): Promise<string> => {
    const prompt = `MotoMentor Meccanico: Diagnosi per ${motorcycle.model} (${motorcycle.year}), ${motorcycle.kilometers}km.
Problema: "${problemDescription}".
Esegui un'analisi tecnica dettagliata.`;
    
    const parts: any[] = [{ text: prompt }];
    if (image) {
        const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(image);
        });
        parts.push({ inlineData: { data: base64Data, mimeType: image.type } });
    }
    return await textApiProxy('gemini-3.1-pro-preview', { parts });
};

export const getMaintenanceTips = async (itinerary: Itinerary, motorcycle: GarageVehicle): Promise<MaintenanceTips> => {
    const prompt = `Checklist pre-viaggio per ${motorcycle.model} destinazione ${itinerary.tripTitle}.`;
    const config = { responseMimeType: "application/json", responseSchema: MAINTENANCE_TIPS_SCHEMA };
    const response = await apiProxy('gemini-3-flash-preview', { parts: [{ text: prompt }] }, config);
    return {
        essentialChecks: response.controlli_essenziali || [],
        tripSpecificTips: response.suggerimenti_specifici_viaggio || [],
        emergencyEquipment: response.equipaggiamento_emergenza || [],
    };
};

export const generateTripDiarySummary = async (itinerary: Itinerary, entries: DiaryEntry[]): Promise<string> => {
    const diaryContent = entries.map(e => `Giorno ${e.day}: "${e.content}"`).join('\n');
    const prompt = `Scrivi il racconto epico del viaggio "${itinerary.tripTitle}" basandoti su queste note: ${diaryContent}.`;
    return await textApiProxy('gemini-3-flash-preview', { parts: [{ text: prompt }] });
};

export const getVehicleSpecs = async (model: string, year: string) => {
    const prompt = `Restituisci i dati tecnici ufficiali per la moto ${model} (${year}). Assicurati di restituire un JSON valido e che tutti i valori numerici includano l'unità di misura e siano racchiusi tra virgolette come stringhe (es. "776 cc", "84 CV").`;
    const config = { responseMimeType: "application/json", responseSchema: VEHICLE_SPECS_SCHEMA };
    const response = await apiProxy('gemini-3-flash-preview', { parts: [{ text: prompt }] }, config);
    return {
        displacement: response.cilindrata || '',
        power: response.potenza || '',
        frontTire: response.pneumatico_anteriore || '',
        rearTire: response.pneumatico_posteriore || ''
    };
};

export const createChatSession = (vehicle: GarageVehicle | null, history: Content[] = []): Chat => {
    const apiKey = process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `Sei MotoMentor, l'assistente definitivo per motociclisti. ${vehicle ? `Aiuta l'utente con la sua ${vehicle.model}.` : ''}`;

    return ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: { systemInstruction },
        history: history
    });
};
