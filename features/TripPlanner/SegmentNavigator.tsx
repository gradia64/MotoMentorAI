import React, { useState } from 'react';
import { createNavigationSegments, generateGpxFile, downloadFile } from '../../utils/mapsHelpers';
import { Day } from '../../types';
import { useEscapeKey } from '../../utils/hooks';
import { XMarkIcon, ArrowRightIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import ActionButton from '../../components/ActionButton';

interface SegmentNavigatorProps {
    day: Day;
    onClose: () => void;
}

export const SegmentNavigator: React.FC<SegmentNavigatorProps> = ({ day, onClose }) => {
    useEscapeKey(onClose);
    
    const points = day.gpxTrack || [];
    // Fix: The second argument to createNavigationSegments must be an options object.
    const segments = createNavigationSegments(points, { maxWaypointsPerSegment: 9 });
    const [currentSegment, setCurrentSegment] = useState(0);

    const handleNavigateSegment = (index: number) => {
        if (segments[index]) {
            window.open(segments[index].mapUrl, '_blank');
        }
    };

    const handleNextSegment = () => {
        if (currentSegment < segments.length - 1) {
            const nextIndex = currentSegment + 1;
            setCurrentSegment(nextIndex);
            handleNavigateSegment(nextIndex);
        }
    };

    const handleDownloadGpx = () => {
        const gpx = generateGpxFile(day);
        downloadFile(
            gpx,
            `Giorno_${day.day}_${day.stageTitle.replace(/\s/g, '_')}.gpx`,
            'application/gpx+xml'
        );
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-white">
                        Navigazione Tappa: Giorno {day.day}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                        aria-label="Chiudi navigatore"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Info Alert */}
                <div className="p-4 border-b border-gray-700 flex-shrink-0">
                    <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
                        <div className="flex gap-3">
                            <div className="text-blue-300 text-2xl flex-shrink-0 mt-0.5">ℹ️</div>
                            <div>
                                <h3 className="font-semibold text-blue-300 mb-1">Perché la navigazione a segmenti?</h3>
                                <p className="text-sm text-blue-400">
                                    Google Maps ha un limite di 10 punti per ogni link di navigazione. Il tuo percorso è stato 
                                    diviso in <strong>{segments.length} segmenti</strong>. Navigali uno alla volta, 
                                    oppure scarica il file GPX completo per il tuo navigatore GPS.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Progress Bar & Segments List */}
                <div className="flex-grow overflow-y-auto p-4">
                    <div className="mb-2 flex items-center justify-between text-sm text-gray-400">
                        <span>Avanzamento</span>
                        <span>{currentSegment + 1} / {segments.length}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                        <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${((currentSegment + 1) / segments.length) * 100}%` }}
                        />
                    </div>
                    
                    <div className="space-y-3">
                        {segments.map((segment, index) => {
                            const isActive = index === currentSegment;
                            const isCompleted = index < currentSegment;

                            return (
                                <div 
                                    key={index}
                                    className={`rounded-lg p-3 border-2 transition-all ${
                                        isActive 
                                            ? 'bg-blue-600/20 border-blue-500' 
                                            : isCompleted
                                            ? 'bg-green-600/20 border-green-500/50'
                                            : 'bg-gray-700 border-gray-600'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                                                isActive 
                                                    ? 'bg-blue-600 text-white' 
                                                    : isCompleted
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-gray-600 text-gray-300'
                                            }`}>
                                                {isCompleted ? '✓' : index + 1}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-white">
                                                    Segmento {segment.segmentNumber}
                                                    {isActive && <span className="ml-2 text-xs font-medium text-blue-400 bg-blue-900/50 px-2 py-0.5 rounded-full">Attuale</span>}
                                                </h3>
                                                <p className="text-sm text-gray-400">
                                                    {segment.pointCount} punti intermedi
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <ActionButton
                                            onClick={() => {
                                                setCurrentSegment(index);
                                                handleNavigateSegment(index);
                                            }}
                                            className={`text-xs py-1 px-2 ${isActive ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}
                                        >
                                            {isCompleted ? 'Riapri' : 'Apri Mappa'}
                                        </ActionButton>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-700 space-y-3 flex-shrink-0">
                    {currentSegment < segments.length - 1 ? (
                        <ActionButton
                            onClick={handleNextSegment}
                            className="w-full"
                        >
                            Naviga Segmento Successivo <ArrowRightIcon className="w-5 h-5"/>
                        </ActionButton>
                    ) : (
                        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 text-center">
                            <p className="text-green-300 font-semibold">🎉 Tutti i segmenti completati!</p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <ActionButton
                            onClick={handleDownloadGpx}
                            className="flex-1 bg-gray-700 hover:bg-gray-600"
                        >
                            <ArrowDownTrayIcon className="w-5 h-5"/>
                            Download GPX
                        </ActionButton>
                        <ActionButton
                            onClick={onClose}
                            className="flex-1 bg-gray-700 hover:bg-gray-600"
                        >
                            Chiudi
                        </ActionButton>
                    </div>

                    <p className="text-xs text-gray-500 text-center pt-2">
                        💡 Suggerimento: Scarica il file GPX per usarlo con Garmin, TomTom, o altre app di navigazione.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SegmentNavigator;