import React, { useState, useEffect, useRef } from 'react';
import { WrenchScrewdriverIcon, ArchiveBoxIcon, BookOpenIcon, PhotoIcon, XCircleIcon, ArrowDownTrayIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import ActionButton from '../../components/ActionButton';
import MaintenanceLog from './MaintenanceLog';
import MaintenanceList from './MaintenanceList';
import DiagnosisHistoryModal from './DiagnosisHistoryModal';
import { useAppContext } from '../../state/AppContext';
import Tooltip from '../../components/Tooltip';


const VirtualMechanic: React.FC = () => {
    const { 
        state, 
        dispatch,
        handleMechanicSubmit,
        handleAddMaintenanceRecord,
        handleDeleteMaintenanceRecord,
        handleAddReminder,
        handleDeleteReminder,
        handleSaveOrUpdateDiagnosis,
        handleLoadDiagnosis,
        handleDeleteDiagnosis,
        handleDownloadDiagnosisPdf,
        handleDownloadChecklistPdf,
    } = useAppContext();
    
    const {
        mechanicMode,
        drafts,
        activeVehicle,
        diagnosis,
        activeDiagnosisId,
        maintenanceTips,
        // Fix: Use specific loading states
        isDiagnosingProblem,
        isGeneratingChecklist,
        maintenanceLog,
        tripHistory,
        reminders,
        savedConfirmation,
        savedDiagnoses,
        isGeneratingDiagnosisPdf,
        isGeneratingChecklistPdf,
    } = state;

    const { problemDescription, problemImage } = drafts.virtualMechanic;
    
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const setMechanicMode = (mode: 'diagnose' | 'maintenance' | 'workshop') => {
        dispatch({ type: 'SET_MECHANIC_MODE', payload: mode });
    };

    const setProblemDescription = (value: string) => {
        dispatch({ type: 'UPDATE_MECHANIC_DRAFT', payload: { problemDescription: value } });
    };

    const setProblemImage = (file: File | null) => {
        dispatch({ type: 'UPDATE_MECHANIC_DRAFT', payload: { problemImage: file } });
    };

    useEffect(() => {
        if (problemImage) {
            const objectUrl = URL.createObjectURL(problemImage);
            setImagePreview(objectUrl);

            // Cleanup function to revoke the object URL
            return () => URL.revokeObjectURL(objectUrl);
        } else {
            setImagePreview(null);
        }
    }, [problemImage]);

    const handleRemoveImage = () => {
        setProblemImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = ""; // Reset the file input
        }
    };
    
    const vehicleDiagnoses = activeVehicle ? savedDiagnoses.filter(d => d.vehicleId === activeVehicle.id) : [];
    
    // Determine the loading state based on the current mode
    const isLoading = mechanicMode === 'diagnose' ? isDiagnosingProblem : isGeneratingChecklist;

    return (
    <div>
        <DiagnosisHistoryModal 
            show={showHistoryModal} 
            onClose={() => setShowHistoryModal(false)}
            history={vehicleDiagnoses}
            onLoad={handleLoadDiagnosis}
            onDelete={handleDeleteDiagnosis}
        />
        <div className="flex justify-center bg-gray-700 rounded-full p-1 mb-6 max-w-lg mx-auto">
            <button onClick={() => setMechanicMode('workshop')} className={`flex items-center justify-center gap-2 px-4 py-1.5 w-1/3 rounded-full text-sm font-semibold transition ${mechanicMode === 'workshop' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}><BookOpenIcon className="w-4 h-4"/>Officina</button>
            <button onClick={() => setMechanicMode('maintenance')} className={`flex items-center justify-center gap-2 px-4 py-1.5 w-1/3 rounded-full text-sm font-semibold transition ${mechanicMode === 'maintenance' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}><ArchiveBoxIcon className="w-4 h-4"/>Checklist Viaggio</button>
            <button onClick={() => setMechanicMode('diagnose')} className={`flex items-center justify-center gap-2 px-4 py-1.5 w-1/3 rounded-full text-sm font-semibold transition ${mechanicMode === 'diagnose' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}><WrenchScrewdriverIcon className="w-4 h-4"/>Diagnosi Avarie</button>
        </div>

        {mechanicMode === 'workshop' ? (
            <MaintenanceLog 
                log={maintenanceLog} 
                onAdd={handleAddMaintenanceRecord} 
                onDelete={handleDeleteMaintenanceRecord}
                reminders={reminders}
                onAddReminder={handleAddReminder}
                onDeleteReminder={handleDeleteReminder}
                activeVehicle={activeVehicle}
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
            {mechanicMode === 'maintenance' && tripHistory.length === 0 && (
                 <div className="bg-yellow-500/20 text-yellow-300 p-3 rounded-md mb-4 text-center">
                    Crea e salva almeno un viaggio nel <strong>Planner Viaggi</strong> per ricevere consigli di manutenzione.
                </div>
            )}

            <form onSubmit={handleMechanicSubmit} className="space-y-4">
                 {activeVehicle && (
                    <div className="bg-gray-700/50 p-3 rounded-lg">
                        <p className="text-sm text-gray-400">Veicolo Attivo Selezionato:</p>
                        <p className="font-bold text-white">{activeVehicle.model} ({activeVehicle.year}) - {Number(activeVehicle.kilometers).toLocaleString('it-IT')} km</p>
                    </div>
                )}
                {mechanicMode === 'diagnose' && (
                    <>
                        <div>
                            <label htmlFor="problem" className="block text-sm font-medium text-gray-300">Descrivi il problema</label>
                            <textarea id="problem" value={problemDescription} onChange={(e) => setProblemDescription(e.target.value)} rows={4} className="mt-1 block w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" required></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300">Allega una foto (opzionale)</label>
                             <div className="mt-2">
                                {imagePreview ? (
                                    <div className="relative group w-40 h-40">
                                        <img src={imagePreview} alt="Anteprima del problema" className="w-40 h-40 rounded-md object-cover"/>
                                        <button 
                                            type="button"
                                            onClick={handleRemoveImage}
                                            className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                                            aria-label="Rimuovi immagine"
                                        >
                                            <XCircleIcon className="w-6 h-6"/>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center">
                                        <label htmlFor="problem-image-upload" className="cursor-pointer flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-600 rounded-md hover:border-blue-500 transition-colors">
                                            <div className="text-center">
                                                <PhotoIcon className="mx-auto h-8 w-8 text-gray-500"/>
                                                <p className="mt-1 text-sm text-gray-400">Clicca per selezionare un'immagine</p>
                                            </div>
                                        </label>
                                        <input 
                                            ref={fileInputRef}
                                            type="file" 
                                            id="problem-image-upload" 
                                            accept="image/*"
                                            onChange={(e) => setProblemImage(e.target.files ? e.target.files[0] : null)} 
                                            className="hidden"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
                <div className="flex flex-wrap items-center gap-4">
                    <Tooltip text={mechanicMode === 'diagnose' ? 'Invia la descrizione per ottenere una diagnosi dall\'IA' : 'Genera una checklist di manutenzione per il tuo prossimo viaggio'}>
                        <ActionButton 
                            type="submit" 
                            disabled={!activeVehicle || (mechanicMode === 'maintenance' && tripHistory.length === 0)} 
                            loading={isLoading}
                            loadingText={mechanicMode === 'diagnose' ? 'Analisi...' : 'Generazione...'}
                        >
                            {mechanicMode === 'diagnose' ? 'Ottieni Diagnosi' : 'Genera Checklist'}
                        </ActionButton>
                    </Tooltip>
                    {mechanicMode === 'diagnose' && (
                        <Tooltip text="Visualizza le diagnosi salvate per il veicolo attivo">
                            <ActionButton 
                                type="button" 
                                onClick={() => setShowHistoryModal(true)} 
                                disabled={isLoading || !activeVehicle || vehicleDiagnoses.length === 0} 
                                className="bg-gray-600 hover:bg-gray-500"
                            >
                                <DocumentTextIcon className="w-5 h-5"/> Storico Diagnosi
                            </ActionButton>
                        </Tooltip>
                    )}
                </div>
            </form>
            
            <div className="mt-6">
                {isLoading && (
                     <div className="bg-gray-700/50 p-4 rounded-lg text-center animate-pulse" aria-live="polite">
                        <p className="font-semibold text-white">
                            {mechanicMode === 'diagnose' ? "L'IA sta elaborando la diagnosi..." : "L'IA sta generando la checklist..."}
                        </p>
                    </div>
                )}
                
                {!isLoading && mechanicMode === 'diagnose' && diagnosis && (
                    <div className="bg-gray-700/50 p-4 rounded-lg animate-fade-in">
                        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                            <h3 className="text-xl font-bold text-white">Risultato Diagnosi</h3>
                            <div className="flex items-center gap-2 flex-wrap">
                                {savedConfirmation && <span className="text-green-400 text-sm animate-pulse mr-2">{savedConfirmation}</span>}
                                <Tooltip text={activeDiagnosisId ? 'Aggiorna la diagnosi salvata con il risultato corrente' : 'Salva questa diagnosi nello storico del veicolo'}>
                                    <ActionButton onClick={handleSaveOrUpdateDiagnosis}>
                                        <ArchiveBoxIcon className="w-5 h-5"/> {activeDiagnosisId ? 'Aggiorna' : 'Salva'} Diagnosi
                                    </ActionButton>
                                </Tooltip>
                                <Tooltip text="Esporta la diagnosi corrente in un file PDF">
                                    <ActionButton 
                                        onClick={handleDownloadDiagnosisPdf} 
                                        loading={isGeneratingDiagnosisPdf} 
                                        loadingText="Creando..."
                                        className="bg-teal-600 hover:bg-teal-500"
                                    >
                                        <ArrowDownTrayIcon className="w-5 h-5"/> Scarica PDF
                                    </ActionButton>
                                </Tooltip>
                            </div>
                        </div>
                        <div className="whitespace-pre-wrap">{diagnosis}</div>
                    </div>
                )}
                
                {!isLoading && mechanicMode === 'maintenance' && maintenanceTips && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="text-xl font-bold text-white">Checklist Manutenzione</h3>
                             <Tooltip text="Esporta la checklist corrente in un file PDF">
                                <ActionButton
                                    onClick={handleDownloadChecklistPdf}
                                    loading={isGeneratingChecklistPdf}
                                    loadingText="Creando..."
                                    className="bg-teal-600 hover:bg-teal-500"
                                >
                                    <ArrowDownTrayIcon className="w-5 h-5"/> Scarica PDF
                                </ActionButton>
                            </Tooltip>
                        </div>
                        <div className="space-y-4">
                            <MaintenanceList title="Controlli Essenziali" items={maintenanceTips.essentialChecks} />
                            <MaintenanceList title="Suggerimenti Specifici per il Viaggio" items={maintenanceTips.tripSpecificTips} />
                            <MaintenanceList title="Equipaggiamento d'Emergenza" items={maintenanceTips.emergencyEquipment} />
                        </div>
                    </div>
                )}
            </div>
            </>
        )}
    </div>
    );
};

export default VirtualMechanic;
