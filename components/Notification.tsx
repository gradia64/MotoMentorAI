
import React from 'react';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
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

    let bgColor = '';
    let borderColor = '';
    let Icon = null;

    switch (notification.type) {
        case 'success':
            bgColor = 'bg-green-600/90 text-white';
            borderColor = 'border-green-500';
            Icon = CheckCircleIcon;
            break;
        case 'warning':
            bgColor = 'bg-orange-600/90 text-white';
            borderColor = 'border-orange-500';
            Icon = ExclamationTriangleIcon;
            break;
        case 'error':
        default:
            bgColor = 'bg-red-600/90 text-white';
            borderColor = 'border-red-500';
            Icon = XCircleIcon;
            break;
    }

    return (
        <div 
            className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 max-w-sm p-4 rounded-lg shadow-2xl animate-fade-in-up
                ${bgColor}
                border ${borderColor}`}
            role="alert"
        >
            <Icon className="w-6 h-6 flex-shrink-0" />
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
