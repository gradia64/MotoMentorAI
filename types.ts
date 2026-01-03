
import { Type, Content } from '@google/genai';

export enum AiMode {
    TripPlanner = 'TripPlanner',
    VirtualMechanic = 'VirtualMechanic',
    Garage = 'Garage',
    AiChat = 'AiChat',
    TripDiary = 'TripDiary',
}

export enum MaintenanceType {
    Ordinary = 'Ordinaria',
    Extraordinary = 'Straordinaria',
    Exceptional = 'Eccezionale',
}

export interface MaintenanceRecord {
    id: string;
    date: string;
    kilometers: number;
    type: MaintenanceType;
    description: string;
    cost: number;
}

export interface MaintenanceReminder {
    id: string;
    description: string;
    targetKilometers: number; // Stored as a number
}

export interface GpxPoint {
    lat: number;
    lon: number;
}

export interface WeatherForecast {
    temperatureMin: number;
    temperatureMax: number;
    conditions: string;
    icon: string; 
}

export interface Day {
    day: number;
    stageTitle: string;
    routeDescription: string;
    stageKilometers: number;
    activities: string[];
    gpxTrack: GpxPoint[];
    weatherForecast: WeatherForecast;
    drivingTips: string;
    restaurantOption: string;
    accommodation: string;
    alternativeRouteSuggestion?: string;
}

export interface Itinerary {
    tripTitle: string;
    generalDescription: string;
    dailySchedule: Day[];
}

export interface MaintenanceTips {
    essentialChecks: string[];
    tripSpecificTips: string[];
    emergencyEquipment: string[];
}

export interface GarageVehicle {
    id: string;
    model: string;
    year: string;
    kilometers: string;
    purchaseDate?: string;
    vin?: string;
    photo?: string; // base64 encoded image string
    // Digital Garage Extensions
    displacement?: string; // cc
    power?: string; // HP or kW
    frontTire?: string;
    rearTire?: string;
    insuranceExpiry?: string; // ISO Date
    taxExpiry?: string; // Bollo - ISO Date
    inspectionExpiry?: string; // Revisione - ISO Date
    notes?: string;
}

export interface DiaryEntry {
    day: number;
    content: string; // User notes: places, roads, emotions
}

export interface SavedTrip {
    id: string;
    inputs: {
        tripType: 'itinerary' | 'tour';
        departure?: string;
        destination?: string;
        selectedTour?: string;
        duration: string;
        period: string;
        roadPreference: string;
        customRoadPreferenceText?: string;
        customPrompt?: string;
    };
    itinerary: Itinerary;
    diaryEntries?: DiaryEntry[]; // Array of user notes per day
    diarySummary?: string; // AI Generated final report
}

export interface SavedDiagnosis {
    id: string;
    vehicleId: string;
    date: string; // ISO string
    problemDescription: string;
    diagnosisText: string;
}

export interface SavedChat {
    id: string;
    vehicleName: string;
    timestamp: string;
    history: Content[];
}

// --- SCHEMAS ---

