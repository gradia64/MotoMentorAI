import { GoogleGenAI, Part } from "@google/genai";
import { ITINERARY_SCHEMA, Itinerary, MAINTENANCE_TIPS_SCHEMA, MaintenanceTips, GarageVehicle, MaintenanceRecord } from '../types';

const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey });

// Helper to convert file to base64
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

export const generateItinerary = async (options: ItineraryOptions): Promise<Itinerary> => {
    const { departure, destination, tourName, duration, roadPreference, period, motorcycle, customPrompt } = options;
    
    const motorcycleInfo = motorcycle && motorcycle.model
        ? `Il viaggio sarà affrontato con una ${motorcycle.model} dell'anno ${motorcycle.year} con circa ${motorcycle.kilometers} km. Tieni conto del tipo di moto (es. tourer, sportiva, adventure) e del suo chilometraggio per suggerire percorsi adatti.`
        : '';
    
    const periodInfo = period ? `Il viaggio si svolgerà nel periodo: ${period}. Usa questa informazione per rendere le previsioni meteo più accurate e pertinenti, tenendo conto della stagionalità.` : '';
        
    const extraFieldsPrompt = `- Per ogni giorno, includi anche: un \`consigli_di_guida\` (un consiglio di guida specifico per la tappa, es. 'attenzione al vento laterale sui viadotti'), una \`opzione_ristoro\` (un suggerimento per pranzare, es. 'Trattoria con cucina locale a metà percorso'), e un \`alloggio_consigliato\` (un suggerimento per il pernottamento, es. 'Hotel con parcheggio moto coperto').`;

    const motorcycleRoutingPhilosophy = `- **FILOSOFIA DEL PERCORSO MOTOCICLISTICO**: Questo è il punto più importante. La pianificazione deve essere fatta con la mentalità di un motociclista esperto che cerca il massimo piacere di guida.
  - **EVITA ASSOLUTAMENTE**: Centri urbani trafficati (come l'esempio di Piazza Cordusio a Milano che deve essere evitato), zone industriali, tangenziali congestionate e autostrade/superstrade monotone, a meno che non siano l'unica opzione praticabile per un breve collegamento. L'obiettivo è massimizzare il tempo su strade godibili.
  - **DAI LA MASSIMA PRIORITÀ A**: Strade secondarie ben tenute, percorsi collinari o montani con belle curve, strade costiere panoramiche e strade rurali che attraversano paesaggi interessanti. La strada stessa è parte della destinazione.
  - Anche le tappe di trasferimento (andata/ritorno) devono seguire questa filosofia, cercando il miglior compromesso tra efficienza e piacere di guida, aggirando sempre i grandi centri urbani.`;
    
    const customPromptInfo = customPrompt && customPrompt.trim()
        ? `- **RICHIESTA SPECIFICA DELL'UTENTE**: L'utente ha fatto una richiesta speciale che deve essere assolutamente soddisfatta: "${customPrompt}". Integra questa richiesta in modo coerente nel piano di viaggio.`
        : '';
        
    let prompt: string;
    
    if (tourName) {
         prompt = `Crea un itinerario dettagliato per un viaggio in moto della durata totale di ${duration} giorni.
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
- Per ogni giorno (sia di trasferimento che di tour), fornisci un titolo, una descrizione del percorso che includa i luoghi più belli da visitare, i chilometri totali della tappa, un elenco di attività o luoghi di interesse, un tracciato GPX e una previsione meteo realistica basata sulla località e il periodo dell'anno (temperatura min/max in Celsius, condizioni e una parola chiave per un'icona: 'sun', 'cloud', 'rain', 'storm', 'snow').
- Nella 'descrizione_percorso' di ogni giorno, inizia con una breve frase che descriva il tipo di strada per quella tappa, riflettendo direttamente la preferenza '${roadPreference}' scelta (es. 'Il percorso di oggi si snoderà su strade panoramiche e tortuose...' o 'Questa tappa prevede un trasferimento veloce su superstrade...').
- ${extraFieldsPrompt}
- ${motorcycleInfo}
- ${customPromptInfo}
Fornisci la risposta esclusivamente in formato JSON.`;
    } else {
        prompt = `Crea un itinerario dettagliato per un viaggio in moto di ${duration} giorni.
- Luogo di partenza: ${departure}.
- Destinazione principale: ${destination}.
- ${periodInfo}
- Il viaggio deve includere sia l'andata che il ritorno, distribuendo le tappe in modo equilibrato nei ${duration} giorni totali.
- Preferenza sul tipo di strade: ${roadPreference}.
- ${motorcycleRoutingPhilosophy}
- Per ogni giorno, fornisci un titolo, una descrizione del percorso, i chilometri totali della tappa, un elenco di attività o luoghi di interesse, un tracciato GPX e una previsione meteo realistica basata sulla località e il periodo dell'anno (temperatura min/max in Celsius, condizioni e una parola chiave per un'icona: 'sun', 'cloud', 'rain', 'storm', 'snow').
- Nella 'descrizione_percorso' di ogni giorno, inizia con una breve frase che descriva il tipo di strada per quella tappa, riflettendo direttamente la preferenza '${roadPreference}' scelta (es. 'Il percorso di oggi si snoderà su strade panoramiche e tortuose...' o 'Questa tappa prevede un trasferimento veloce su superstrade...').
- ${extraFieldsPrompt}
- ${motorcycleInfo}
- ${customPromptInfo}
Fornisci la risposta esclusivamente in formato JSON.`;
    }


    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            responseMimeType: "application/json",
            responseSchema: ITINERARY_SCHEMA,
        },
    });

    try {
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as Itinerary;
    } catch (e) {
        console.error("Failed to parse itinerary JSON:", response.text);
        throw new Error("La risposta del server non è un formato JSON valido.");
    }
};

