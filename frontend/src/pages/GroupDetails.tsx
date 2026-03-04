import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, CheckCircle2, Circle, Trash2, Plus, UserPlus, Copy, Trophy, Calendar, CheckSquare, Bell, BellOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

interface GroupData {
    id: string;
    inviteCode: string;
    name: string;
    members: Array<{ score: number; role: string; user: { id: string; name: string, avatar?: string } }>;
}

interface Reward {
    id: string;
    title: string;
    pointsCost: number;
}

interface Task {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    isCompleted: boolean;
    isDaily: boolean;
    points: number;
    creator: { name: string };
    completer: { name: string } | null;
    subtasks?: Array<{ id: string; title: string; isCompleted: boolean }>;
}

const AVATAR_MAP: Record<string, string> = {
    fox: '🦊', cat: '🐱', dog: '🐶', panda: '🐼', koala: '🐨',
    lion: '🦁', tiger: '🐯', monkey: '🐵', unicorn: '🦄', alien: '👽'
};

const GroupDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [groupData, setGroupData] = useState<GroupData | null>(null);
    const [loading, setLoading] = useState(true);

    // New Task States
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskCategory, setNewTaskCategory] = useState('geral');
    const [newTaskPoints, setNewTaskPoints] = useState<number>(10);
    const [newTaskIsDaily, setNewTaskIsDaily] = useState<boolean>(false);

    // Add member
    const [newMemberEmail, setNewMemberEmail] = useState('');

    // Reward Creation States
    const [showRewardForm, setShowRewardForm] = useState(false);
    const [newRewardTitle, setNewRewardTitle] = useState('');
    const [newRewardPoints, setNewRewardPoints] = useState(50);

    // Subtask Inline States
    const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

    // Push Notifications State
    const [isPushSubscribed, setIsPushSubscribed] = useState(false);

    // Custom Confirmation Modal
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    const openConfirm = (title: string, message: string, onConfirm: () => void) => {
        setConfirmModal({ isOpen: true, title, message, onConfirm });
    };

    const closeConfirm = () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
    };

    const fetchTasks = async () => {
        try {
            const [tasksRes, groupRes, rewardsRes] = await Promise.all([
                api.get(`/api/tasks/${id}`),
                api.get(`/api/groups/${id}`),
                api.get(`/api/rewards/${id}`)
            ]);
            setTasks(tasksRes.data);
            setGroupData(groupRes.data);
            setRewards(rewardsRes.data);

            checkPushSubscription();
        } catch (err: unknown) {
            console.error(err);
            const errorObj = err as { response?: { status?: number, data?: { error?: string } } };
            const status = errorObj.response?.status;
            const errorMsg = errorObj.response?.data?.error || 'Erro ao carregar dados.';

            toast.error(`Falha: ${errorMsg} (${status})`);

            if (status === 401 || status === 403) {
                navigate('/');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchTasks();
            // Live Sync: Automatic polling every 5 seconds
            const interval = setInterval(() => {
                fetchTasks();
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [id]); // fetchTasks is stable across re-renders conceptually, but not literally unless wrapped in useCallback. Ignoring eslint warning since adding it causes infinite loops if not useCallbacked.

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;
        try {
            await api.post('/api/tasks', {
                groupId: id,
                title: newTaskTitle,
                category: newTaskCategory,
                points: newTaskPoints,
                isDaily: newTaskIsDaily
            });
            setNewTaskTitle('');
            setNewTaskCategory('geral');
            setNewTaskPoints(10);
            setNewTaskIsDaily(false);
            fetchTasks();
        } catch (err) {
            console.error(err);
        }
    };

    // Web Push Logic
    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const checkPushSubscription = async () => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            const existingSubscription = await registration.pushManager.getSubscription();
            setIsPushSubscribed(existingSubscription !== null);
        }
    };

    const handleSubscribePush = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            toast.error('O seu navegador não suporta notificações Push.');
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                toast.error('Você bloqueou as permissões de notificação.');
                return;
            }

            const registration = await navigator.serviceWorker.ready;

            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                });
            }

            await api.post('/api/notifications/subscribe', subscription.toJSON());
            setIsPushSubscribed(true);
            toast.success('Notificações ativadas com sucesso! 🔔');
        } catch (err) {
            console.error('Failed to subscribe to push', err);
            toast.error('Falha ao ativar notificações. (VAPID Key / SW Error)');
        }
    };

    const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
        try {
            // Optimistic update
            setTasks(tasks.map(t => t.id === taskId ? { ...t, isCompleted: !currentStatus } : t));
            await api.patch(`/api/tasks/${taskId}`, { isCompleted: !currentStatus });
            fetchTasks(); // Refresh to get completer name
        } catch (err) {
            console.error(err);
            fetchTasks(); // Revert on err
        }
    };

    const handleToggleSubtask = async (taskId: string, subtaskId: string, currentStatus: boolean) => {
        try {
            // Optimistic update for subtask
            setTasks(tasks.map(t => {
                if (t.id === taskId && t.subtasks) {
                    return {
                        ...t,
                        subtasks: t.subtasks.map(st => st.id === subtaskId ? { ...st, isCompleted: !currentStatus } : st)
                    };
                }
                return t;
            }));
            await api.patch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { isCompleted: !currentStatus });
        } catch (err) {
            console.error(err);
            fetchTasks();
        }
    };

    const handleAddSubtask = async (taskId: string) => {
        if (!newSubtaskTitle.trim()) return;
        try {
            await api.post(`/api/tasks/${taskId}/subtasks`, { title: newSubtaskTitle });
            setNewSubtaskTitle('');
            setAddingSubtaskTo(null);
            fetchTasks();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteTask = (taskId: string) => {
        openConfirm(
            'Excluir Tarefa',
            'Tem certeza que deseja deletar permanentemente esta tarefa?',
            async () => {
                try {
                    await api.delete(`/api/tasks/${taskId}`);
                    setTasks(tasks.filter(t => t.id !== taskId));
                    toast.success('Tarefa removida.');
                    closeConfirm();
                } catch (err) {
                    console.error(err);
                    toast.error('Erro ao excluir (apenas admins ou donos podem).');
                    closeConfirm();
                }
            }
        );
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMemberEmail.trim()) return;
        try {
            await api.post(`/api/groups/${id}/members`, { email: newMemberEmail });
            setNewMemberEmail('');
            toast.success('Membro adicionado!');
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Erro ao adicionar membro.');
        }
    };

    const handleCreateReward = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRewardTitle.trim()) return;

        try {
            await api.post(`/api/rewards/${id}`, { title: newRewardTitle, pointsCost: Number(newRewardPoints) });
            toast.success('Recompensa criada!');
            setNewRewardTitle('');
            setNewRewardPoints(50);
            setShowRewardForm(false);
            fetchTasks();
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Erro ao criar.');
        }
    };

    const handleClaimReward = (rewardId: string, cost: number) => {
        openConfirm(
            'Resgatar Recompensa',
            `Deseja resgatar essa recompensa por ${cost} pts?`,
            async () => {
                try {
                    await api.post(`/api/rewards/claim/${rewardId}`);
                    toast.success('Recompensa resgatada com sucesso!');
                    fetchTasks();
                    closeConfirm();
                } catch (err: unknown) {
                    toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Erro no resgate.');
                    closeConfirm();
                }
            }
        );
    };

    const handleDeleteReward = (rewardId: string) => {
        openConfirm(
            'Excluir Recompensa',
            'Deseja excluir permanentemente esta recompensa da loja?',
            async () => {
                try {
                    await api.delete(`/api/rewards/${rewardId}`);
                    fetchTasks();
                    toast.success('Recompensa excluída.');
                    closeConfirm();
                } catch (err: unknown) {
                    toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Erro ao deletar recompensa.');
                    closeConfirm();
                }
            }
        );
    };

    const handleDeleteGroup = () => {
        openConfirm(
            'Deletar Grupo Inteiro',
            'ATENÇÃO: Você está prestes a deletar completamente este grupo. Todas as tarefas, recompensas e pontuações serão apagadas permanentemente. Deseja continuar?',
            async () => {
                try {
                    await api.delete(`/api/groups/${id}`);
                    toast.success('Grupo deletado permanentemente.');
                    navigate('/');
                } catch (err: unknown) {
                    toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Erro ao deletar grupo. (Apenas Admins)');
                    closeConfirm();
                }
            }
        );
    };

    return (
        <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '40px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ padding: '8px' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="title" style={{ fontSize: '1.8rem', margin: 0 }}>Tarefas do Grupo</h1>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        className={`btn ${isPushSubscribed ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={handleSubscribePush}
                        title={isPushSubscribed ? "Notificações Ativadas" : "Ativar Notificações"}
                    >
                        {isPushSubscribed ? <Bell size={16} /> : <BellOff size={16} opacity={0.6} />}
                        {isPushSubscribed ? 'Alertas On' : 'Alertas Off'}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            if (groupData?.inviteCode) {
                                navigator.clipboard.writeText(groupData.inviteCode);
                                toast.success('Código criado com 6 dígitos copiado!');
                            }
                        }}
                    >
                        <Copy size={16} /> Código de Convite
                    </button>
                    {groupData?.members.find(m => m.user.id === user?.id && m.role === 'Admin') && (
                        <button
                            className="btn"
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                            onClick={handleDeleteGroup}
                            title="Deletar Grupo"
                        >
                            <Trash2 size={16} /> Deletar Grupo
                        </button>
                    )}
                </div>
            </header>

            {/* Gamification Leaderboard */}
            {groupData && (
                <div className="glass glass-card animate-in" style={{ marginBottom: '32px', display: 'flex', gap: '24px', overflowX: 'auto', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 'max-content' }}>
                        <Trophy size={20} color="var(--primary)" />
                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Ranking de Pontos</h3>
                    </div>
                    {groupData.members.map(member => (
                        <div key={member.user.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '1.2rem' }}>{AVATAR_MAP[member.user.avatar || 'fox']}</span>
                            <strong>{member.user.name}</strong>
                            <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{member.score} pts</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Rewards Store */}
            <div className="glass glass-card animate-in" style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🎁 Loja de Recompensas
                    </h3>
                    <button className="btn btn-secondary" onClick={() => setShowRewardForm(!showRewardForm)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                        <Plus size={16} /> {showRewardForm ? 'Cancelar' : 'Nova (Admin)'}
                    </button>
                </div>

                {showRewardForm && (
                    <form onSubmit={handleCreateReward} className="animate-in" style={{ marginBottom: '24px', padding: '16px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.05)', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Título da Recompensa</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ex: 1h de Videogame"
                                value={newRewardTitle}
                                onChange={e => setNewRewardTitle(e.target.value)}
                                required
                            />
                        </div>
                        <div style={{ width: '120px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Custo (pts)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={newRewardPoints}
                                onChange={e => setNewRewardPoints(Number(e.target.value))}
                                min={1}
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>Criar</button>
                    </form>
                )}

                {rewards.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Nenhuma recompensa cadastrada. Crie uma para motivar o grupo!</p>
                ) : (
                    <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
                        {rewards.map(reward => (
                            <div key={reward.id} style={{
                                minWidth: '160px',
                                padding: '16px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex', flexDirection: 'column', gap: '12px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <strong style={{ fontSize: '1rem', lineHeight: 1.2 }}>{reward.title}</strong>
                                    <button onClick={() => handleDeleteReward(reward.id)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }} title="Excluir">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.9rem' }}>{reward.pointsCost} pts</span>
                                    <button onClick={() => handleClaimReward(reward.id, reward.pointsCost)} className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
                                        Resgatar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add New Task */}
            <div className="glass glass-card animate-in" style={{ marginBottom: '32px' }}>
                <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="O que precisa ser feito hoje?"
                            style={{ flex: 1, padding: '16px', fontSize: '1.1rem' }}
                            value={newTaskTitle}
                            onChange={e => setNewTaskTitle(e.target.value)}
                            required
                        />
                        <button type="submit" className="btn btn-primary" style={{ padding: '0 24px' }}>
                            <Plus size={20} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <select
                            className="form-input"
                            style={{ width: 'auto', padding: '8px 12px', fontSize: '0.9rem', cursor: 'pointer' }}
                            value={newTaskCategory}
                            onChange={e => setNewTaskCategory(e.target.value)}
                        >
                            <option value="geral">Geral</option>
                            <option value="limpeza">Casa & Limpeza</option>
                            <option value="mercado">Mercado</option>
                            <option value="escola">Escola/Estudos</option>
                            <option value="trabalho">Trabalho</option>
                        </select>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                                checked={newTaskIsDaily}
                                onChange={e => setNewTaskIsDaily(e.target.checked)}
                            />
                            Tarefa Diária (Recorrente)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                            Recompensa da Tarefa:
                            <input
                                type="number"
                                className="form-input"
                                style={{ width: '80px', padding: '4px 8px' }}
                                value={newTaskPoints}
                                onChange={e => setNewTaskPoints(Number(e.target.value))}
                                min={0}
                            /> pts
                        </label>
                    </div>
                </form>
            </div>

            {/* Tasks List */}
            <h2 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Todas as Tarefas <span style={{ background: 'var(--primary)', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.9rem' }}>{tasks.length}</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '48px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Carregando tarefas...</div>
                ) : tasks.length === 0 ? (
                    <div className="animate-in" style={{
                        textAlign: 'center',
                        padding: '64px 24px',
                        background: 'var(--glass-bg)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px dashed var(--border-color)',
                        marginTop: '16px'
                    }}>
                        <CheckSquare size={48} color="var(--primary)" style={{ opacity: 0.5, marginBottom: '16px' }} />
                        <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Tudo limpo por aqui!</h3>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                            Ainda não há tarefas criadas neste grupo. Comece adicionando uma no campo acima para gerar pontos!
                        </p>
                    </div>
                ) : (
                    tasks.map((task, index) => (
                        <div
                            key={task.id}
                            className="glass animate-in"
                            style={{
                                padding: '20px',
                                borderRadius: 'var(--radius-lg)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                animationDelay: `${index * 0.05}s`,
                                borderLeft: task.isCompleted ? '4px solid var(--success)' : '4px solid transparent',
                                opacity: task.isCompleted ? 0.7 : 1,
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <button
                                onClick={() => handleToggleTask(task.id, task.isCompleted)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: task.isCompleted ? 'var(--success)' : 'var(--text-secondary)',
                                    display: 'flex',
                                    padding: '4px',
                                    alignSelf: 'flex-start',
                                    marginTop: '2px'
                                }}
                            >
                                {task.isCompleted ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                            </button>

                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <p style={{
                                        fontSize: '1.1rem',
                                        color: task.isCompleted ? 'var(--text-secondary)' : 'var(--text-primary)',
                                        textDecoration: task.isCompleted ? 'line-through' : 'none',
                                        fontWeight: 500,
                                        margin: 0
                                    }}>
                                        {task.title}
                                    </p>
                                    {task.category && task.category !== 'geral' && (
                                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary)', textTransform: 'uppercase', fontWeight: 600 }}>
                                            {task.category}
                                        </span>
                                    )}
                                    {task.isDaily && <div title="Tarefa Diária" style={{ display: 'flex', color: 'var(--primary)' }}><Calendar size={16} /></div>}
                                    <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '0.9rem', padding: '2px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)' }}>
                                        +{task.points} pts
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px', marginTop: '6px' }}>
                                    <span>Criado por {task.creator.name}</span>
                                    {task.isCompleted && task.completer && (
                                        <>
                                            <span>•</span>
                                            <span>Concluído por {task.completer.name}</span>
                                        </>
                                    )}
                                </div>

                                {task.subtasks && task.subtasks.length > 0 && (
                                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '8px', borderLeft: '2px solid rgba(255,255,255,0.05)' }}>
                                        {task.subtasks.map(st => (
                                            <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: st.isCompleted ? 0.6 : 1 }}>
                                                <button onClick={() => handleToggleSubtask(task.id, st.id, st.isCompleted)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: st.isCompleted ? 'var(--success)' : 'var(--text-secondary)' }}>
                                                    {st.isCompleted ? <CheckSquare size={16} /> : <Circle size={16} />}
                                                </button>
                                                <span style={{ fontSize: '0.9rem', textDecoration: st.isCompleted ? 'line-through' : 'none' }}>{st.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {addingSubtaskTo === task.id && (
                                    <div className="animate-in" style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                                        <input
                                            autoFocus
                                            type="text"
                                            className="form-input"
                                            placeholder="Nome do item..."
                                            style={{ padding: '4px 8px', fontSize: '0.9rem' }}
                                            value={newSubtaskTitle}
                                            onChange={e => setNewSubtaskTitle(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleAddSubtask(task.id);
                                                if (e.key === 'Escape') setAddingSubtaskTo(null);
                                            }}
                                        />
                                        <button onClick={() => handleAddSubtask(task.id)} className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>Ok</button>
                                        <button onClick={() => setAddingSubtaskTo(null)} className="btn btn-secondary" style={{ padding: '4px' }}>x</button>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'flex-start' }}>
                                <button
                                    onClick={() => {
                                        setAddingSubtaskTo(task.id);
                                        setNewSubtaskTitle('');
                                    }}
                                    className="btn btn-secondary"
                                    style={{ padding: '8px', borderColor: 'transparent', fontSize: '0.8rem' }}
                                    title="Adicionar Sub-tarefa"
                                >
                                    <Plus size={16} /> Item
                                </button>
                                <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="btn btn-secondary"
                                    style={{ padding: '8px', color: '#ff4b4b', borderColor: 'transparent' }}
                                    title="Deletar tarefa"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add Member Section */}
            <div className="glass glass-card" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Adicionar Membro (Apenas Admin)</h3>
                <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '12px' }}>
                    <input
                        type="email"
                        className="form-input"
                        placeholder="E-mail do novo membro"
                        style={{ flex: 1 }}
                        value={newMemberEmail}
                        onChange={e => setNewMemberEmail(e.target.value)}
                        required
                    />
                    <button type="submit" className="btn btn-secondary">
                        <UserPlus size={18} /> Add
                    </button>
                </form>
            </div>

            {/* Custom Confirmation Modal */}
            {confirmModal.isOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: '20px'
                }}>
                    <div className="glass glass-card animate-in" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
                        <h3 style={{ marginBottom: '12px' }}>{confirmModal.title}</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{confirmModal.message}</p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button onClick={closeConfirm} className="btn btn-secondary" style={{ flex: 1 }}>Sair</button>
                            <button onClick={confirmModal.onConfirm} className="btn btn-primary" style={{ flex: 1, backgroundColor: confirmModal.title.includes('Excluir') ? '#ff4b4b' : '' }}>Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupDetails;
