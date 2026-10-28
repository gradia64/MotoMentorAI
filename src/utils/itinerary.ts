// Normalizzazione di itinerari provenienti da fonti non fidate (file .mmt.json
// condivisi, import JSON dello storico): ogni campo viene ricondotto al tipo
// atteso, così la UI e i PDF non vanno in crash su dati malformati.
import type { Day, GpxPoint, Itinerary, SavedTrip, DiaryEntry } from '../../types';

const str = (v: unknown, fallback = ''): string =>
    typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : fallback);

const num = (v: unknown, fallback = 0): number => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
};

const normalizePoint = (p: any): GpxPoint | null => {
    if (!p || typeof p !== 'object') return null;
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat, lon };
};

const normalizeDay = (d: any, index: number): Day => {
    const w = d && typeof d.weatherForecast === 'object' && d.weatherForecast ? d.weatherForecast : {};
    return {
        day: num(d?.day, index + 1),
        stageTitle: str(d?.stageTitle, 'Tappa'),
        routeDescription: str(d?.routeDescription),
        stageKilometers: num(d?.stageKilometers),
        activities: Array.isArray(d?.activities) ? d.activities.map((a: unknown) => str(a)).filter(Boolean) : [],
        gpxTrack: Array.isArray(d?.gpxTrack)
            ? d.gpxTrack.map(normalizePoint).filter((p: GpxPoint | null): p is GpxPoint => !!p)
            : [],
        weatherForecast: {
            temperatureMin: num(w.temperatureMin, 10),
            temperatureMax: num(w.temperatureMax, 20),
            conditions: str(w.conditions, 'Variabile'),
            icon: str(w.icon, 'cloud'),
        },
        drivingTips: str(d?.drivingTips),
        restaurantOption: str(d?.restaurantOption),
        accommodation: str(d?.accommodation),
        alternativeRouteSuggestion: typeof d?.alternativeRouteSuggestion === 'string' ? d.alternativeRouteSuggestion : undefined,
    };
};

// Restituisce null se l'oggetto non ha nemmeno la struttura minima di un itinerario.
export const normalizeItinerary = (raw: any): Itinerary | null => {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.dailySchedule)) return null;
    return {
        tripTitle: str(raw.tripTitle, 'Viaggio Senza Titolo'),
        generalDescription: str(raw.generalDescription),
        dailySchedule: raw.dailySchedule.filter((d: unknown) => d && typeof d === 'object').map(normalizeDay),
        ...(typeof raw.generatedBy === 'string' && raw.generatedBy.trim()
            ? { generatedBy: raw.generatedBy.trim().slice(0, 80) }
            : {}),
    };
};

// "gemini-3.6-flash" → "Gemini 3.6 Flash", per la nota sotto al viaggio.
export const formatModelName = (id: string): string =>
    id.replace(/^models\//, '')
        .split('-')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

export const normalizeSavedTrip = (raw: any): SavedTrip | null => {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
    const itinerary = normalizeItinerary(raw.itinerary);
    if (!itinerary) return null;
    const diaryEntries: DiaryEntry[] = Array.isArray(raw.diaryEntries)
        ? raw.diaryEntries
            .filter((e: any) => e && typeof e === 'object')
            .map((e: any) => ({ day: num(e.day), content: str(e.content) }))
        : [];
    const inputs = raw.inputs && typeof raw.inputs === 'object' ? raw.inputs : {};
    return {
        id: raw.id,
        inputs: {
            ...inputs,
            tripType: inputs.tripType === 'tour' ? 'tour' : 'itinerary',
            duration: str(inputs.duration),
            period: str(inputs.period),
            roadPreference: str(inputs.roadPreference),
        },
        itinerary,
        diaryEntries,
        diarySummary: typeof raw.diarySummary === 'string' ? raw.diarySummary : undefined,
    };
};
