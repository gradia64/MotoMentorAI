import React, { useState } from 'react';
import { useAppContext } from '../state/AppContext';
import Logo from './Logo';

export const Login: React.FC = () => {
    const { login, register } = useAppContext();
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                await login(username, password);
            } else {
                if (password !== confirmPassword) {
                    throw new Error("Le password non corrispondono");
                }
                await register(username, password);
            }
        } catch (err: any) {
            setError(err.message || "Si è verificato un errore");
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
                    {isLogin ? 'Accedi al tuo account' : 'Crea un nuovo account'}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-700">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded text-sm">
                                {error}
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-300">
                                Nome utente
                            </label>
                            <div className="mt-1">
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-700 text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300">
                                Password
                            </label>
                            <div className="mt-1">
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-700 text-white"
                                />
                            </div>
                        </div>

                        {!isLogin && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300">
                                    Conferma password
                                </label>
                                <div className="mt-1">
                                    <input
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-700 text-white"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {loading ? 'Attendere...' : (isLogin ? 'Accedi' : 'Registrati')}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-600" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-gray-800 text-gray-400">
                                    Oppure
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 text-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsLogin(!isLogin);
                                    setError('');
                                }}
                                className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                            >
                                {isLogin ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
