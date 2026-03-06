import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Users, LayoutDashboard, Home, ArrowRight, LogOut, Download, Cat, Dog, Bug, Ghost, Snail, Squirrel, Github, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface Group {
    id: string;
    name: string;
    members: Array<{ user: { id: string; name: string } }>;
}

interface BeforeInstallPromptEvent extends Event {
    prompt: () => void;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const AVATAR_MAP: Record<string, React.ReactNode> = {
    fox: <Cat size={20} color="#f97316" />,
    cat: <Cat size={20} color="#a8a29e" />,
    dog: <Dog size={20} color="#d97706" />,
    panda: <Bug size={20} color="#10b981" />,
    koala: <Snail size={20} color="#8b5cf6" />,
    lion: <Squirrel size={20} color="#f59e0b" />,
    tiger: <Cat size={20} color="#ef4444" />,
    monkey: <Github size={20} color="#6366f1" />,
    unicorn: <Sparkles size={20} color="#ec4899" />,
    alien: <Ghost size={20} color="#14b8a6" />
};

const Dashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [newGroupName, setNewGroupName] = useState('');
    const [creating, setCreating] = useState(false);

    const [joinCode, setJoinCode] = useState('');
    const [joining, setJoining] = useState(false);

    // PWA Install Logic
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isStandalone, setIsStandalone] = useState(false);
    const [showInstallModal, setShowInstallModal] = useState(false);

    useEffect(() => {
        const checkStandalone = () => {
            return window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone);
        };
        setIsStandalone(checkStandalone());

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setIsStandalone(true);
            }
            setDeferredPrompt(null);
        } else {
            setShowInstallModal(true);
        }
    };

    const navigate = useNavigate();

    const fetchGroups = async () => {
        try {
            const { data } = await api.get('/api/groups');
            setGroups(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;

        setCreating(true);
        try {
            const { data } = await api.post('/api/groups', { name: newGroupName });
            toast.success('Grupo criado com sucesso!');
            navigate(`/group/${data.id}`);
        } catch (err: unknown) {
            console.error(err);
            const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Erro ao criar grupo.';
            toast.error(message);
        } finally {
            setCreating(false);
        }
    };

    const handleJoinGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim()) return;

        setJoining(true);
        try {
            const { data } = await api.post('/api/groups/join', { inviteCode: joinCode.trim().toUpperCase() });
            navigate(`/group/${data.groupId}`);
            toast.success('Entrou no Grupo com sucesso!');
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Erro ao entrar. Verifique o código.');
        } finally {
            setJoining(false);
        }
    };

    return (
        <div style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>

            {/* Custom Install Modal for iOS / Default */}
            {showInstallModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: '20px'
                }}>
                    <div className="glass glass-card animate-in" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '16px', borderRadius: '50%', marginBottom: '16px' }}>
                            <Download size={32} color="var(--primary)" />
                        </div>
                        <h3 style={{ marginBottom: '16px', fontSize: '1.4rem' }}>Instalar o Aplicativo</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem', lineHeight: '1.5' }}>
                            Instale o Famask para ter acesso rápido direto da sua tela inicial, assim como um aplicativo nativo.
                        </p>

                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px', textAlign: 'left', marginBottom: '24px', width: '100%' }}>
                            <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>🍎 <strong>iOS (iPhone/iPad):</strong></p>
                            <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Abra no Safari, toque no ícone de <strong>Compartilhar</strong> (quadrado com seta pra cima) e selecione <strong>"Adicionar à Tela de Início"</strong>.</p>

                            <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>🤖 <strong>Android:</strong></p>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Toque nos três pontinhos do navegador e selecione <strong>"Adicionar à Tela Inicial"</strong> ou "Instalar Aplicativo".</p>
                        </div>

                        <button className="btn btn-primary" onClick={() => setShowInstallModal(false)} style={{ width: '100%' }}>
                            Entendi!
                        </button>
                    </div>
                </div>
            )}

            {/* Professional Header / Hero */}
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '48px',
                paddingBottom: '24px',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', color: 'var(--primary)' }}>
                        <LayoutDashboard size={32} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h1 className="title" style={{ margin: 0, fontSize: '2rem' }}>Meus Grupos</h1>
                            {!isStandalone && (
                                <button
                                    onClick={handleInstallClick}
                                    className="animate-in"
                                    style={{
                                        background: 'var(--success)',
                                        color: 'white',
                                        border: 'none',
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                                    }}
                                >
                                    <Download size={14} /> Instalar App
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}>
                                {user?.avatar ? AVATAR_MAP[user.avatar] : <LayoutDashboard size={20} />}
                            </div>
                            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1.1rem' }}>
                                Olá, {user?.name || 'Visitante'}
                            </p>
                        </div>
                    </div>
                </div>
                <button className="btn btn-secondary" onClick={logout}>
                    <LogOut size={16} /> Sair
                </button>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '48px' }}>
                {/* Create new Group Card */}
                <div className="glass glass-card animate-in" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>Criar Novo Grupo</h3>
                    <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Nome do Grupo (Ex: Casa, Projeto X)"
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            required
                        />
                        <button type="submit" className="btn btn-primary" disabled={creating} style={{ width: '100%' }}>
                            <Plus size={18} /> Criar
                        </button>
                    </form>
                </div>

                {/* Join Group Card */}
                <div className="glass glass-card animate-in" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', animationDelay: '0.05s' }}>
                    <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>Tem um código de Convite?</h3>
                    <form onSubmit={handleJoinGroup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ex: ABC123"
                            value={joinCode}
                            onChange={e => setJoinCode(e.target.value.toUpperCase())}
                            maxLength={6}
                            required
                        />
                        <button type="submit" className="btn btn-secondary" disabled={joining} style={{ width: '100%', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                            <Users size={18} /> Entrar no Grupo
                        </button>
                    </form>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Carregando seus grupos...</div>
            ) : groups.length === 0 ? (
                <div className="animate-in" style={{
                    textAlign: 'center',
                    padding: '64px 24px',
                    background: 'var(--glass-bg)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px dashed var(--border-color)'
                }}>
                    <Home size={48} color="var(--text-secondary)" style={{ opacity: 0.5, marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Nenhum grupo encontrado</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                        Crie um novo grupo acima ou peça o código de convite para participar de um grupo existente.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {groups.map((group, index) => (
                        <div
                            key={group.id}
                            className="glass glass-card animate-in"
                            style={{
                                cursor: 'pointer',
                                animationDelay: `${index * 0.1}s`,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                            }}
                            onClick={() => navigate(`/group/${group.id}`)}
                        >
                            <div>
                                <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>{group.name}</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Users size={14} /> {group.members?.length || 0} Membros
                                </p>
                            </div>
                            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                                <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', fontWeight: 500 }}>
                                    Acessar <ArrowRight size={16} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Dashboard;
