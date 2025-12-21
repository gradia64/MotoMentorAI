
import { GoogleGenAI, Part, Chat } from "@google/genai";
import { ITINERARY_SCHEMA, Itinerary, Day, MAINTENANCE_TIPS_SCHEMA, MaintenanceTips, GarageVehicle, MaintenanceRecord, VEHICLE_SPECS_SCHEMA, DiaryEntry } from '../types';

// --- SECURITY WARNING & PROXY ARCHITECTURE ---
// In a production app, the API key must NEVER be exposed in the frontend.
// This service simulates a backend proxy. All API calls from the app
// must go through this service. In a real-world scenario, this file's logic
// would be on a secure server (e.g., a Node.js endpoint).
const apiKey = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
const getAi = () => {
    if (!ai) {
        if (!apiKey) {
            console.error("API_KEY environment variable not set.");
            throw new Error("La chiave API non è configurata. L'applicazione non può funzionare.");
        }
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
};


// --- API PROXY SIMULATOR ---
// Centralizes API calls and error handling.
const apiProxy = async (model: string, contents: { parts: Part[] | string }, config: any) => {
    try {
        const response = await getAi().models.generateContent({ model, contents, config });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (e: any) {
        console.error("API Proxy Error:", e);
        if (e.message.includes("API key not valid")) {
             throw new Error("La chiave API fornita non è valida. Controlla la tua configurazione.");
        }
        if (e instanceof SyntaxError) {
             throw new Error("La risposta del server non è un formato JSON valido. L'IA potrebbe aver restituito un formato inaspettato.");
        }
        throw new Error("Si è verificato un errore durante la comunicazione con il servizio AI.");
    }
};

const textApiProxy = async (model: string, contents: { parts: Part[] | string }, config?: any) => {
    try {
         const response = await getAi().models.generateContent({ model, contents, config });
         return response.text;
    } catch (e: any) {
         console.error("Text API Proxy Error:", e);
         throw new Error("Si è verificato un errore durante la generazione del testo da parte dell'IA.");
    }
};


// --- Mappers ---
const mapApiItineraryToAppItinerary = (apiResponse: any): Itinerary => {
    if (!apiResponse || !apiResponse.programma_giornaliero || !Array.isArray(apiResponse.programma_giornaliero)) {
        console.error("Invalid itinerary response from API:", apiResponse);
        throw new Error("La risposta dell'IA non è nel formato atteso.");
    }

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

const mapApiMaintenanceTipsToApp = (apiResponse: any): MaintenanceTips => {
    if (!apiResponse || !apiResponse.controlli_essenziali || !apiResponse.suggerimenti_specifici_viaggio || !apiResponse.equipaggiamento_emergenza) {
        throw new Error("La checklist di manutenzione restituita dall'IA non è nel formato atteso.");
    }
    return {
        essentialChecks: apiResponse.controlli_essenziali,
        tripSpecificTips: apiResponse.suggerimenti_specifici_viaggio,
        emergencyEquipment: apiResponse.equipaggiamento_emergenza,
    };
};

const mapApiSpecsToApp = (apiResponse: any) => {
     return {
        displacement: apiResponse.cilindrata,
        power: apiResponse.potenza,
        frontTire: apiResponse.pneumatico_anteriore,
        rearTire: apiResponse.pneumatico_posteriore,
     };
};


// --- PROMPT BUILDERS ---

interface ItineraryOptions {
    departure?: string;
    destination?: string;
    tourName?: string;
    duration: string;
    roadPreference: string;
    period: string;
    motorcycle?: GarageVehicle;
    customPrompt?: string;
}

const buildItineraryPrompt = (options: ItineraryOptions): string => {
    const { departure, destination, tourName, duration, roadPreference, period, motorcycle, customPrompt } = options;
    
    const motorcycleInfo = motorcycle?.model
        ? `Veicolo: ${motorcycle.model} (${motorcycle.year}), ${motorcycle.kilometers} km. Adatta l'itinerario a questo tipo di moto.`
        : '';
    
    const periodInfo = period ? `Periodo: ${period}.` : '';
        
    const extraFieldsPrompt = `- Per ogni giorno: \`consigli_di_guida\`, \`opzione_ristoro\`, \`alloggio_consigliato\`.`;

    const motorcycleRoutingPhilosophy = `- **FILOSOFIA MOTOTURISMO**: Massimizza curve e panorami. Evita autostrade e centri urbani se non indispensabili.`;
    
    const customPromptInfo = customPrompt?.trim() ? `- **RICHIESTA UTENTE**: "${customPrompt}".` : '';
        
    if (tourName) {
         return `Crea itinerario moto di ${duration} giorni per il tour "${tourName}" partendo da ${departure}.
- ${periodInfo}
- Preferenza strade: ${roadPreference}.
- ${motorcycleRoutingPhilosophy}
- Includi tracciato GPX realistico e meteo.
- ${extraFieldsPrompt}
- ${motorcycleInfo}
- ${customPromptInfo}
Rispondi esclusivamente in JSON.`;
    }
    return `Crea itinerario moto di ${duration} giorni da ${departure} a ${destination}.
- ${periodInfo}
- Preferenza strade: ${roadPreference}.
- ${motorcycleRoutingPhilosophy}
- Includi tracciato GPX realistico e meteo.
- ${extraFieldsPrompt}
- ${motorcycleInfo}
- ${customPromptInfo}
Rispondi esclusivamente in JSON.`;
};

const buildDiagnosisPrompt = (problemDescription: string, motorcycle: GarageVehicle): string => {
    return `Agisci come meccanico esperto. Diagnostica il problema per una ${motorcycle.model} (${motorcycle.year}) con ${motorcycle.kilometers} km.
Problema: "${problemDescription}".
Analizza basandoti su dati tecnici ufficiali e intervalli di manutenzione. Fornisci cause probabili e passi per la verifica.`;
};

const buildMaintenanceTipsPrompt = (motorcycle: GarageVehicle, itinerary: Itinerary, maintenanceLog: MaintenanceRecord[]): string => {
    const totalTripKm = itinerary.dailySchedule.reduce((total, day) => total + day.stageKilometers, 0);
    const maintenanceHistoryString = maintenanceLog.map(record => `- ${record.date}, ${record.kilometers}km: ${record.description}`).join('\n');

    return `Prepara checklist pre-viaggio per ${motorcycle.model} (${motorcycle.year}, ${motorcycle.kilometers}km).
Viaggio: "${itinerary.tripTitle}", circa ${Math.round(totalTripKm)} km.
Storico Manutenzione:
${maintenanceHistoryString}
Considera km attuali e km del viaggio. Rispondi esclusivamente in JSON.`;
};

const buildTripDiarySummaryPrompt = (itinerary: Itinerary, entries: DiaryEntry[]): string => {
    const diaryContent = entries.map(e => `Giorno ${e.day}: "${e.content}"`).join('\n');
    return `Scrivi un diario narrativo per il viaggio "${itinerary.tripTitle}".
Note dell'utente:
${diaryContent}
Usa uno stile coinvolgente in prima persona. Formattazione Markdown.`;
};


// --- SERVICE FUNCTIONS ---

const fileToGenerativePart = async (file: File): Promise<Part> => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

export const generateItinerary = async (options: ItineraryOptions): Promise<Itinerary> => {
    const prompt = buildItineraryPrompt(options);
    const config = {
        responseMimeType: "application/json",
        responseSchema: ITINERARY_SCHEMA,
        thinkingConfig: { thinkingBudget: 16000 } // Expert planning reasoning
    };
    const apiResponse = await apiProxy('gemini-3-pro-preview', { parts: [{ text: prompt }] }, config);
    return mapApiItineraryToAppItinerary(apiResponse);
};

export const diagnoseProblem = async (
  problemDescription: string,
  motorcycle: GarageVehicle,
  image?: File
): Promise<string> => {
    const prompt = buildDiagnosisPrompt(problemDescription, motorcycle);
    const parts: Part[] = [{ text: prompt }];
    if (image) {
        const imagePart = await fileToGenerativePart(image);
        parts.push(imagePart);
    }
    const config = {
        thinkingConfig: { thinkingBudget: 16000 } // Deep mechanical diagnosis
    };
    return await textApiProxy('gemini-3-pro-preview', { parts }, config);
};

export const getMaintenanceTips = async (
    motorcycle: GarageVehicle,
    itinerary: Itinerary,
    maintenanceLog: MaintenanceRecord[]
): Promise<MaintenanceTips> => {
    const prompt = buildMaintenanceTipsPrompt(motorcycle, itinerary, maintenanceLog);
    const config = {
        responseMimeType: "application/json",
        responseSchema: MAINTENANCE_TIPS_SCHEMA,
    };
    const apiResponse = await apiProxy('gemini-3-pro-preview', { parts: [{ text: prompt }] }, config);
    return mapApiMaintenanceTipsToApp(apiResponse);
};

export const generateTripDiarySummary = async (itinerary: Itinerary, entries: DiaryEntry[]): Promise<string> => {
    const prompt = buildTripDiarySummaryPrompt(itinerary, entries);
    return await textApiProxy('gemini-3-flash-preview', { parts: [{ text: prompt }] });
};

export const getVehicleSpecs = async (model: string, year: string) => {
    const prompt = `Fornisci dati tecnici per ${model} (${year}): cilindrata, potenza, pneumatici.`;
    const config = {
        responseMimeType: "application/json",
        responseSchema: VEHICLE_SPECS_SCHEMA,
    };
    const apiResponse = await apiProxy('gemini-3-flash-preview', { parts: [{ text: prompt }] }, config);
    return mapApiSpecsToApp(apiResponse);
};

export const createChatSession = (vehicle: GarageVehicle | null): Chat => {
    const systemInstruction = `Sei MotoMentor, esperto meccanico e motoviaggiatore. ${vehicle ? `Parli con il proprietario di una ${vehicle.model} (${vehicle.year}).` : ''} Rispondi in modo competente e cordiale.`;

    const chat: Chat = getAi().chats.create({
        model: 'gemini-3-flash-preview',
        config: {
            systemInstruction: systemInstruction,
        },
    });
    return chat;
};