export const ITINERARY_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        titolo_viaggio: { type: Type.STRING, description: "Titolo accattivante per l'intero viaggio in moto." },
        descrizione_generale: { type: Type.STRING, description: "Breve descrizione generale dell'itinerario." },
        programma_giornaliero: {
            type: Type.ARRAY,
            description: "Array contenente il programma dettagliato per ogni giorno di viaggio.",
            items: {
                type: Type.OBJECT,
                properties: {
                    giorno: { type: Type.INTEGER, description: "Numero del giorno di viaggio (es. 1, 2, ...)." },
                    titolo_tappa: { type: Type.STRING, description: "Titolo della tappa del giorno." },
                    descrizione_percorso: { type: Type.STRING, description: "Descrizione dettagliata del percorso stradale del giorno, includendo i luoghi più belli da visitare." },
                    chilometri_tappa: { type: Type.NUMBER, description: "Chilometri totali stimati per la tappa del giorno." },
                    attivita_luoghi_interesse: {
                        type: Type.ARRAY,
                        description: "Elenco di attività o luoghi di interesse consigliati per il giorno.",
                        items: { type: Type.STRING }
                    },
                    tracciato_gpx: {
                        type: Type.ARRAY,
                        description: "Array di punti coordinate per il tracciato GPX.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                lat: { type: Type.NUMBER, description: "Latitudine del punto GPX." },
                                lon: { type: Type.NUMBER, description: "Longitudine del punto GPX." }
                            },
                            required: ["lat", "lon"]
                        }
                    },
                    previsioni_meteo: {
                        type: Type.OBJECT,
                        description: "Previsioni meteo stimate per il giorno, basate su dati storici e stagionali.",
                        properties: {
                            temperatura_min: { type: Type.INTEGER, description: "Temperatura minima prevista in gradi Celsius." },
                            temperatura_max: { type: Type.INTEGER, description: "Temperatura massima prevista in gradi Celsius." },
                            condizioni: { type: Type.STRING, description: "Breve descrizione delle condizioni meteo (es. 'Soleggiato', 'Pioggia leggera')." },
                            icona: { type: Type.STRING, description: "Una parola chiave per un'icona meteo. Scegli tra: 'sun', 'moon', 'partly-cloudy-day', 'partly-cloudy-night', 'cloud', 'rain', 'storm', 'snow', 'fog', 'wind'." }
                        },
                        required: ["temperatura_min", "temperatura_max", "condizioni", "icona"]
                    },
                    consigli_di_guida: { type: Type.STRING, description: "Un consiglio di guida specifico per la tappa del giorno, legato al tipo di strada o alle condizioni." },
                    opzione_ristoro: { type: Type.STRING, description: "Un suggerimento per un'opzione di ristoro lungo il percorso (es. 'Trattoria tipica', 'Area picnic panoramica')." },
                    alloggio_consigliato: { type: Type.STRING, description: "Un suggerimento per il tipo di alloggio alla fine della tappa (es. 'Hotel con parcheggio moto', 'B&B accogliente')." },
                    suggerimento_strada_alternativa: {
                        type: Type.STRING,
                        description: "Un suggerimento per un percorso alternativo per un tratto della tappa, basato sul tipo di moto e le preferenze di guida. Ad esempio, una deviazione panoramica, un passo di montagna più impegnativo o un breve tratto di sterrato se la moto è adatta. Lasciare vuoto se non ci sono alternative pertinenti."
                    }
                },
                required: ["giorno", "titolo_tappa", "descrizione_percorso", "chilometri_tappa", "attivita_luoghi_interesse", "tracciato_gpx", "previsioni_meteo", "consigli_di_guida", "opzione_ristoro", "alloggio_consigliato"]
            }
        }
    },
    required: ["titolo_viaggio", "descrizione_generale", "programma_giornaliero"]
};

export const MAINTENANCE_TIPS_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        controlli_essenziali: {
            type: Type.ARRAY,
            description: "Lista di controlli di manutenzione essenziali da effettuare sulla moto prima di partire.",
            items: { type: Type.STRING }
        },
        suggerimenti_specifici_viaggio: {
            type: Type.ARRAY,
            description: "Lista di suggerimenti di manutenzione specifici per il viaggio pianificato (es. tipo di strade, clima).",
            items: { type: Type.STRING }
        },
        equipaggiamento_emergenza: {
            type: Type.ARRAY,
            description: "Lista di attrezzi e ricambi d'emergenza consigliati da portare con sé.",
            items: { type: Type.STRING }
        }
    },
    required: ["controlli_essenziali", "suggerimenti_specifici_viaggio", "equipaggiamento_emergenza"]
};

export const VEHICLE_SPECS_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        cilindrata: { type: Type.STRING, description: "Cilindrata esatta del motore (es. 1254 cc)." },
        potenza: { type: Type.STRING, description: "Potenza massima del motore (es. 136 CV)." },
        pneumatico_anteriore: { type: Type.STRING, description: "Misura pneumatico anteriore standard (es. 120/70 R19)." },
        pneumatico_posteriore: { type: Type.STRING, description: "Misura pneumatico posteriore standard (es. 170/60 R17)." }
    },
    required: ["cilindrata", "potenza", "pneumatico_anteriore", "pneumatico_posteriore"]
};
