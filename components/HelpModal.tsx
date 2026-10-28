import React, { useState } from 'react';
import {
    XMarkIcon, QuestionMarkCircleIcon, RocketLaunchIcon, HomeIcon, MapPinIcon, ShareIcon,
    BookOpenIcon, WrenchScrewdriverIcon, CogIcon, ChatBubbleLeftRightIcon, KeyIcon,
    ShieldCheckIcon, CommandLineIcon,
} from '@heroicons/react/24/outline';
import { useUIStore } from '../src/store/useUIStore';
import { useEscapeKey } from '../src/utils/hooks';

// Guida in linea (menu Aiuto → Guida, F1). Il contenuto è statico e locale:
// funziona offline come il resto dell'app.

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-sm text-gray-300 leading-relaxed mb-3">{children}</p>
);

const H: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h4 className="text-sm font-bold text-blue-300 uppercase tracking-wide mt-5 mb-2">{children}</h4>
);

const L: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
    <ul className="list-disc pl-5 space-y-1.5 mb-3 text-sm text-gray-300 leading-relaxed">
        {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
);

// Nome di un pulsante o di una voce di menu, come compare nell'app.
const B: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <strong className="text-white font-semibold">{children}</strong>
);

const K: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className="px-1.5 py-0.5 rounded bg-gray-700 border border-gray-600 text-xs font-mono text-gray-200">{children}</kbd>
);

interface HelpSection {
    id: string;
    title: string;
    icon: React.ElementType;
    body: React.ReactNode;
}

