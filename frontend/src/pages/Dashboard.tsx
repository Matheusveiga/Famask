import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Users, LayoutDashboard, Home, ArrowRight, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

interface Group {
    id: string;
    name: string;
    members: Array<{ user: { id: string; name: string } }>;
}

const AVATAR_MAP: Record<string, string> = {
    fox: '🦊', cat: '🐱', dog: '🐶', panda: '🐼', koala: '🐨',
    lion: '🦁', tiger: '🐯', monkey: '🐵', unicorn: '🦄', alien: '👽'
};

const Dashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [newGroupName, setNewGroupName] = useState('');
    const [creating, setCreating] = useState(false);

    const [joinGroupId, setJoinGroupId] = useState('');
    const [joining, setJoining] = useState(false);

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
            navigate(`/group/${data.id}`);
        } catch (err) {
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    const handleJoinGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinGroupId.trim()) return;

        setJoining(true);
        try {
            const { data } = await api.post('/api/groups/join', { groupId: joinGroupId.trim() });
            navigate(`/group/${data.groupId}`);
            toast.success('Entrou no grupo com sucesso!');
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Erro ao entrar no grupo. Verifique o ID.');
        } finally {
            setJoining(false);
        }
    };

    return (
        <div style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>

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
                        <h1 className="title" style={{ margin: 0, fontSize: '2rem' }}>Meus Grupos Familiares</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <span style={{ fontSize: '1.4rem' }}>{user?.avatar ? AVATAR_MAP[user.avatar] : '👤'}</span>
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
                            placeholder="Nome da Família"
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
                    <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>Entrar com ID da Família</h3>
                    <form onSubmit={handleJoinGroup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Cole o ID da Família aqui"
                            value={joinGroupId}
                            onChange={e => setJoinGroupId(e.target.value)}
                            required
                        />
                        <button type="submit" className="btn btn-secondary" disabled={joining} style={{ width: '100%', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                            <Users size={18} /> Entrar
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
                    <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Nenhuma família encontrada</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                        Crie um novo grupo acima ou peça o ID de convite para um membro de uma família já existente.
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
