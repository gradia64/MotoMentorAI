import React, { FormEvent } from 'react';
import { GarageVehicle, MaintenanceTips, MaintenanceRecord, SavedTrip, MaintenanceReminder } from '../../types';
import { WrenchScrewdriverIcon, ArchiveBoxIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import ActionButton from '../../components/ActionButton';
import MaintenanceLog from './MaintenanceLog';
import MaintenanceList from './MaintenanceList';


export interface VirtualMechanicProps {
    handleSubmit: (e: FormEvent) => Promise<void>;
    mode: 'diagnose' | 'maintenance' | 'workshop';
    setMode: React.Dispatch<React.SetStateAction<'diagnose' | 'maintenance' | 'workshop'>>;
    problemDescription: string;
    setProblemDescription: React.Dispatch<React.SetStateAction<string>>;
    activeVehicle: GarageVehicle | null;
    setProblemImage: React.Dispatch<React.SetStateAction<File | null>>;
    diagnosis: string | null;
    maintenanceTips: MaintenanceTips | null;
    loading: boolean;
    maintenanceLog: MaintenanceRecord[];
    onAddRecord: (record: Omit<MaintenanceRecord, 'id'>) => void;
    onDeleteRecord: (id: string) => void;
    tripHistory: SavedTrip[];
    reminders: MaintenanceReminder[];
    onAddReminder: (reminder: Omit<MaintenanceReminder, 'id'>) => void;
    onDeleteReminder: (id: string) => void;
    savedConfirmation: string | null;
}


const VirtualMechanic: React.FC<VirtualMechanicProps> = ({ handleSubmit, mode, setMode, problemDescription, setProblemDescription, activeVehicle, setProblemImage, diagnosis, maintenanceTips, loading, maintenanceLog, onAddRecord, onDeleteRecord, tripHistory, reminders, onAddReminder, onDeleteReminder, savedConfirmation }) => (
    <div>
        <div className="flex justify-center bg-gray-700 rounded-full p-1 mb-6 max-w-lg mx-auto">
            <button onClick={() => setMode('workshop')} className={`flex items-center justify-center gap-2 px-4 py-1.5 w-1/3 rounded-full text-sm font-semibold transition ${mode === 'workshop' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}><BookOpenIcon className="w-4 h-4"/>Officina</button>
            <button onClick={() => setMode('maintenance')} className={`flex items-center justify-center gap-2 px-4 py-1.5 w-1/3 rounded-full text-sm font-semibold transition ${mode === 'maintenance' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}><ArchiveBoxIcon className="w-4 h-4"/>Check Pre-Viaggio</button>
            <button onClick={() => setMode('diagnose')} className={`flex items-center justify-center gap-2 px-4 py-1.5 w-1/3 rounded-full text-sm font-semibold transition ${mode === 'diagnose' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}><WrenchScrewdriverIcon className="w-4 h-4"/>Diagnosi Avarie</button>
        </div>

        {mode === 'workshop' ? (
            <MaintenanceLog 
                log={maintenanceLog} 
                onAdd={onAddRecord} 
                onDelete={onDeleteRecord}
                reminders={reminders}
                onAddReminder={onAddReminder}
                onDeleteReminder={onDeleteReminder}
                activeVehicle={activeVehicle}
                savedConfirmation={savedConfirmation}
            />
        ) : (
            <>
            {/* Warning for no active vehicle (applies to both diagnose and maintenance) */}
            {!activeVehicle && (
                 <div className="bg-yellow-500/20 text-yellow-300 p-3 rounded-md mb-4 text-center">
                    Nessun veicolo attivo. Vai al <strong>Garage</strong> per aggiungere o selezionare un veicolo.
                </div>
            )}
             {/* Warning for no trip history (applies only to maintenance) */}
            {mode === 'maintenance' && tripHistory.length === 0 && (
                 <div className="bg-yellow-500/20 text-yellow-300 p-3 rounded-md mb-4 text-center">
                    Crea e salva almeno un viaggio nel <strong>Planner Viaggi</strong> per ricevere consigli di manutenzione.
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                 {activeVehicle && (
                    <div className="bg-gray-700/50 p-3 rounded-lg">
                        <p className="text-sm text-gray-400">Veicolo Attivo Selezionato:</p>
                        <p className="font-bold text-white">{activeVehicle.model} ({activeVehicle.year}) - {Number(activeVehicle.kilometers).toLocaleString('it-IT')} km</p>
                    </div>
                )}
                {mode === 'diagnose' && (
                    <>
                        <div>
                            <label htmlFor="problem" className="block text-sm font-medium text-gray-300">Descrivi il problema</label>
                            <textarea id="problem" value={problemDescription} onChange={(e) => setProblemDescription(e.target.value)} rows={4} className="mt-1 block w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" required></textarea>
                        </div>
                        <div>
                            <label htmlFor="image" className="block text-sm font-medium text-gray-300">Allega una foto (opzionale)</label>
                            <input type="file" id="image" onChange={(e) => setProblemImage(e.target.files ? e.target.files[0] : null)} className="mt-1 block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"/>
                        </div>
                    </>
                )}
                <ActionButton type="submit" disabled={loading || !activeVehicle || (mode === 'maintenance' && tripHistory.length === 0)}>
                    {loading ? 'Analisi in corso...' : (mode === 'diagnose' ? 'Ottieni Diagnosi' : 'Genera Checklist')}
                </ActionButton>
            </form>
            
            {loading && <div className="text-center p-8"> <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div> <p className="mt-2">L'IA sta analizzando la tua richiesta...</p> </div>}
            
            {/* Conditionally render results based on mode */}
            {mode === 'diagnose' && diagnosis && <div className="mt-6 whitespace-pre-wrap bg-gray-700/50 p-4 rounded-lg animate-fade-in">{diagnosis}</div>}
            
            {mode === 'maintenance' && maintenanceTips && (
                <div className="mt-6 space-y-4 animate-fade-in">
                    <MaintenanceList title="Controlli Essenziali" items={maintenanceTips.controlli_essenziali} />
                    <MaintenanceList title="Suggerimenti Specifici per il Viaggio" items={maintenanceTips.suggerimenti_specifici_viaggio} />
                    <MaintenanceList title="Equipaggiamento d'Emergenza" items={maintenanceTips.equipaggiamento_emergenza} />
                </div>
            )}
            </>
        )}
    </div>
);

export default VirtualMechanic;
