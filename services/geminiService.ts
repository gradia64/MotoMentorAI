
import { GoogleGenAI, Part, Chat, Type } from "@google/genai";
import { ITINERARY_SCHEMA, Itinerary, Day, MAINTENANCE_TIPS_SCHEMA, MaintenanceTips, GarageVehicle, MaintenanceRecord, VEHICLE_SPECS_SCHEMA, DiaryEntry } from '../types';

const getAi = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY non configurata.");
    return new GoogleGenAI({ apiKey });
};

const apiProxy = async (model: string, contents: any, config: any) => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({ model, contents, config });
        return JSON.parse((response.text || "").trim());
    } catch (e: any) {
        console.error("API Proxy Error:", e);
        throw new Error("Errore durante la comunicazione con l'IA.");
    }
};

const textApiProxy = async (model: string, contents: any, config?: any) => {
    try {
         const ai = getAi();
         const response = await ai.models.generateContent({ model, contents, config });
         return response.text || "Nessuna risposta generata.";
    } catch (e: any) {
         throw new Error("Errore nella generazione del testo.");
    }
};

const mapApiItineraryToAppItinerary = (apiResponse: any): Itinerary => {
    return {
        tripTitle: apiResponse.titolo_viaggio,
        generalDescription: apiResponse.descrizione_generale,
        dailySchedule: apiResponse.programma_giornaliero.map((day: any): Day => ({
            day: day.giorno,
            stageTitle: day.titolo_tappa,
            routeDescription: day.descrizione_percorso,
            stageKilometers: day.chilometri_tappa,
            activities: day.attivita_luoghi_interesse,
            gpxTrack: day.tracciato_gpx,
            weatherForecast: {
                temperatureMin: day.previsioni_meteo.temperatura_min,
                temperatureMax: day.previsioni_meteo.temperatura_max,
                conditions: day.previsioni_meteo.condizioni,
                icon: day.previsioni_meteo.icona,
            },
            drivingTips: day.consigli_di_guida,
            restaurantOption: day.opzione_ristoro,
            accommodation: day.alloggio_consigliato,
            alternativeRouteSuggestion: day.suggerimento_strada_alternativa,
        }))
    };
};

export const generateItinerary = async (options: any): Promise<Itinerary> => {
    const { departure, destination, tourName, duration, roadPreference, period, motorcycle, customPrompt } = options;
    const prompt = `Sei MotoMentor, il miglior pianificatore di viaggi avventura al mondo. 
Crea un itinerario di ${duration} giorni ${tourName ? `per il tour "${tourName}"` : `da ${departure} a ${destination}`}.
Periodo: ${period}. Strade: ${roadPreference}. 
${motorcycle ? `Mezzo: ${motorcycle.model} (${motorcycle.year}).` : ''}
FILOSOFIA: Solo curve, borghi e passi. No autostrade. Extra: ${customPrompt || 'Nessuna'}.`;

    const config = {
        responseMimeType: "application/json",
        responseSchema: ITINERARY_SCHEMA,
        thinkingConfig: { thinkingBudget: 16000 }
    };
    const response = await apiProxy('gemini-3-pro-preview', { parts: [{ text: prompt }] }, config);
    return mapApiItineraryToAppItinerary(response);
};

export const diagnoseProblem = async (problemDescription: string, motorcycle: GarageVehicle, image?: File): Promise<string> => {
    const prompt = `Sei il Capo Meccanico MotoMentor. Diagnostica: ${motorcycle.model} (${motorcycle.year}), ${motorcycle.kilometers}km.
Problema: "${problemDescription}".
Analizza tecnicamente: circuiti, componenti e usura. Sii rigoroso e professionale.`;
    
    const parts: any[] = [{ text: prompt }];
    if (image) {
        const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(image);
        });
        parts.push({ inlineData: { data: base64Data, mimeType: image.type } });
    }
    return await textApiProxy('gemini-3-pro-preview', { parts }, { 
        thinkingConfig: { thinkingBudget: 24576 }
    });
};

export const getMaintenanceTips = async (itinerary: Itinerary, motorcycle: GarageVehicle): Promise<MaintenanceTips> => {
    const prompt = `Capo Officina MotoMentor: Checklist pre-partenza per "${itinerary.tripTitle}" con ${motorcycle.model}.
Considera il chilometraggio previsto e il tipo di viaggio.`;
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
    const prompt = `Racconta il viaggio "${itinerary.tripTitle}" come un'epica avventura motociclistica basandoti su: ${diaryContent}.`;
    return await textApiProxy('gemini-3-flash-preview', { parts: [{ text: prompt }] });
};

export const getVehicleSpecs = async (model: string, year: string) => {
    const prompt = `Specifiche tecniche ufficiali per ${model} (${year}).`;
    const config = { responseMimeType: "application/json", responseSchema: VEHICLE_SPECS_SCHEMA };
    return await apiProxy('gemini-3-flash-preview', { parts: [{ text: prompt }] }, config);
};

export const createChatSession = (vehicle: GarageVehicle | null): Chat => {
    const ai = getAi();
    const systemInstruction = `Sei MotoMentor, l'assistente definitivo per motociclisti. Unisci la competenza di un ingegnere meccanico e l'anima di un viaggiatore solitario. 
Parla in modo diretto, tecnico ma coinvolgente. ${vehicle ? `Aiuta l'utente con la sua ${vehicle.model}.` : ''}`;

    return ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: { systemInstruction },
    });
};
