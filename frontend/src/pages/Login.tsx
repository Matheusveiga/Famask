import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus } from 'lucide-react';

const AVATARS = [
    { id: 'fox', emoji: '🦊' },
    { id: 'cat', emoji: '🐱' },
    { id: 'dog', emoji: '🐶' },
    { id: 'panda', emoji: '🐼' },
    { id: 'koala', emoji: '🐨' },
    { id: 'lion', emoji: '🦁' },
    { id: 'tiger', emoji: '🐯' },
    { id: 'monkey', emoji: '🐵' },
    { id: 'unicorn', emoji: '🦄' },
    { id: 'alien', emoji: '👽' }
];

const Login: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [avatar, setAvatar] = useState('fox');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { loadUser } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
            const payload = isLogin ? { email, password } : { name, email, password, avatar };

            const { data } = await api.post(endpoint, payload);

            localStorage.setItem('@Famask:token', data.token);
            localStorage.setItem('@Famask:user', JSON.stringify(data.user));
            loadUser();
            navigate('/');
        } catch (err: any) {
            if (err.response?.data?.error) {
                if (Array.isArray(err.response.data.error)) {
                    setError('Dados inválidos. Verifique os campos.');
                } else {
                    setError(err.response.data.error);
                }
            } else {
                setError('Erro na conexão com o servidor.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <div className="glass glass-card animate-in" style={{ width: '100%', maxWidth: '420px', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 className="title" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Famask</h1>
                    <p className="subtitle" style={{ fontSize: '0.95rem', margin: 0 }}>
                        {isLogin ? 'Bem-vindo de volta à sua família.' : 'Crie sua conta familiar.'}
                    </p>
                </div>

                {error && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.9rem', textAlign: 'center' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {!isLogin && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Nome</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Seu nome"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required={!isLogin}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Escolha um Avatar</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '16px' }}>
                                    {AVATARS.map(av => (
                                        <button
                                            key={av.id}
                                            type="button"
                                            onClick={() => setAvatar(av.id)}
                                            style={{
                                                fontSize: '1.8rem',
                                                padding: '8px',
                                                background: avatar === av.id ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                                border: avatar === av.id ? '2px solid white' : '2px solid transparent',
                                                borderRadius: '50%',
                                                cursor: 'pointer',
                                                width: '50px',
                                                height: '50px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {av.emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label className="form-label">E-mail</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="seu@email.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '24px' }}>
                        <label className="form-label">Senha</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '12px' }}
                        disabled={loading}
                    >
                        {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                        {loading ? 'Aguarde...' : (isLogin ? 'Entrar' : 'Registrar')}
                    </button>
                </form>

                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    <button
                        type="button"
                        className="btn"
                        style={{ background: 'transparent', color: 'var(--text-secondary)', padding: 0 }}
                        onClick={() => { setIsLogin(!isLogin); setError(''); }}
                    >
                        {isLogin ? 'Não tem uma conta? Registre-se.' : 'Já tem uma conta? Entre.'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