export const diagnoseProblem = async (
  problemDescription: string,
  motorcycleModel: string,
  motorcycleYear: string,
  motorcycleKilometers: string,
  image?: File
): Promise<string> => {
    const prompt = `Agisci come un meccanico di moto professionista altamente qualificato.
La tua analisi deve essere basata sulle informazioni ufficiali dei manuali di officina e manutenzione specifici per il modello e l'anno della moto.
Un utente ha un problema con la sua ${motorcycleModel} del ${motorcycleYear} con circa ${motorcycleKilometers} km.
Descrizione del problema: "${problemDescription}".
Il chilometraggio è un fattore cruciale, usalo per la diagnosi, confrontandolo con gli intervalli di manutenzione previsti dal costruttore.
Fornisci una diagnosi probabile, una lista di possibili cause in ordine di probabilità (dalla più alla meno probabile) e suggerisci dei passaggi dettagliati per verificare il problema o risolverlo, se alla portata di un utente con competenze meccaniche di base. Specifica quando è invece strettamente necessario l'intervento di un'officina specializzata. Se c'è un'immagine, usala per affinare la diagnosi.`;
    
    const parts: Part[] = [{ text: prompt }];
    if (image) {
        const imagePart = await fileToGenerativePart(image);
        parts.push(imagePart);
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: parts },
    });
    return response.text;
};

export const getMaintenanceTips = async (
    motorcycle: GarageVehicle,
    itinerary: Itinerary,
    maintenanceLog: MaintenanceRecord[]
): Promise<MaintenanceTips> => {
    const totalTripKm = itinerary.programma_giornaliero.reduce((total, day) => total + day.chilometri_tappa, 0);
    
    const maintenanceHistoryString = maintenanceLog.length > 0
    ? maintenanceLog
        .map(record => `- Data: ${new Date(record.date).toLocaleDateString('it-IT')}, Km: ${record.kilometers.toLocaleString('it-IT')}, Lavoro: ${record.description}`)
        .join('\n')
    : "Nessuno storico di manutenzione registrato.";

    const maintenanceHistoryPrompt = `
**Storico Manutenzione del Veicolo:**
Analizza attentamente il seguente storico dei lavori eseguiti per fornire consigli ancora più pertinenti. Confronta i chilometraggi e le date degli interventi con i km attuali della moto e la distanza/periodo del viaggio imminente.
${maintenanceHistoryString}
`;

    const prompt = `Agisci come un meccanico di moto esperto e meticoloso.
Prepara una checklist di manutenzione pre-viaggio per una ${motorcycle.model} del ${motorcycle.year} che ha attualmente ${motorcycle.kilometers} km.
Il viaggio pianificato è: "${itinerary.titolo_viaggio}" della durata di ${itinerary.programma_giornaliero.length} giorni, per un totale di circa ${Math.round(totalTripKm)} km.
Descrizione del viaggio: "${itinerary.descrizione_generale}".

${maintenanceHistoryPrompt}

Considerando il chilometraggio attuale della moto, lo storico degli interventi, e i chilometri che verranno aggiunti con il viaggio, fornisci:
1.  Una lista di controlli essenziali da fare prima di partire. Presta particolare attenzione a componenti che potrebbero essere vicini alla fine del loro ciclo vita (es. gomme, trasmissione, pastiglie freni), tenendo conto di quando sono stati controllati o sostituiti l'ultima volta secondo lo storico. Ad esempio, se l'olio è stato cambiato da poco, non suggerire di cambiarlo di nuovo a meno che il viaggio non sia eccezionalmente lungo. Sii specifico e intelligente.
2.  Una lista di suggerimenti specifici legati a questo particolare viaggio (es. tipo di strade, clima previsto, durata), personalizzati in base allo storico.
3.  Una lista di equipaggiamento d'emergenza (attrezzi, ricambi) da portare.
Fornisci la risposta esclusivamente in formato JSON.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            responseMimeType: "application/json",
            responseSchema: MAINTENANCE_TIPS_SCHEMA,
        },
    });
    
    try {
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as MaintenanceTips;
    } catch (e) {
        console.error("Failed to parse maintenance tips JSON:", response.text);
        throw new Error("La risposta del server non è un formato JSON valido per i consigli di manutenzione.");
    }
};
