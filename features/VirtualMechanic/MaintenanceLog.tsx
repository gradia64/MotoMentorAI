import React, { useState, FormEvent, useMemo, useEffect } from 'react';
import { MaintenanceRecord, MaintenanceType, MaintenanceReminder, GarageVehicle } from '../../types';
import { PlusCircleIcon, TrashIcon, ChevronDownIcon, CameraIcon } from '@heroicons/react/24/outline';
import ActionButton from '../../components/ActionButton';
import InputField from '../../components/InputField';
import SelectField from '../../components/SelectField';
import ReceiptScanner from './ReceiptScanner';

interface MaintenanceLogProps {
    log: MaintenanceRecord[];
    onAdd: (record: Omit<MaintenanceRecord, 'id'>) => void;
    onDelete: (id: string) => void;
    reminders: MaintenanceReminder[];
    onAddReminder: (reminder: Omit<MaintenanceReminder, 'id'>) => void;
    onDeleteReminder: (id: string) => void;
    activeVehicle: GarageVehicle | null;
}

const MaintenanceLog: React.FC<MaintenanceLogProps> = ({ log, onAdd, onDelete, reminders, onAddReminder, onDeleteReminder, activeVehicle }) => {
    // State for Maintenance Log form
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState<MaintenanceType>(MaintenanceType.Ordinary);
    const [description, setDescription] = useState('');
    const [cost, setCost] = useState('');
    const [kilometers, setKilometers] = useState('');
    const [isAddFormVisible, setIsAddFormVisible] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const handleScanConfirm = (record: Omit<MaintenanceRecord, 'id'>) => {
        onAdd(record);
    };

    useEffect(() => {
        if (activeVehicle) {
            setKilometers(activeVehicle.kilometers);
        } else {
            setKilometers('');
        }
    }, [activeVehicle]);

    // State for Sorting
    const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'cost' | 'kilometers'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

    // State for Reminder Form
    const [reminderDesc, setReminderDesc] = useState('');
    const [reminderKms, setReminderKms] = useState('');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!description.trim() || !cost || !kilometers) {
            alert("Per favore, compila tutti i campi: descrizione, costo e chilometri.");
            return;
        }
        onAdd({ date, type, description, cost: parseFloat(cost), kilometers: parseInt(kilometers, 10) });
        setDescription('');
        setCost('');
        setIsAddFormVisible(false); // Hide form after submission
    };

    const handleAddReminderSubmit = (e: FormEvent) => {
        e.preventDefault();
        const kms = parseInt(reminderKms, 10);
        if (reminderDesc.trim() && !isNaN(kms) && kms > 0) {
            onAddReminder({ description: reminderDesc, targetKilometers: kms });
            setReminderDesc('');
            setReminderKms('');
        } else {
            alert("Per favore, compila una descrizione valida e i chilometri di scadenza.");
        }
    };

    const getTypeClasses = (type: MaintenanceType) => {
        switch (type) {
            case MaintenanceType.Ordinary: return 'bg-green-500/20 text-green-300 border-green-400/50';
            case MaintenanceType.Extraordinary: return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/50';
            case MaintenanceType.Exceptional: return 'bg-red-500/20 text-red-300 border-red-400/50';
            default: return 'bg-gray-500/20 text-gray-300';
        }
    };

    const sortedLog = useMemo(() => {
        const sortableItems = [...log];
        sortableItems.sort((a, b) => {
            if (sortConfig.key === 'kilometers') {
                return sortConfig.direction === 'asc' ? a.kilometers - b.kilometers : b.kilometers - a.kilometers;
            }
            if (sortConfig.key === 'date') {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                // Fix: Corrected a typo where 'a.date' (string) was used instead of 'dateA' (number) in the arithmetic operation.
                return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
            } else { // cost
                return sortConfig.direction === 'asc' ? a.cost - b.cost : b.cost - a.cost;
            }
        });
        return sortableItems;
    }, [log, sortConfig]);
    
    const totalCost = log.reduce((sum, record) => sum + record.cost, 0);

    const isOverdue = (targetKms: number) => {
        if (!activeVehicle) return false;
        return parseInt(activeVehicle.kilometers, 10) >= targetKms;
    };

    const SortButton: React.FC<{
        label: string;
        sortKey: 'date' | 'cost' | 'kilometers';
        direction: 'asc' | 'desc';
    }> = ({ label, sortKey, direction }) => {
        const isActive = sortConfig.key === sortKey && sortConfig.direction === direction;
        return (
            <button
                onClick={() => setSortConfig({ key: sortKey, direction })}
                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                    isActive ? 'bg-blue-600 text-white font-semibold' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
            >
                {label}
            </button>
        );
    };

    return (
        <div className="animate-fade-in">
            {/* --- ADD NEW RECORD SECTION (COLLAPSIBLE) --- */}
            <div className="bg-gray-700/50 rounded-lg mb-6 overflow-hidden">
                <button
                    onClick={() => setIsAddFormVisible(!isAddFormVisible)}
                    className="w-full flex justify-between items-center p-4 text-left"
                >
                    <h3 className="text-xl font-semibold text-blue-400 flex items-center gap-2">
                        <PlusCircleIcon className="w-6 h-6"/> Aggiungi Intervento di Manutenzione
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsScannerOpen(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                            title="Scansiona scontrino con AI"
                        >
                            <CameraIcon className="w-4 h-4" />
                            Scansiona Scontrino
                        </button>
                        <ChevronDownIcon className={`w-6 h-6 text-gray-400 transition-transform ${isAddFormVisible ? 'rotate-180' : ''}`} />
                    </div>
                </button>
                {isAddFormVisible && (
                    <div className="p-4 border-t border-gray-700 animate-fade-in">
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField id="logDate" label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                            <SelectField id="logType" label="Tipo Intervento" value={type} onChange={(e) => setType(e.target.value as MaintenanceType)}>
                                {Object.values(MaintenanceType).map(t => <option key={t} value={t}>{t}</option>)}
                            </SelectField>
                            <InputField id="logKilometers" label="Km al momento del lavoro" type="number" value={kilometers} onChange={(e) => setKilometers(e.target.value)} required placeholder={`Es. ${activeVehicle ? activeVehicle.kilometers : '15500'}`} />
                            <InputField id="logCost" label="Costo (€)" type="number" value={cost} onChange={(e) => setCost(e.target.value)} required placeholder="Es. 80.50" />
                            <div className="md:col-span-2">
                                <label htmlFor="logDesc" className="block text-sm font-medium text-gray-300">Descrizione Lavori</label>
                                <textarea id="logDesc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 block w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" required placeholder="Es. Cambio olio e filtro olio"></textarea>
                            </div>
                            <div className="md:col-span-2 flex items-center gap-4">
                                <ActionButton type="submit">Aggiungi Intervento</ActionButton>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* --- MAINTENANCE LOG DISPLAY --- */}
            <div>
                 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
                    <h3 className="text-xl font-semibold text-blue-400">Storico Manutenzione</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-400 text-sm font-medium">Ordina per:</span>
                        <SortButton label="Recenti" sortKey="date" direction="desc" />
                        <SortButton label="Meno Recenti" sortKey="date" direction="asc" />
                        <SortButton label="Costo (Decr)" sortKey="cost" direction="desc" />
                        <SortButton label="Costo (Cresc)" sortKey="cost" direction="asc" />
                        <SortButton label="Km (Decr)" sortKey="kilometers" direction="desc" />
                        <SortButton label="Km (Cresc)" sortKey="kilometers" direction="asc" />
                    </div>
                </div>

                 {log.length === 0 ? (
                     <p className="text-gray-400 text-center py-4">Nessun lavoro di manutenzione registrato.</p>
                 ) : (
                    <div className="space-y-3">
                        {sortedLog.map(record => (
                            <div key={record.id} className="bg-gray-700/50 p-3 rounded-lg flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
                                        <span className="font-bold text-white">{new Date(record.date).toLocaleDateString('it-IT')}</span>
                                        <span className="text-sm font-medium text-gray-400 border-l border-gray-600 pl-4">{record.kilometers.toLocaleString('it-IT')} km</span>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getTypeClasses(record.type)}`}>{record.type}</span>
                                    </div>
                                    <p className="text-gray-300">{record.description}</p>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                     <span className="font-semibold text-lg text-white mb-2">{record.cost.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span>
                                    <button onClick={() => onDelete(record.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                         <div className="mt-4 pt-4 border-t border-gray-700 text-right">
                             <span className="text-gray-400 font-medium">Spesa Totale: </span>
                             <span className="text-white font-bold text-xl">{totalCost.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span>
                         </div>
                    </div>
                 )}
            </div>

            {/* --- REMINDERS SECTION --- */}
            <div className="mt-12 pt-8 border-t border-gray-700">
             <h3 className="text-2xl font-bold mb-4">Promemoria Manutenzione</h3>
             <div className="bg-gray-700/50 p-4 rounded-lg mb-6">
                 <form onSubmit={handleAddReminderSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="md:col-span-2">
                        <InputField id="reminderDesc" label="Nuovo Promemoria" value={reminderDesc} onChange={(e) => setReminderDesc(e.target.value)} placeholder="Es. Cambio olio e filtro" required />
                     </div>
                     <InputField id="reminderKms" label="Scadenza a (km)" type="number" value={reminderKms} onChange={(e) => setReminderKms(e.target.value)} placeholder="Es. 25000" required />
                     <div className="md:col-span-3">
                        <ActionButton type="submit" className="w-full md:w-auto">Aggiungi Promemoria</ActionButton>
                     </div>
                 </form>
             </div>
             {reminders.length === 0 ? (
                 <p className="text-gray-400">Nessun promemoria impostato.</p>
             ) : (
                <div className="space-y-3">
                    {reminders.map(reminder => (
                        <div key={reminder.id} className="bg-gray-700/50 p-3 rounded-lg flex items-center justify-between gap-4">
                            <div>
                                <p className={`font-semibold ${isOverdue(reminder.targetKilometers) ? 'text-red-400' : 'text-white'}`}>{reminder.description}</p>
                                <p className="text-sm text-gray-400">Scadenza: {reminder.targetKilometers.toLocaleString('it-IT')} km</p>
                            </div>
                            <button onClick={() => onDeleteReminder(reminder.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
             )}
            </div>

            {isScannerOpen && (
                <ReceiptScanner
                    onClose={() => setIsScannerOpen(false)}
                    onConfirm={handleScanConfirm}
                    activeVehicleKilometers={activeVehicle?.kilometers}
                />
            )}
        </div>
    );
};

export default MaintenanceLog;