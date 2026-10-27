import React, { useState } from 'react';
import { KeyIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../src/store/useAuthStore';
import { useUIStore } from '../src/store/useUIStore';
import Logo from './Logo';

export const Login: React.FC = () => {
    const { register, login } = useAuthStore();
    const [error, setError] = useState<React.ReactNode>('');
    const [loading, setLoading] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        // Validazione client: stessi minimi imposti dal main process.
        if (username.trim().length < 3) {
            setError('Il nome utente deve avere almeno 3 caratteri.');
            return;
        }
        if (password.length < 6) {
            setError('La password deve avere almeno 6 caratteri.');
            return;
        }
        setLoading(true);
        try {
            if (isRegistering) {
                await register(username.trim(), password);
            } else {
                await login(username.trim(), password);
            }
        } catch (err: any) {
            console.error("Errore autenticazione - Dettagli:", err);
            setError(err.message || "Errore durante l'autenticazione");
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
                <p className="mt-1 text-[11px] text-gray-500">
                    Dati salvati localmente sul tuo dispositivo
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-700">
                    <div className="space-y-6">
                        {error && (
                            <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded text-sm">
                                <div className="font-bold">Errore:</div>
                                <div>{error}</div>
                            </div>
                        )}

                        <form onSubmit={handleEmailAuth} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Nome utente</label>
                                <input
                                    type="text"
                                    required
                                    autoComplete="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="iltuonome"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    autoComplete={isRegistering ? 'new-password' : 'current-password'}
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

                        <div className="text-center pt-2 border-t border-gray-700/50">
                            <button
                                onClick={() => useUIStore.getState().setSettingsOpen(true)}
                                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-300 transition-colors"
                                title="Configura la chiave API per le funzioni IA"
                            >
                                <KeyIcon className="w-3.5 h-3.5" />
                                Configura chiave API Gemini
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-xs text-gray-500">
                            Le tue credenziali e i tuoi dati restano sul tuo dispositivo.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
