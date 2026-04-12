import React, { useState } from 'react';
import { useAppContext } from '../state/AppContext';
import Logo from './Logo';

export const Login: React.FC = () => {
    const { loginWithGoogle, loginWithGoogleRedirect } = useAppContext();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setError('');
        setLoading(true);
        try {
            await loginWithGoogle();
        } catch (err: any) {
            console.error("Errore login Google (Popup):", err);
            setError(err.message || "Si è verificato un errore durante l'accesso con Google");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLoginRedirect = async () => {
        setError('');
        setLoading(true);
        try {
            await loginWithGoogleRedirect();
        } catch (err: any) {
            console.error("Errore login Google (Redirect):", err);
            setError(err.message || "Si è verificato un errore durante l'accesso con Google");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <Logo className="w-16 h-16 mx-auto mb-4" />
                <h2 className="text-3xl font-extrabold text-white">
                    MotoMentor AI
                </h2>
                <p className="mt-2 text-sm text-gray-400">
                    Accedi per pianificare i tuoi viaggi e gestire la tua moto
                </p>
                <div className="mt-4 p-2 bg-blue-900/30 border border-blue-500/50 rounded text-[10px] text-blue-200">
                    <p>💡 Se sei su smartphone e riscontri problemi, prova ad aprire l'app in una nuova scheda del browser.</p>
                </div>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-700">
                    <div className="space-y-6">
                        {error && (
                            <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded text-sm space-y-2">
                                <p className="font-bold">Errore di accesso:</p>
                                <p>{error}</p>
                                <div className="text-xs opacity-80 space-y-1">
                                    <p>Dominio corrente: <code className="bg-black/30 px-1 rounded">{window.location.hostname}</code></p>
                                    {error.includes('missing initial state') ? (
                                        <p className="text-yellow-300 font-semibold mt-2">
                                            Suggerimento: Su smartphone, usa il pulsante principale "Accedi con Google" (Popup). Se non funziona, prova ad aprire l'app nel browser esterno (Safari/Chrome) invece che dall'anteprima di AI Studio.
                                        </p>
                                    ) : (
                                        <>
                                            <p>Assicurati che questo dominio sia in "Authorized domains" su Firebase.</p>
                                            <p>Se il problema persiste, prova ad aprire l'app in una nuova scheda o usa una finestra in incognito.</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        <div>
                            <button
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full flex justify-center items-center gap-3 py-3 px-4 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all"
                            >
                                {loading ? (
                                    'Attendere...'
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            />
                                        </svg>
                                        Accedi con Google
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleGoogleLoginRedirect}
                                disabled={loading}
                                className="mt-3 w-full flex justify-center items-center gap-3 py-2 px-4 border border-transparent rounded-md text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-700/50 focus:outline-none transition-all"
                            >
                                Problemi con il popup? Prova il redirect
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-xs text-gray-500">
                            Accedendo, accetti i nostri termini di servizio e la nostra informativa sulla privacy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
