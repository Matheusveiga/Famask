import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken as any);

const groupSchema = z.object({
    name: z.string().min(2),
});

const addMemberSchema = z.object({
    email: z.string().email(),
});

router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { name } = groupSchema.parse(req.body);
        const userId = req.user!.userId;

        const generateCode = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            return Array.from({ length: 6 }).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        };
        const inviteCode = generateCode();

        const group = await prisma.familyGroup.create({
            data: {
                name,
                inviteCode,
                createdBy: userId,
                members: {
                    create: {
                        userId,
                        role: 'Admin',
                    },
                },
            },
        });

        res.status(201).json(group);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: (error as any).errors });
        }
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar grupo.' });
    }
});

router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const groups = await prisma.familyGroup.findMany({
            where: {
                members: {
                    some: { userId },
                },
            },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, name: true, email: true, avatar: true } },
                    },
                },
            },
        });
        res.json(groups);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar grupos.' });
    }
});

router.get('/:groupId', async (req: AuthRequest, res: Response) => {
    try {
        const groupId = req.params.groupId as string;
        const userId = req.user!.userId;

        const group = await prisma.familyGroup.findUnique({
            where: { id: groupId },
            include: {
                members: {
                    include: { user: { select: { id: true, name: true, email: true, avatar: true } } }
                },
            },
        });

        if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });

        // Find if user is a member
        const isMember = group.members.some((m: any) => m.userId === userId);
        if (!isMember) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        // Sort members by score in JS to bypass Prisma TS Cache issues
        group.members.sort((a: any, b: any) => b.score - a.score);

        res.json(group);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar dados do grupo.' });
    }
});

router.post('/:groupId/members', async (req: AuthRequest, res: Response) => {
    try {
        const { email } = addMemberSchema.parse(req.body);
        const groupId = req.params.groupId as string;
        const adminId = req.user!.userId;

        // Verify if caller is admin of this group
        const membership = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId: adminId, groupId } },
        });

        if (!membership || membership.role !== 'Admin') {
            return res.status(403).json({ error: 'Apenas administradores podem adicionar membros.' });
        }

        const userToAdd = await prisma.user.findUnique({ where: { email } });
        if (!userToAdd) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        const existingMember = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId: userToAdd.id, groupId } },
        });

        if (existingMember) {
            return res.status(400).json({ error: 'Usuário já é membro.' });
        }

        const newMember = await prisma.groupMember.create({
            data: {
                userId: userToAdd.id,
                groupId,
                role: 'Member',
            },
            include: {
                user: { select: { id: true, name: true, email: true, avatar: true } },
            },
        });

        res.status(201).json(newMember);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: (error as any).errors });
        }
        console.error(error);
        res.status(500).json({ error: 'Erro ao adicionar membro.' });
    }
});

const joinSchema = z.object({
    inviteCode: z.string().min(6),
});

router.post('/join', async (req: AuthRequest, res: Response) => {
    try {
        const { inviteCode } = joinSchema.parse(req.body);
        const userId = req.user!.userId;

        const group = await prisma.familyGroup.findUnique({ where: { inviteCode } });
        if (!group) return res.status(404).json({ error: 'Código de convite inválido ou Família não encontrada.' });

        const groupId = group.id;

        const existingMember = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId } },
        });

        if (existingMember) return res.status(400).json({ error: 'Você já é membro deste grupo.' });

        // Add user to the group
        const newMember = await prisma.groupMember.create({
            data: {
                userId,
                groupId,
                role: 'Member',
            },
            include: { group: true },
        });

        res.status(201).json(newMember);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: (error as any).errors });
        }
        console.error(error);
        res.status(500).json({ error: 'Erro ao entrar no grupo.' });
    }
});

router.delete('/:groupId', async (req: AuthRequest, res: Response) => {
    try {
        const groupId = req.params.groupId as string;
        const userId = req.user!.userId;

        const membership = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId } },
        });

        if (!membership || membership.role !== 'Admin') {
            return res.status(403).json({ error: 'Apenas administradores podem deletar a família.' });
        }

        await prisma.familyGroup.delete({
            where: { id: groupId }
        });

        res.json({ success: true, message: 'Família deletada com sucesso.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao deletar grupo.' });
    }
});

router.delete('/:groupId/members/:memberId', async (req: AuthRequest, res: Response) => {
    try {
        const groupId = req.params.groupId as string;
        const memberId = req.params.memberId as string;
        const adminId = req.user!.userId;

        // Ensure caller is Admin
        const membership = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId: adminId, groupId } },
        });

        if (!membership || membership.role !== 'Admin') {
            return res.status(403).json({ error: 'Apenas administradores podem remover membros.' });
        }

        // Prevent admin from removing themselves here if they are the only admin (optional logic, but basic is just delete)
        if (adminId === memberId) {
            return res.status(400).json({ error: 'Você não pode remover a si mesmo por aqui.' });
        }

        await prisma.groupMember.delete({
            where: { userId_groupId: { userId: memberId, groupId } }
        });

        res.json({ success: true, message: 'Membro removido com sucesso.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao remover membro.' });
    }
});

export default router;
