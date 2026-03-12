import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, User, KeyRound, Check, Cat, Dog, Bug, Ghost, Snail, Squirrel, Github, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const AVATARS = [
    { id: 'fox',    icon: <Cat size={24} color="#f97316" /> },
    { id: 'cat',    icon: <Cat size={24} color="#a8a29e" /> },
    { id: 'dog',    icon: <Dog size={24} color="#d97706" /> },
    { id: 'panda',  icon: <Bug size={24} color="#10b981" /> },
    { id: 'koala',  icon: <Snail size={24} color="#8b5cf6" /> },
    { id: 'lion',   icon: <Squirrel size={24} color="#f59e0b" /> },
    { id: 'tiger',  icon: <Cat size={24} color="#ef4444" /> },
    { id: 'monkey', icon: <Github size={24} color="#6366f1" /> },
    { id: 'unicorn',icon: <Sparkles size={24} color="#ec4899" /> },
    { id: 'alien',  icon: <Ghost size={24} color="#14b8a6" /> },
];

const Profile: React.FC = () => {
    const { user, loadUser } = useAuth();
    const navigate = useNavigate();

    // Profile tab states
    const [name, setName] = useState(user?.name || '');
    const [avatar, setAvatar] = useState(user?.avatar || 'fox');
    const [savingProfile, setSavingProfile] = useState(false);

    // Password tab states
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);

    const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        try {
            const { data } = await api.patch('/api/auth/me', { name, avatar });
            localStorage.setItem('@Famask:user', JSON.stringify(data.user));
            loadUser();
            toast.success('Perfil atualizado com sucesso!');
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Erro ao salvar perfil.');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmNewPassword) {
            toast.error('As senhas não coincidem.');
            return;
        }
        setSavingPassword(true);
        try {
            await api.post('/api/auth/change-password', { currentPassword, newPassword });
            toast.success('Senha alterada com sucesso!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Erro ao alterar senha.');
        } finally {
            setSavingPassword(false);
        }
    };

    const tabStyle = (active: boolean): React.CSSProperties => ({
        flex: 1,
        padding: '10px',
        background: active ? 'var(--primary)' : 'transparent',
        color: active ? 'white' : 'var(--text-secondary)',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        fontSize: '0.9rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.2s',
    });

    return (
        <div style={{ padding: '40px 20px', maxWidth: '520px', margin: '0 auto', width: '100%' }}>

            {/* Header */}
            <header style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
                <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ padding: '8px' }}>
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="title" style={{ margin: 0, fontSize: '1.8rem' }}>Meu Perfil</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>{user?.email}</p>
                </div>
            </header>

            {/* Tab switcher */}
            <div className="glass" style={{ display: 'flex', gap: '8px', padding: '6px', borderRadius: 'var(--radius-lg)', marginBottom: '32px' }}>
                <button style={tabStyle(activeTab === 'profile')} onClick={() => setActiveTab('profile')}>
                    <User size={16} /> Perfil
                </button>
                <button style={tabStyle(activeTab === 'password')} onClick={() => setActiveTab('password')}>
                    <KeyRound size={16} /> Senha
                </button>
            </div>

            {/* Profile Tab */}
            {activeTab === 'profile' && (
                <div className="glass glass-card animate-in">
                    <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Nome</label>
                            <input
                                type="text"
                                className="form-input"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                minLength={2}
                                required
                            />
                        </div>

                        <div>
                            <label className="form-label">Avatar</label>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                                {AVATARS.map(av => (
                                    <button
                                        key={av.id}
                                        type="button"
                                        onClick={() => setAvatar(av.id)}
                                        title={av.id}
                                        style={{
                                            width: '52px',
                                            height: '52px',
                                            borderRadius: '50%',
                                            border: avatar === av.id ? '2px solid var(--primary)' : '2px solid transparent',
                                            background: avatar === av.id ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.05)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            position: 'relative',
                                        }}
                                    >
                                        {av.icon}
                                        {avatar === av.id && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: -2, right: -2,
                                                background: 'var(--primary)',
                                                borderRadius: '50%',
                                                width: '16px', height: '16px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <Check size={10} color="white" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={savingProfile} style={{ width: '100%', padding: '12px' }}>
                            {savingProfile ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </form>
                </div>
            )}

            {/* Password Tab */}
            {activeTab === 'password' && (
                <div className="glass glass-card animate-in">
                    <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Senha Atual</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Nova Senha</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                minLength={6}
                                required
                            />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Confirmar Nova Senha</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={confirmNewPassword}
                                onChange={e => setConfirmNewPassword(e.target.value)}
                                minLength={6}
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={savingPassword} style={{ width: '100%', padding: '12px' }}>
                            {savingPassword ? 'Alterando...' : 'Alterar Senha'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Profile;
