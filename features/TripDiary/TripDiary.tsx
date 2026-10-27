
import React, { useState, useEffect } from 'react';
import { BookOpenIcon, PencilSquareIcon, SparklesIcon, ArrowDownTrayIcon, CheckIcon } from '@heroicons/react/24/outline';

// Stores
import { useTripStore } from '../../src/store/useTripStore';
import { useUIStore } from '../../src/store/useUIStore';

import SelectField from '../../components/SelectField';
import ActionButton from '../../components/ActionButton';
import Tooltip from '../../components/Tooltip';
import { DiaryEntry } from '../../types';

const TripDiary: React.FC = () => {
    const { 
        tripHistory, 
        activeDiaryTripId, 
        updateTrip, 
        updateDiarySummary, 
        downloadDiaryPdf,
        setActiveDiaryTrip
    } = useTripStore();
    
    const { isGeneratingDiarySummary } = useUIStore();

    const [selectedDay, setSelectedDay] = useState<number>(1);
    const [currentNote, setCurrentNote] = useState<string>('');
    const [unsavedChanges, setUnsavedChanges] = useState(false);

    const activeTrip = tripHistory.find((t: any) => t.id === activeDiaryTripId);
    // La numerazione dei giorni generata dall'IA non è garantita contigua:
    // si cerca per numero giorno, non per posizione nell'array.
    const selectedDaySchedule = activeTrip?.itinerary?.dailySchedule?.find((d: any) => d.day === selectedDay) || null;

    // Effect to update local state when active trip or day changes.
    // Dipendenza sull'id (non sul riferimento): ogni write sulla collection
    // crea nuovi oggetti e non deve azzerare la nota non salvata.
    useEffect(() => {
        if (activeTrip) {
            const entry = activeTrip.diaryEntries?.find((e: any) => e.day === selectedDay);
            setCurrentNote(entry?.content || '');
            setUnsavedChanges(false);
        }
    }, [activeTrip?.id, selectedDay]);

    const handleTripSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setActiveDiaryTrip(e.target.value);
        setSelectedDay(1); // Reset to day 1 on trip change
    };

    const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCurrentNote(e.target.value);
        setUnsavedChanges(true);
    };

    const saveCurrentNote = () => {
        if (!activeTrip) return;

        const currentEntries = activeTrip.diaryEntries || [];
        const otherEntries = currentEntries.filter((e: any) => e.day !== selectedDay);
        
        const newEntry: DiaryEntry = {
            day: selectedDay,
            content: currentNote
        };

        const updatedEntries = [...otherEntries, newEntry].sort((a, b) => a.day - b.day);
        const updatedTrip = { ...activeTrip, diaryEntries: updatedEntries };

        updateTrip(updatedTrip);
        setUnsavedChanges(false);
    };

    if (tripHistory.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <BookOpenIcon className="w-16 h-16 mb-4 opacity-50" />
                <h3 className="text-xl font-bold mb-2">Il Diario è Vuoto</h3>
                <p className="text-center max-w-md">
                    Non hai ancora salvato nessun viaggio. Vai al <strong>Planner Viaggi</strong>, crea un itinerario e salvalo per iniziare a scrivere il tuo diario.
                </p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in h-full flex flex-col">
            {/* Header / Selector */}
            <div className="mb-6 bg-gray-700/50 p-4 rounded-lg">
                <SelectField 
                    id="diaryTripSelect" 
                    label="Seleziona il Viaggio da raccontare" 
                    value={activeDiaryTripId || ''} 
                    onChange={handleTripSelect}
                >
                    <option value="" disabled>-- Scegli un viaggio --</option>
                    {tripHistory.map((trip: any) => (
                        <option key={trip.id} value={trip.id}>{trip.itinerary.tripTitle}</option>
                    ))}
                </SelectField>
            </div>

            {activeTrip ? (
                <div className="flex-grow flex flex-col lg:flex-row gap-6">
                    {/* Left Column: Day Navigation */}
                    <div className="lg:w-1/3 bg-gray-700/30 rounded-lg p-4 h-full overflow-y-auto max-h-[600px]">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <BookOpenIcon className="w-5 h-5 text-blue-400"/> Tappe del Viaggio
                        </h3>
                        <div className="space-y-2">
                            {activeTrip.itinerary.dailySchedule.map((day: any) => {
                                const hasEntry = activeTrip.diaryEntries?.some((e: any) => e.day === day.day && e.content.trim().length > 0);
                                return (
                                    <button
                                        key={day.day}
                                        onClick={() => {
                                            if (unsavedChanges) {
                                                if (window.confirm("Hai modifiche non salvate. Vuoi scartarle?")) {
                                                    setSelectedDay(day.day);
                                                }
                                            } else {
                                                setSelectedDay(day.day);
                                            }
                                        }}
                                        className={`w-full text-left p-3 rounded-md transition-all border-l-4 ${
                                            selectedDay === day.day 
                                                ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg' 
                                                : 'bg-gray-800 border-transparent text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold text-sm">Giorno {day.day}</span>
                                            {hasEntry && <CheckIcon className="w-4 h-4 text-green-400"/>}
                                        </div>
                                        <p className="text-xs truncate opacity-80 mt-1">{day.stageTitle}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Column: Editor & Summary */}
                    <div className="lg:w-2/3 flex flex-col gap-6">
                        
                        {/* Note Editor */}
                        <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 flex-grow">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Giorno {selectedDay}: {selectedDaySchedule?.stageTitle ?? '—'}</h2>
                                    <p className="text-sm text-gray-400 mt-1">{selectedDaySchedule?.routeDescription ?? ''}</p>
                                </div>
                                {unsavedChanges && <span className="text-xs text-yellow-400 animate-pulse font-semibold">Modifiche non salvate</span>}
                            </div>
                            
                            <div className="relative">
                                <textarea
                                    value={currentNote}
                                    onChange={handleNoteChange}
                                    placeholder="Racconta la tua giornata... Strade percorse, luoghi visitati, emozioni, imprevisti..."
                                    className="w-full h-64 bg-gray-900/50 text-white p-4 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none leading-relaxed"
                                />
                                <div className="absolute bottom-4 right-4">
                                    <ActionButton onClick={saveCurrentNote} disabled={!unsavedChanges}>
                                        <CheckIcon className="w-5 h-5"/> Salva Nota
                                    </ActionButton>
                                </div>
                            </div>
                        </div>

                        {/* AI Summary Section */}
                        <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <SparklesIcon className="w-5 h-5 text-purple-400"/> Il Racconto del Viaggio
                                </h3>
                                <div className="flex gap-2">
                                    <Tooltip text="L'IA leggerà le tue note e l'itinerario per scrivere un racconto avvincente della tua avventura.">
                                        <ActionButton 
                                            onClick={() => updateDiarySummary(activeTrip)} 
                                            loading={isGeneratingDiarySummary}
                                            loadingText="Scrivendo..."
                                            className="bg-purple-600 hover:bg-purple-500"
                                        >
                                            <SparklesIcon className="w-5 h-5"/> {activeTrip.diarySummary ? 'Rigenera Racconto' : 'Genera Racconto'}
                                        </ActionButton>
                                    </Tooltip>
                                    <Tooltip text="Scarica il diario completo in PDF (Itinerario + Note + Racconto)">
                                        <ActionButton 
                                            onClick={() => downloadDiaryPdf(activeTrip)}
                                            className="bg-teal-600 hover:bg-teal-500"
                                        >
                                            <ArrowDownTrayIcon className="w-5 h-5"/> Scarica PDF
                                        </ActionButton>
                                    </Tooltip>
                                </div>
                            </div>

                            {activeTrip.diarySummary ? (
                                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 prose prose-invert max-w-none text-gray-300">
                                    <div className="whitespace-pre-wrap">{activeTrip.diarySummary}</div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-700 rounded-lg">
                                    <p>Scrivi le tue note giornaliere e poi clicca su "Genera Racconto" per ottenere un resoconto indimenticabile della tua esperienza.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center flex-grow opacity-50">
                    <p>Seleziona un viaggio dal menu in alto per iniziare.</p>
                </div>
            )}
        </div>
    );
};

export default TripDiary;
