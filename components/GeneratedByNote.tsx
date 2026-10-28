import React from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { formatModelName } from '../src/utils/itinerary';

// Nota in fondo al viaggio con il modello IA che lo ha pianificato. I viaggi
// creati prima del campo generatedBy non la mostrano.
const GeneratedByNote: React.FC<{ model?: string }> = ({ model }) => {
    if (!model) return null;
    return (
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-500">
            <SparklesIcon className="w-4 h-4" />
            Viaggio pianificato da {formatModelName(model)}
        </p>
    );
};

export default GeneratedByNote;
