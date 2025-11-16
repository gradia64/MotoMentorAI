import { GoogleGenAI, Part, Chat } from "@google/genai";
import { ITINERARY_SCHEMA, Itinerary, Day, MAINTENANCE_TIPS_SCHEMA, MaintenanceTips, GarageVehicle, MaintenanceRecord } from '../types';

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
const apiProxy = async (model: string, contents: { parts: Part[] }, config: any) => {
    try {
        const response = await getAi().models.generateContent({ model, contents, config });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (e: any) {
        console.error("API Proxy Error:", e);
        // Provide more specific feedback if possible
        if (e.message.includes("API key not valid")) {
             throw new Error("La chiave API fornita non è valida. Controlla la tua configurazione.");
        }
        if (e instanceof SyntaxError) {
             throw new Error("La risposta del server non è un formato JSON valido. L'IA potrebbe aver restituito un formato inaspettato.");
        }
        throw new Error("Si è verificato un errore durante la comunicazione con il servizio AI.");
    }
};

const textApiProxy = async (model: string, contents: { parts: Part[] }) => {
    try {
         const response = await getAi().models.generateContent({ model, contents });
         return response.text;
    } catch (e: any) {
         console.error("Text API Proxy Error:", e);
         throw new Error("Si è verificato un errore durante la generazione del testo da parte dell'IA.");
    }
};


// --- Mappers ---
// This mapper function translates the Italian snake_case keys from the Gemini API response
// into the English camelCase keys used throughout the MotoMentor application.
// This provides a clean separation between the AI's output structure and the app's internal data model.
const mapApiItineraryToAppItinerary = (apiResponse: any): Itinerary => {
    if (!apiResponse || !apiResponse.programma_giornaliero || !Array.isArray(apiResponse.programma_giornaliero)) {
        // Handle cases where the API response is not as expected.
        console.error("Invalid itinerary response from API, 'programma_giornaliero' is missing or not an array:", apiResponse);
        throw new Error("La risposta dell'IA non è nel formato atteso e non può essere elaborata.");
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
            gpxTrack: day.tracciato_gpx, // Already in the correct format {lat, lon}
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
        console.error("Invalid maintenance tips response from API:", apiResponse);
        throw new Error("La checklist di manutenzione restituita dall'IA non è nel formato atteso.");
    }
    return {
        essentialChecks: apiResponse.controlli_essenziali,
        tripSpecificTips: apiResponse.suggerimenti_specifici_viaggio,
        emergencyEquipment: apiResponse.equipaggiamento_emergenza,
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
        ? `Il viaggio sarà affrontato con una ${motorcycle.model} dell'anno ${motorcycle.year} con circa ${motorcycle.kilometers} km. Tieni conto del tipo di moto (es. tourer, sportiva, adventure) e del suo chilometraggio per suggerire percorsi adatti.`
        : '';
    
    const periodInfo = period ? `Il viaggio si svolgerà nel periodo: ${period}. Usa questa informazione per rendere le previsioni meteo più accurate e pertinenti, tenendo conto della stagionalità.` : '';
        
    const extraFieldsPrompt = `- Per ogni giorno, includi anche: un \`consigli_di_guida\` (un consiglio di guida specifico per la tappa, es. 'attenzione al vento laterale sui viadotti'), una \`opzione_ristoro\` (un suggerimento per pranzare, es. 'Trattoria con cucina locale a metà percorso'), e un \`alloggio_consigliato\` (un suggerimento per il pernottamento, es. 'Hotel con parcheggio moto coperto').`;

    const motorcycleRoutingPhilosophy = `- **FILOSOFIA DEL PERCORSO MOTOCICLISTICO**: Questo è il punto più importante. La pianificazione deve essere fatta con la mentalità di un motociclista esperto che cerca il massimo piacere di guida.
  - **EVITA ASSOLUTAMENTE**: Centri urbani trafficati, zone industriali, tangenziali congestionate e autostrade/superstrade monotone, a meno che non siano l'unica opzione praticabile per un breve collegamento. L'obiettivo è massimizzare il tempo su strade godibili.
  - **DAI LA MASSIMA PRIORITÀ A**: Strade secondarie ben tenute, percorsi collinari o montani con belle curve, strade costiere panoramiche e strade rurali che attraversano paesaggi interessanti. La strada stessa è parte della destinazione.
  - Anche le tappe di trasferimento (andata/ritorno) devono seguire questa filosofia, cercando il miglior compromesso tra efficienza e piacere di guida, aggirando sempre i grandi centri urbani.
  - **SUGGERIMENTI ALTERNATIVI**: Per ogni tappa, se possibile, proponi un \`suggerimento_strada_alternativa\`. Questa deve essere una deviazione o un'alternativa a una parte del percorso principale, pensata specificamente per il tipo di moto e le preferenze di guida. Ad esempio: se la moto è una tourer e la preferenza è 'panoramica', l'alternativa potrebbe essere un passo di montagna meno conosciuto ma spettacolare. Se la moto è una adventure e l'utente ha scelto 'mix avventura', l'alternativa potrebbe essere una 'strada bianca' (strada sterrata facile) che corre parallela all'asfalto. Se il percorso principale è veloce, l'alternativa potrebbe essere più lenta ma più ricca di curve. Sii creativo, specifico e pertinente. Se non ci sono buone alternative, lascia il campo vuoto.`;
    
    const customPromptInfo = customPrompt?.trim()
        ? `- **RICHIESTA SPECIFICA DELL'UTENTE**: L'utente ha fatto una richiesta speciale che deve essere assolutamente soddisfatta: "${customPrompt}". Integra questa richiesta in modo coerente nel piano di viaggio.`
        : '';
        
    if (tourName) {
         return `Crea un itinerario dettagliato per un viaggio in moto della durata totale di ${duration} giorni.
Il viaggio consiste in:
1. Un viaggio di andata dal luogo di partenza: ${departure}.
2. La partecipazione a un tour organizzato in ${tourName}.
3. Un viaggio di ritorno al luogo di partenza: ${departure}.

Distribuisci l'intero percorso (andata, tour e ritorno) in modo equilibrato nei ${duration} giorni totali.
- ${periodInfo}
- Preferenza sul tipo di strade: ${roadPreference}.
- ${motorcycleRoutingPhilosophy}
- Il cuore del viaggio è il ${tourName}, che deve esplorare le zone più belle e le strade più adatte alle moto della regione.
- Le tappe di andata e ritorno devono essere percorsi efficienti ma piacevoli per raggiungere e lasciare l'area del tour.
- Per il viaggio di ritorno, quando possibile, pianifica un percorso diverso da quello dell'andata per rendere l'esperienza più varia e interessante.
- Per ogni giorno (sia di trasferimento che di tour), fornisci un titolo, una descrizione del percorso che includa i luoghi più belli da visitare, i chilometri totali della tappa, un elenco di attività o luoghi di interesse, un tracciato GPX e una previsione meteo realistica basata sulla località e il periodo dell'anno (temperatura min/max in Celsius, condizioni e una parola chiave per un'icona: scegli tra 'sun', 'moon', 'partly-cloudy-day', 'partly-cloudy-night', 'cloud', 'rain', 'storm', 'snow', 'fog', 'wind').
- Nella 'descrizione_percorso' di ogni giorno, inizia con una breve frase che descriva il tipo di strada per quella tappa, riflettendo direttamente la preferenza '${roadPreference}' scelta (es. 'Il percorso di oggi si snoderà su strade panoramiche e tortuose...' o 'Questa tappa prevede un trasferimento veloce su superstrade...').
- ${extraFieldsPrompt}
- ${motorcycleInfo}
- ${customPromptInfo}
Fornisci la risposta esclusivamente in formato JSON.`;
    }
    return `Crea un itinerario dettagliato per un viaggio in moto di ${duration} giorni.
- Luogo di partenza: ${departure}.
- Destinazione principale: ${destination}.
- ${periodInfo}
- Il viaggio deve includere sia l'andata che il ritorno, distribuendo le tappe in modo equilibrato nei ${duration} giorni totali.
- Per il viaggio di ritorno, quando possibile, pianifica un percorso diverso da quello dell'andata per rendere l'esperienza più varia e interessante.
- Preferenza sul tipo di strade: ${roadPreference}.
- ${motorcycleRoutingPhilosophy}
- Per ogni giorno, fornisci un titolo, una descrizione del percorso, i chilometri totali della tappa, un elenco di attività o luoghi di interesse, un tracciato GPX e una previsione meteo realistica basata sulla località e il periodo dell'anno (temperatura min/max in Celsius, condizioni e una parola chiave per un'icona: scegli tra 'sun', 'moon', 'partly-cloudy-day', 'partly-cloudy-night', 'cloud', 'rain', 'storm', 'snow', 'fog', 'wind').
- Nella 'descrizione_percorso' di ogni giorno, inizia con una breve frase che descriva il tipo di strada per quella tappa, riflettendo direttamente la preferenza '${roadPreference}' scelta (es. 'Il percorso di oggi si snoderà su strade panoramiche e tortuose...' o 'Questa tappa prevede un trasferimento veloce su superstrade...').
- ${extraFieldsPrompt}
- ${motorcycleInfo}
- ${customPromptInfo}
Fornisci la risposta esclusivamente in formato JSON.`;
};

const buildDiagnosisPrompt = (problemDescription: string, motorcycle: GarageVehicle): string => {
    return `Agisci come un meccanico di moto professionista altamente qualificato.
La tua analisi deve essere basata sulle informazioni ufficiali dei manuali di officina e manutenzione specifici per il modello e l'anno della moto.
Un utente ha un problema con la sua ${motorcycle.model} del ${motorcycle.year} con circa ${motorcycle.kilometers} km.
Descrizione del problema: "${problemDescription}".
Il chilometraggio è un fattore cruciale, usalo per la diagnosi, confrontandolo con gli intervalli di manutenzione previsti dal costruttore.
Fornisci una diagnosi probabile, una lista di possibili cause in ordine di probabilità (dalla più alla meno probabile) e suggerisci dei passaggi dettagliati per verificare il problema o risolverlo, se alla portata di un utente con competenze meccaniche di base. Specifica quando è invece strettamente necessario l'intervento di un'officina specializzata. Se c'è un'immagine, usala per affinare la diagnosi.`;
};

const buildMaintenanceTipsPrompt = (motorcycle: GarageVehicle, itinerary: Itinerary, maintenanceLog: MaintenanceRecord[]): string => {
    const totalTripKm = itinerary.dailySchedule.reduce((total, day) => total + day.stageKilometers, 0);
    
    const maintenanceHistoryString = maintenanceLog.length > 0
    ? maintenanceLog
        .map(record => `- Data: ${new Date(record.date).toLocaleDateString('it-IT')}, Km: ${record.kilometers.toLocaleString('it-IT')}, Lavoro: ${record.description}`)
        .join('\n')
    : "Nessuno storico di manutenzione registrato.";

    return `Agisci come un meccanico di moto esperto e meticoloso.
Prepara una checklist di manutenzione pre-viaggio per una ${motorcycle.model} del ${motorcycle.year} che ha attualmente ${motorcycle.kilometers} km.
Il viaggio pianificato è: "${itinerary.tripTitle}" della durata di ${itinerary.dailySchedule.length} giorni, per un totale di circa ${Math.round(totalTripKm)} km.
Descrizione del viaggio: "${itinerary.generalDescription}".

**Storico Manutenzione del Veicolo:**
Analizza attentamente il seguente storico dei lavori eseguiti per fornire consigli ancora più pertinenti. Confronta i chilometraggi e le date degli interventi con i km attuali della moto e la distanza/periodo del viaggio imminente.
${maintenanceHistoryString}

Considerando il chilometraggio attuale della moto, lo storico degli interventi, e i chilometri che verranno aggiunti con il viaggio, fornisci:
1.  Una lista di controlli essenziali da fare prima di partire. Presta particolare attenzione a componenti che potrebbero essere vicini alla fine del loro ciclo vita (es. gomme, trasmissione, pastiglie freni), tenendo conto di quando sono stati controllati o sostituiti l'ultima volta secondo lo storico. Ad esempio, se l'olio è stato cambiato da poco, non suggerire di cambiarlo di nuovo a meno che il viaggio non sia eccezionalmente lungo. Sii specifico e intelligente.
2.  Una lista di suggerimenti specifici legati a questo particolare viaggio (es. tipo di strade, clima previsto, durata), personalizzati in base allo storico.
3.  Una lista di equipaggiamento d'emergenza (attrezzi, ricambi) da portare.
Fornisci la risposta esclusivamente in formato JSON.`;
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
    };
    const apiResponse = await apiProxy('gemini-2.5-flash', { parts: [{ text: prompt }] }, config);
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
        // Fix: Corrected typo in function name from fileToGeneratorePart to fileToGenerativePart.
        const imagePart = await fileToGenerativePart(image);
        parts.push(imagePart);
    }
    return await textApiProxy('gemini-2.5-flash', { parts });
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
    const apiResponse = await apiProxy('gemini-2.5-flash', { parts: [{ text: prompt }] }, config);
    return mapApiMaintenanceTipsToApp(apiResponse);
};

export const createChatSession = (vehicle: GarageVehicle | null): Chat => {
    const systemInstruction = vehicle
        ? `Sei un meccanico di moto esperto e un appassionato di mototurismo. Il tuo nome è MotoMentor. Stai parlando con il proprietario di una ${vehicle.model} del ${vehicle.year} con ${vehicle.kilometers} km. Rispondi in modo amichevole, competente e conciso. Utilizza la formattazione markdown per elenchi e grassetto quando è appropriato per migliorare la leggibilità.`
        : `Sei un meccanico di moto esperto e un appassionato di mototurismo. Il tuo nome è MotoMentor. Rispondi in modo amichevole, competente e conciso. Invita l'utente a selezionare un veicolo attivo dal "Garage" per ricevere risposte più personalizzate, ma rispondi comunque alla sua domanda attuale. Utilizza la formattazione markdown per elenchi e grassetto quando è appropriato per migliorare la leggibilità.`;

    const chat: Chat = getAi().chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
        },
    });
    return chat;
};