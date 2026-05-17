import React, { useState } from 'react';
import { useAuthStore } from '../src/store/useAuthStore';
import Logo from './Logo';

export const Login: React.FC = () => {
    const { loginWithGoogle, loginWithGoogleRedirect, signUpWithEmail, loginWithEmail, resetPassword } = useAuthStore();
    const [error, setError] = useState<React.ReactNode>('');
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);

    const handleResetPassword = async () => {
        if (!email) {
            setError("Inserisci la tua email per reimpostare la password.");
            return;
        }
        setError('');
        setLoading(true);
        try {
            await resetPassword(email);
        } catch (err: any) {
            console.error("Errore reset password:", err);
            setError(err.message || "Errore durante l'invio dell'email di reset");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        setLoading(true);
        try {
            await loginWithGoogle();
        } catch (err: any) {
            console.error("Errore login Google (Popup) - Dettagli completi:", err);
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
            console.error("Errore login Google (Redirect) - Dettagli completi:", err);
            setError(err.message || "Si è verificato un errore durante l'accesso con Google");
        } finally {
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isRegistering) {
                await signUpWithEmail(email, password);
            } else {
                await loginWithEmail(email, password);
            }
        } catch (err: any) {
            console.error("Errore autenticazione Email - Dettagli completi:", err);
            let msg: React.ReactNode = err.message || "Errore durante l'autenticazione";
            
            if (err.code === 'auth/invalid-credential' || (err.message && err.message.includes('invalid-credential'))) {
                msg = (
                    <div className="space-y-2 text-left">
                        <p className="font-bold">Credenziali non valide o errore di configurazione.</p>
                        <p className="text-xs">Possibili cause:</p>
                        <ul className="list-disc ml-4 space-y-1 text-[11px] opacity-90">
                            <li><strong>Password errata:</strong> Se l'account esiste già, la password inserita non è corretta.</li>
                            <li><strong>Account Google:</strong> Se ti sei registrato con Google, non hai una password. Usa "Password dimenticata" per impostarne una o usa il login Google.</li>
                            <li><strong>Identità Multi-Tenant:</strong> Se hai abilitato Identity Platform, Firebase potrebbe richiedere una configurazione aggiuntiva.</li>
                            <li><strong>Dominio non autorizzato:</strong> Verifica che <code className="bg-white/10 px-1">moto-mentor-ai.vercel.app</code> sia tra i domini autorizzati in Firebase Console &rarr; Auth &rarr; Settings.</li>
                        </ul>
                        <div className="mt-2 pt-2 border-t border-red-400/20">
                            <p className="text-[10px] italic">Controlla la console del browser (F12) per i dettagli tecnici dell'errore.</p>
                        </div>
                    </div>
                );
            } else if (err.code === 'auth/email-already-in-use') {
                msg = "Questa email è già registrata. Prova ad accedere invece di registrarti.";
            } else if (err.code === 'auth/weak-password') {
                msg = "La password deve essere di almeno 6 caratteri.";
            }
            
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const isMissingInitialState = typeof error === 'string' && error.includes('missing initial state');

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
                                <div className="font-bold">Errore di accesso:</div>
                                <div>{error}</div>
                                <div className="text-xs opacity-80 space-y-1">
                                    <p>Dominio corrente: <code className="bg-black/30 px-1 rounded">{window.location.hostname}</code></p>
                                    {isMissingInitialState ? (
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

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-700" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="px-2 bg-gray-800 text-gray-400 uppercase">Oppure continua con email</span>
                            </div>
                        </div>

                        <form onSubmit={handleEmailAuth} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="iltuonome@esempio.it"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-medium text-gray-400">Password</label>
                                    {!isRegistering && (
                                        <button 
                                            type="button"
                                            onClick={handleResetPassword}
                                            className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            Password dimenticata?
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="••••••••"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all font-bold"
                            >
                                {loading ? 'Attendere...' : (isRegistering ? 'Registrati' : 'Accedi')}
                            </button>
                        </form>

                        <div className="text-center">
                            <button
                                onClick={() => {
                                    setIsRegistering(!isRegistering);
                                    setError('');
                                }}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                {isRegistering ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati qui'}
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