const SECTIONS: HelpSection[] = [
    {
        id: 'start',
        title: 'Primi passi',
        icon: RocketLaunchIcon,
        body: (
            <>
                <P>MotoMentor AI ti aiuta a pianificare viaggi in moto, tenere un diario, seguire la manutenzione e gestire il garage. Le funzioni di intelligenza artificiale usano Google Gemini.</P>
                <L items={[
                    <>Crea un account locale dalla schermata di accesso (<B>Registrati qui</B>): nome utente di almeno 3 caratteri, password di almeno 6. Ogni persona che usa il computer può avere il proprio account, con dati separati.</>,
                    <>Configura la chiave API Gemini (vedi <B>Chiave API Gemini</B>): senza chiave le funzioni IA non rispondono.</>,
                    <>Aggiungi la tua moto nel <B>Garage</B>: il primo veicolo diventa automaticamente quello attivo, usato da Planner, Meccanico e Chat.</>,
                    <>Pianifica un viaggio nel <B>Planner</B> e salvalo: poi potrai raccontarlo nel <B>Diario</B>.</>,
                ]} />
                <P>Le sezioni si aprono dalle schede in alto (Home, Planner, Diario, Meccanico, Garage, Chat IA). Il nome della moto attiva compare nell'intestazione: cliccandolo si apre il Garage.</P>
            </>
        ),
    },
    {
        id: 'home',
        title: 'Home',
        icon: HomeIcon,
        body: (
            <>
                <P>La Home riassume lo stato del veicolo attivo (chilometri, anno, prossima revisione), il diario di bordo e le scadenze da controllare.</P>
                <L items={[
                    <>Le scadenze di assicurazione, bollo e revisione entro 30 giorni, o già superate, compaiono come avvisi. Un banner rosso le segnala anche nelle altre sezioni: cliccandolo torni alla Home.</>,
                    <>I riquadri di accesso rapido portano direttamente a Planner, Meccanico e Chat IA; il riquadro del diario apre il Diario.</>,
                ]} />
            </>
        ),
    },
    {
        id: 'planner',
        title: 'Planner viaggi',
        icon: MapPinIcon,
        body: (
            <>
                <P>Il Planner genera con l'IA un itinerario giorno per giorno, con percorso, chilometri, meteo indicativo, luoghi d'interesse, soste e alloggi consigliati.</P>
                <H>Creare un itinerario</H>
                <L items={[
                    <>Scegli <B>Itinerario A/R</B> (partenza, destinazione e ritorno) oppure <B>Tour</B> (uno dei giri proposti).</>,
                    <>Indica durata, periodo e tipo di strade preferite; nelle <B>Richieste Specifiche</B> puoi aggiungere desideri liberi (soste, strade da evitare…).</>,
                    <>Puoi allegare screenshot di percorsi da Google Maps (PNG, JPG o WEBP): l'IA li userà come riferimento.</>,
                    <>Premi <B>Crea Itinerario</B>. La generazione richiede qualche istante. <B>Nuovo</B> svuota i campi per ricominciare.</>,
                ]} />
                <H>Dopo la generazione</H>
                <L items={[
                    <><B>Salva</B> aggiunge il viaggio allo storico (o aggiorna quello aperto). <B>Storico Viaggi</B> apre i viaggi salvati: puoi caricarli, eliminarli, esportarli o importarli in un file .json (utile come backup).</>,
                    <><B>Scarica PDF</B> crea un road book stampabile.</>,
                    <><B>Mappa Viaggio</B> offre una <B>Panoramica Veloce</B> su Google Maps, la <B>Navigazione Dettagliata</B> (il percorso diviso in segmenti, ognuno in una scheda del browser) e lo scaricamento del file <B>GPX</B> completo per il navigatore.</>,
                    <>Ogni tappa ha la propria mappa e il proprio file GPX.</>,
                    <><B>Condividi</B> esporta il viaggio in un file .mmt.json (vedi <B>Viaggi condivisi</B>).</>,
                    <>In fondo al viaggio (e nel PDF) è indicato il modello IA che l'ha pianificato.</>,
                    <>Per itinerari più accurati puoi far pianificare i viaggi a un modello a pagamento di OpenRouter o DeepSeek (vedi <B>Chiave API Gemini</B>).</>,
                ]} />
            </>
        ),
    },
    {
        id: 'shared',
        title: 'Viaggi condivisi',
        icon: ShareIcon,
        body: (
            <>
                <P>I viaggi si condividono con un file, senza link o servizi cloud.</P>
                <L items={[
                    <>Nel Planner, <B>Condividi</B> salva l'itinerario in un file <B>.mmt.json</B>, da inviare a chi vuoi (email, chiavetta…).</>,
                    <>Per aprirne uno: menu <B>File → Apri viaggio condiviso…</B> (<K>Ctrl</K>+<K>O</K>), oppure doppio clic sul file se MotoMentor AI è installato.</>,
                    <>La vista del viaggio condiviso mostra tappe, mappe e file GPX di ogni giorno. Per tornare all'app usa la freccia in alto a sinistra.</>,
                ]} />
            </>
        ),
    },
    {
        id: 'diary',
        title: 'Diario di bordo',
        icon: BookOpenIcon,
        body: (
            <>
                <P>Il Diario serve a raccontare i viaggi salvati nel Planner.</P>
                <L items={[
                    <>Scegli il viaggio dal menu in alto, poi seleziona una tappa nell'elenco a sinistra.</>,
                    <>Scrivi le note della giornata e premi <B>Salva Nota</B>. Le tappe con una nota sono contrassegnate. Se cambi tappa o viaggio con modifiche non salvate, l'app chiede conferma.</>,
                    <><B>Genera Racconto</B> fa scrivere all'IA un racconto del viaggio a partire dalle tue note e dall'itinerario (<B>Rigenera Racconto</B> per una nuova versione).</>,
                    <>Il PDF del diario contiene il racconto e le note di ogni giorno.</>,
                ]} />
            </>
        ),
    },
    {
        id: 'mechanic',
        title: 'Meccanico',
        icon: WrenchScrewdriverIcon,
        body: (
            <>
                <P>Il Meccanico lavora sul veicolo attivo ed è diviso in tre schede.</P>
                <H>Officina</H>
                <L items={[
                    <>Il libretto di manutenzione: registra ogni intervento con data, tipo, descrizione, costo e chilometri. Puoi ordinarli per data, costo o chilometri ed esportare il libretto in PDF.</>,
                    <><B>Scansiona Scontrino</B>: carica o fotografa una ricevuta e l'IA compila i dati dell'intervento, che controlli prima di salvare.</>,
                    <>I <B>promemoria</B> ricordano un lavoro a un certo chilometraggio: diventano rossi quando la moto lo supera.</>,
                ]} />
                <H>Checklist Viaggio</H>
                <P>Genera i controlli da fare prima di partire, l'equipaggiamento d'emergenza e consigli specifici per l'itinerario aperto nel Planner (o, se non ce n'è uno aperto, per l'ultimo viaggio salvato). Si può esportare in PDF.</P>
                <H>Diagnosi Avarie</H>
                <L items={[
                    <>Descrivi il problema (rumori, spie, comportamenti strani) e, se vuoi, allega una foto: l'IA propone le cause possibili e cosa controllare.</>,
                    <><B>Salva Diagnosi</B> la conserva nello storico del veicolo; dopo il salvataggio il pulsante diventa <B>Aggiorna Diagnosi</B>. <B>Storico Diagnosi</B> le elenca tutte.</>,
                ]} />
                <P>Le risposte dell'IA sono indicative: per la sicurezza della moto rivolgiti sempre a un meccanico qualificato.</P>
            </>
        ),
    },
    {
        id: 'garage',
        title: 'Garage',
        icon: CogIcon,
        body: (
            <>
                <L items={[
                    <><B>Inserimento Rapido</B>: modello, anno e chilometri bastano per aggiungere una moto. Gli altri dati si completano dopo.</>,
                    <><B>Seleziona</B> rende attiva una moto (quella attiva mostra <B>In Uso</B>). Planner, Meccanico e Chat si riferiscono alla moto attiva.</>,
                    <>Aprendo la scheda di un veicolo puoi modificare i dati generali, la foto, i dati tecnici, le scadenze e le note. Il pulsante con le stelline cerca con l'IA cilindrata, potenza e misure dei pneumatici in base a modello e anno.</>,
                    <>Inserendo le date di scadenza di assicurazione, bollo e revisione, l'app ti avvisa quando mancano 30 giorni o meno.</>,
                    <>Eliminando un veicolo si eliminano anche le sue diagnosi, i suoi interventi e i suoi promemoria (l'app chiede conferma).</>,
                ]} />
            </>
        ),
    },
    {
        id: 'chat',
        title: 'Chat IA',
        icon: ChatBubbleLeftRightIcon,
        body: (
            <>
                <P>Una conversazione libera con l'assistente su manutenzione, itinerari e curiosità tecniche. Se c'è una moto attiva, le risposte ne tengono conto.</P>
                <L items={[
                    <><B>Salva</B> conserva la conversazione nello storico (poi diventa <B>Aggiorna</B>); <B>Storico</B> le elenca per riaprirle o eliminarle.</>,
                    <><B>Nuova</B> svuota la chat corrente per iniziarne un'altra.</>,
                ]} />
            </>
        ),
    },
    {
        id: 'key',
        title: 'Chiave API Gemini',
        icon: KeyIcon,
        body: (
            <>
                <P>Le funzioni IA (itinerari, diario, checklist, diagnosi, scontrini, dati tecnici, chat) richiedono una chiave API di Google Gemini.</P>
                <L items={[
                    <>Ottieni una chiave gratuita da Google AI Studio (aistudio.google.com → “Get API key”).</>,
                    <>Inseriscila dall'icona a forma di chiave nell'intestazione, oppure da <B>Configura chiave API Gemini</B> nella schermata di accesso, e premi <B>Salva chiave</B>.</>,
                    <>La chiave resta solo su questo computer, nel file ~/.config/MotoMentorAI/gemini.key, leggibile solo dal tuo utente.</>,
                ]} />
                <H>Pianificazione viaggi a pagamento (facoltativo)</H>
                <L items={[
                    <>Nelle Impostazioni, sezione <B>Pianificazione viaggi con un modello a pagamento</B>, scegli il fornitore: <B>OpenRouter</B> (Claude, GPT, Gemini Pro e molti altri, con una sola chiave) oppure <B>DeepSeek</B>.</>,
                    <>Inserisci la chiave del fornitore (con DeepSeek premi poi <B>Carica modelli</B>), scegli il modello e premi <B>Usa per i viaggi</B>. Per OpenRouter l'elenco riporta il prezzo per milione di token.</>,
                    <>Da quel momento solo <B>Crea Itinerario</B> usa il modello scelto; chat, diagnosi e le altre funzioni restano su Gemini gratuito. Al termine compare il costo della pianificazione: esatto con OpenRouter, stimato dai token e dal listino con DeepSeek (che non lo comunica).</>,
                    <>Il viaggio viene pianificato con Gemini, con un avviso, se il fornitore non risponde (credito esaurito, modello non disponibile) o se alleghi screenshot a un modello segnato “niente immagini”.</>,
                    <><B>Torna a Gemini</B> disattiva la pianificazione a pagamento; <B>Elimina chiave</B> cancella la chiave del fornitore da questo computer (le chiavi sono in ~/.config/MotoMentorAI).</>,
                    <>Attenzione: gli abbonamenti personali (ChatGPT Plus, Claude Pro…) non includono l'accesso API; i fornitori si ricaricano a parte.</>,
                ]} />
                <H>Modelli Gemini</H>
                <P>L'app usa i modelli Gemini Flash, disponibili con il piano gratuito. Se il più recente è sovraccarico passa da sola a quello precedente. Se un messaggio indica che i server di Gemini sono carichi o che è stato raggiunto il limite di richieste, riprova dopo qualche istante.</P>
            </>
        ),
    },
    {
        id: 'privacy',
        title: 'Dati e privacy',
        icon: ShieldCheckIcon,
        body: (
            <>
                <L items={[
                    <>Tutti i dati (account, garage, viaggi, diario, manutenzione, chat) sono salvati solo su questo computer, in ~/.config/MotoMentorAI.</>,
                    <>Alle funzioni IA vengono inviati a Google Gemini solo i dati della richiesta (per esempio la descrizione di un guasto o le foto allegate).</>,
                    <>Per un backup dei viaggi usa <B>Esporta Storico</B> nello storico del Planner; per un backup completo copia la cartella ~/.config/MotoMentorAI.</>,
                ]} />
            </>
        ),
    },
    {
        id: 'shortcuts',
        title: 'Scorciatoie',
        icon: CommandLineIcon,
        body: (
            <div className="space-y-2 text-sm text-gray-300">
                {[
                    [<><K>F1</K></>, 'Apre questa guida'],
                    [<><K>Ctrl</K>+<K>O</K></>, 'Apre un viaggio condiviso (.mmt.json)'],
                    [<><K>Esc</K></>, 'Chiude la finestra aperta'],
                    [<><K>Ctrl</K>+<K>+</K> / <K>Ctrl</K>+<K>-</K></>, 'Aumenta / riduce lo zoom'],
                    [<><K>Ctrl</K>+<K>0</K></>, 'Zoom normale'],
                    [<><K>F11</K></>, 'Schermo intero'],
                ].map(([keys, desc], i) => (
                    <div key={i} className="flex items-center gap-4">
                        <span className="w-44 flex-shrink-0">{keys}</span>
                        <span>{desc}</span>
                    </div>
                ))}
            </div>
        ),
    },
];

export const HelpModal: React.FC = () => {
    const { helpOpen, setHelpOpen } = useUIStore();
    const [activeId, setActiveId] = useState(SECTIONS[0].id);
    const close = () => setHelpOpen(false);
    useEscapeKey(close, helpOpen);

    if (!helpOpen) return null;

    const active = SECTIONS.find(s => s.id === activeId) ?? SECTIONS[0];
    const ActiveIcon = active.icon;

    return (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={close}>
            <div
                className="bg-gray-800 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="help-title"
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-900/50">
                    <div className="flex items-center gap-2">
                        <QuestionMarkCircleIcon className="w-5 h-5 text-blue-400" />
                        <h3 id="help-title" className="text-lg font-bold text-white">Guida di MotoMentor AI</h3>
                    </div>
                    <button
                        onClick={close}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                        aria-label="Chiudi guida"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-1 min-h-0">
                    <nav className="w-56 flex-shrink-0 border-r border-gray-700 bg-gray-900/30 overflow-y-auto p-2" aria-label="Argomenti della guida">
                        {SECTIONS.map(({ id, title, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setActiveId(id)}
                                aria-current={id === activeId ? 'page' : undefined}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                                    id === activeId ? 'bg-blue-600 text-white font-semibold' : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                }`}
                            >
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                {title}
                            </button>
                        ))}
                    </nav>

                    <div key={active.id} className="flex-1 overflow-y-auto p-6">
                        <h3 className="flex items-center gap-2 text-xl font-bold text-white mb-4">
                            <ActiveIcon className="w-6 h-6 text-blue-400" />
                            {active.title}
                        </h3>
                        {active.body}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HelpModal;
