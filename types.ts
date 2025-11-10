import { Type } from '@google/genai';

export enum AiMode {
    TripPlanner = 'TripPlanner',
    VirtualMechanic = 'VirtualMechanic',
    Garage = 'Garage',
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
    temperatura_min: number;
    temperatura_max: number;
    condizioni: string;
    icona: string; 
}

export interface Day {
    giorno: number;
    titolo_tappa: string;
    descrizione_percorso: string;
    chilometri_tappa: number;
    attivita_luoghi_interesse: string[];
    tracciato_gpx: GpxPoint[];
    previsioni_meteo: WeatherForecast;
    consigli_di_guida: string;
    opzione_ristoro: string;
    alloggio_consigliato: string;
}

export interface Itinerary {
    titolo_viaggio: string;
    descrizione_generale: string;
    programma_giornaliero: Day[];
}

export interface MaintenanceTips {
    controlli_essenziali: string[];
    suggerimenti_specifici_viaggio: string[];
    equipaggiamento_emergenza: string[];
}

export interface GarageVehicle {
    id: string;
    model: string;
    year: string;
    kilometers: string;
    purchaseDate?: string;
    vin?: string;
    photo?: string; // base64 encoded image string
}

export interface SavedTrip {
    id: string;
    inputs: {
        tripType: 'itinerary' | 'tour';
        departure?: string;
        destination?: string;
        selectedTour?: string;
        duration: string;
        roadPreference: string;
        period: string;
        customPrompt?: string;
    };
    itinerary: Itinerary;
}


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
                            icona: { type: Type.STRING, description: "Una parola chiave per un'icona meteo (es. 'sun', 'cloud', 'rain', 'storm', 'snow')." }
                        },
                        required: ["temperatura_min", "temperatura_max", "condizioni", "icona"]
                    },
                    consigli_di_guida: { type: Type.STRING, description: "Un consiglio di guida specifico per la tappa del giorno, legato al tipo di strada o alle condizioni." },
                    opzione_ristoro: { type: Type.STRING, description: "Un suggerimento per un'opzione di ristoro lungo il percorso (es. 'Trattoria tipica', 'Area picnic panoramica')." },
                    alloggio_consigliato: { type: Type.STRING, description: "Un suggerimento per il tipo di alloggio alla fine della tappa (es. 'Hotel con parcheggio moto', 'B&B accogliente')." }
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