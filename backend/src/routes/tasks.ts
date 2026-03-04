import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import webpush from 'web-push';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken as any);

const taskSchema = z.object({
    groupId: z.string().uuid(),
    title: z.string().min(1),
    description: z.string().optional(),
    category: z.string().optional(),
    isDaily: z.boolean().optional(),
    points: z.number().optional(),
});

const updateTaskSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    isCompleted: z.boolean().optional(),
    isDaily: z.boolean().optional(),
    points: z.number().optional(),
});

// Helper for broadcasting Push Notifications
async function broadcastToGroup(groupId: string, excludeUserId: string, payload: any) {
    try {
        const members = await prisma.groupMember.findMany({
            where: { groupId, userId: { not: excludeUserId } },
            select: { userId: true }
        });

        const userIds = members.map(m => m.userId);
        if (userIds.length === 0) return;

        const subscriptions = await prisma.pushSubscription.findMany({
            where: { userId: { in: userIds } }
        });

        const pushPayload = JSON.stringify(payload);

        await Promise.allSettled(
            subscriptions.map(sub =>
                webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    pushPayload
                )
            )
        );
    } catch (e) {
        console.error("Failed to broadcast push notification", e);
    }
}

// Create task
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { groupId, title, description, category, isDaily, points } = taskSchema.parse(req.body);
        const userId = req.user!.userId;

        // Check if user is in the group
        const membership = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId } },
        });

        if (!membership) {
            return res.status(403).json({ error: 'Você não tem permissão neste grupo.' });
        }

        const task = await prisma.task.create({
            data: {
                groupId,
                createdBy: userId,
                title,
                description,
                category: category ?? "geral",
                isDaily: isDaily ?? false,
                points: points ?? 10,
            },
            include: { creator: { select: { name: true } } }
        });

        // Fire & Forget Notification
        broadcastToGroup(groupId, userId, {
            title: 'Nova Tarefa no Grupo!',
            body: `${task.creator.name} adicionou: ${task.title}`,
            url: `/group/${groupId}`
        });

        res.status(201).json(task);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: (error as any).errors });
        }
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar tarefa.' });
    }
});

// List tasks for a group
router.get('/:groupId', async (req: AuthRequest, res: Response) => {
    try {
        const groupId = req.params.groupId as string;
        const userId = req.user!.userId;

        const membership = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId } },
        });

        if (!membership) {
            return res.status(403).json({ error: 'Você não tem permissão neste grupo.' });
        }

        const tasks = await prisma.task.findMany({
            where: { groupId },
            orderBy: { createdAt: 'desc' },
            include: {
                creator: { select: { name: true } },
                completer: { select: { name: true } },
                subtasks: { orderBy: { id: 'asc' } },
            },
        });

        res.json(tasks);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar tarefas.' });
    }
});

// Update task
router.patch('/:taskId', async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, isCompleted, isDaily, points } = updateTaskSchema.parse(req.body);
        const taskId = req.params.taskId as string;
        const userId = req.user!.userId;

        const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
        if (!existingTask) {
            return res.status(404).json({ error: 'Tarefa não encontrada.' });
        }

        // Verify group permissions
        const membership = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId: existingTask.groupId } },
        });

        if (!membership) {
            return res.status(403).json({ error: 'Você não tem permissão.' });
        }

        const isStatusChanging = isCompleted !== undefined && isCompleted !== existingTask.isCompleted;
        let pointDelta = 0;

        if (isStatusChanging) {
            pointDelta = isCompleted ? existingTask.points : -existingTask.points;
        }

        const transaction = [];

        // 1. Update the task
        transaction.push(
            prisma.task.update({
                where: { id: taskId },
                data: {
                    title,
                    description,
                    isDaily,
                    points,
                    isCompleted,
                    completedBy: isCompleted ? userId : (isCompleted === false ? null : undefined),
                },
            })
        );

        // 2. Update the score of the user who is interacting (or who completed it originally)
        if (isStatusChanging) {
            const targetUserId = isCompleted ? userId : (existingTask.completedBy || userId);
            transaction.push(
                prisma.groupMember.update({
                    where: { userId_groupId: { userId: targetUserId, groupId: existingTask.groupId } },
                    data: { score: { increment: pointDelta } }
                }) as any
            );
        }

        const [updatedTask] = await prisma.$transaction(transaction);

        // Fire & Forget Notification for Completion
        if (isStatusChanging && isCompleted) {
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
            broadcastToGroup(updatedTask.groupId, userId, {
                title: 'Tarefa Concluída! 🏆',
                body: `${user?.name} concluiu: ${updatedTask.title} (+${pointDelta}pts)`,
                url: `/group/${updatedTask.groupId}`
            });
        }

        res.json(updatedTask);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: (error as any).errors });
        }
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar tarefa.' });
    }
});

// Delete task
router.delete('/:taskId', async (req: AuthRequest, res: Response) => {
    try {
        const taskId = req.params.taskId as string;
        const userId = req.user!.userId;

        const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
        if (!existingTask) {
            return res.status(404).json({ error: 'Tarefa não encontrada.' });
        }

        // Admins and task creator can delete
        const membership = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId: existingTask.groupId } },
        });

        if (!membership || (membership.role !== 'Admin' && existingTask.createdBy !== userId)) {
            return res.status(403).json({ error: 'Apenas administradores ou o criador da tarefa podem deletá-la.' });
        }

        await prisma.task.delete({ where: { id: taskId } });
        res.json({ message: 'Tarefa deletada com sucesso.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao deletar tarefa.' });
    }
});

// SUBTASKS ENDPOINTS

// Add Subtask
router.post('/:taskId/subtasks', async (req: AuthRequest, res: Response) => {
    try {
        const taskId = req.params.taskId as string;
        const { title } = req.body;

        if (!title) return res.status(400).json({ error: 'Título é obrigatório.' });

        // Basic verification
        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) return res.status(404).json({ error: 'Tarefa não encontrada.' });

        const subtask = await prisma.subtask.create({
            data: { taskId, title }
        });

        res.status(201).json(subtask);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar sub-tarefa.' });
    }
});

// Toggle (Update) Subtask
router.patch('/:taskId/subtasks/:subtaskId', async (req: AuthRequest, res: Response) => {
    try {
        const subtaskId = req.params.subtaskId as string;
        const { isCompleted } = req.body;

        const subtask = await prisma.subtask.update({
            where: { id: subtaskId },
            data: { isCompleted }
        });

        res.json(subtask);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar sub-tarefa.' });
    }
});

// Delete Subtask
router.delete('/:taskId/subtasks/:subtaskId', async (req: AuthRequest, res: Response) => {
    try {
        const subtaskId = req.params.subtaskId as string;

        await prisma.subtask.delete({
            where: { id: subtaskId }
        });

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao deletar sub-tarefa.' });
    }
});

export default router;
