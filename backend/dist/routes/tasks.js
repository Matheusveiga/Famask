"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
const taskSchema = zod_1.z.object({
    groupId: zod_1.z.string().uuid(),
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
    isDaily: zod_1.z.boolean().optional(),
    points: zod_1.z.number().optional(),
});
const updateTaskSchema = zod_1.z.object({
    title: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    isCompleted: zod_1.z.boolean().optional(),
    isDaily: zod_1.z.boolean().optional(),
    points: zod_1.z.number().optional(),
});
// Create task
router.post('/', async (req, res) => {
    try {
        const { groupId, title, description, category, isDaily, points } = taskSchema.parse(req.body);
        const userId = req.user.userId;
        // Check if user is in the group
        const membership = await prisma_1.default.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId } },
        });
        if (!membership) {
            return res.status(403).json({ error: 'Você não tem permissão neste grupo.' });
        }
        const task = await prisma_1.default.task.create({
            data: {
                groupId,
                createdBy: userId,
                title,
                description,
                category: category ?? "geral",
                isDaily: isDaily ?? false,
                points: points ?? 10,
            },
        });
        res.status(201).json(task);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar tarefa.' });
    }
});
// List tasks for a group
router.get('/:groupId', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const userId = req.user.userId;
        const membership = await prisma_1.default.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId } },
        });
        if (!membership) {
            return res.status(403).json({ error: 'Você não tem permissão neste grupo.' });
        }
        const tasks = await prisma_1.default.task.findMany({
            where: { groupId },
            orderBy: { createdAt: 'desc' },
            include: {
                creator: { select: { name: true } },
                completer: { select: { name: true } },
                subtasks: { orderBy: { id: 'asc' } },
            },
        });
        res.json(tasks);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar tarefas.' });
    }
});
// Update task
router.patch('/:taskId', async (req, res) => {
    try {
        const { title, description, isCompleted, isDaily, points } = updateTaskSchema.parse(req.body);
        const taskId = req.params.taskId;
        const userId = req.user.userId;
        const existingTask = await prisma_1.default.task.findUnique({ where: { id: taskId } });
        if (!existingTask) {
            return res.status(404).json({ error: 'Tarefa não encontrada.' });
        }
        // Verify group permissions
        const membership = await prisma_1.default.groupMember.findUnique({
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
        transaction.push(prisma_1.default.task.update({
            where: { id: taskId },
            data: {
                title,
                description,
                isDaily,
                points,
                isCompleted,
                completedBy: isCompleted ? userId : (isCompleted === false ? null : undefined),
            },
        }));
        // 2. Update the score of the user who is interacting (or who completed it originally)
        if (isStatusChanging) {
            const targetUserId = isCompleted ? userId : (existingTask.completedBy || userId);
            transaction.push(prisma_1.default.groupMember.update({
                where: { userId_groupId: { userId: targetUserId, groupId: existingTask.groupId } },
                data: { score: { increment: pointDelta } }
            }));
        }
        const [updatedTask] = await prisma_1.default.$transaction(transaction);
        res.json(updatedTask);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar tarefa.' });
    }
});
// Delete task
router.delete('/:taskId', async (req, res) => {
    try {
        const taskId = req.params.taskId;
        const userId = req.user.userId;
        const existingTask = await prisma_1.default.task.findUnique({ where: { id: taskId } });
        if (!existingTask) {
            return res.status(404).json({ error: 'Tarefa não encontrada.' });
        }
        // Admins and task creator can delete
        const membership = await prisma_1.default.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId: existingTask.groupId } },
        });
        if (!membership || (membership.role !== 'Admin' && existingTask.createdBy !== userId)) {
            return res.status(403).json({ error: 'Apenas administradores ou o criador da tarefa podem deletá-la.' });
        }
        await prisma_1.default.task.delete({ where: { id: taskId } });
        res.json({ message: 'Tarefa deletada com sucesso.' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao deletar tarefa.' });
    }
});
// SUBTASKS ENDPOINTS
// Add Subtask
router.post('/:taskId/subtasks', async (req, res) => {
    try {
        const taskId = req.params.taskId;
        const { title } = req.body;
        if (!title)
            return res.status(400).json({ error: 'Título é obrigatório.' });
        // Basic verification
        const task = await prisma_1.default.task.findUnique({ where: { id: taskId } });
        if (!task)
            return res.status(404).json({ error: 'Tarefa não encontrada.' });
        const subtask = await prisma_1.default.subtask.create({
            data: { taskId, title }
        });
        res.status(201).json(subtask);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar sub-tarefa.' });
    }
});
// Toggle (Update) Subtask
router.patch('/:taskId/subtasks/:subtaskId', async (req, res) => {
    try {
        const subtaskId = req.params.subtaskId;
        const { isCompleted } = req.body;
        const subtask = await prisma_1.default.subtask.update({
            where: { id: subtaskId },
            data: { isCompleted }
        });
        res.json(subtask);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar sub-tarefa.' });
    }
});
// Delete Subtask
router.delete('/:taskId/subtasks/:subtaskId', async (req, res) => {
    try {
        const subtaskId = req.params.subtaskId;
        await prisma_1.default.subtask.delete({
            where: { id: subtaskId }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao deletar sub-tarefa.' });
    }
});
exports.default = router;
