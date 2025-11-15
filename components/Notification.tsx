import React from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useAppContext } from '../state/AppContext';

const Notification: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { notification } = state;

    React.useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                dispatch({ type: 'SET_NOTIFICATION', payload: null });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [notification, dispatch]);

    if (!notification) {
        return null;
    }

    const isSuccess = notification.type === 'success';

    return (
        <div 
            className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 max-w-sm p-4 rounded-lg shadow-2xl animate-fade-in-up
                ${isSuccess ? 'bg-green-600/90 text-white' : 'bg-red-600/90 text-white'}
                border ${isSuccess ? 'border-green-500' : 'border-red-500'}`
            }
            role="alert"
        >
            {isSuccess ? (
                <CheckCircleIcon className="w-6 h-6 flex-shrink-0" />
            ) : (
                <XCircleIcon className="w-6 h-6 flex-shrink-0" />
            )}
            <p className="text-sm font-semibold">{notification.message}</p>
            <button 
                onClick={() => dispatch({ type: 'SET_NOTIFICATION', payload: null })}
                className="ml-auto -mr-1 p-1 rounded-full hover:bg-white/20 transition-colors"
                aria-label="Chiudi notifica"
            >
                <XCircleIcon className="w-5 h-5" />
            </button>
        </div>
    );
};

export default Notification;
