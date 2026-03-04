import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Create a new Reward
router.post('/:groupId', authenticateToken as any, async (req: AuthRequest, res) => {
    try {
        const groupId = req.params.groupId as string;
        const { title, pointsCost } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Não autorizado.' });
        }

        // Verify if admin
        const member = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId } }
        });

        if (!member || member.role !== 'Admin') {
            return res.status(403).json({ error: 'Apenas admins podem criar recompensas.' });
        }

        const reward = await prisma.reward.create({
            data: {
                groupId,
                title,
                pointsCost: Number(pointsCost)
            }
        });

        res.status(201).json(reward);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar recompensa.' });
    }
});

// Fetch all rewards for a group
router.get('/:groupId', authenticateToken as any, async (req: AuthRequest, res) => {
    try {
        const groupId = req.params.groupId as string;

        const rewards = await prisma.reward.findMany({
            where: { groupId },
            orderBy: { pointsCost: 'asc' },
            include: {
                claims: {
                    include: { user: { select: { name: true } } }
                }
            }
        });

        res.json(rewards);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar recompensas.' });
    }
});

// Claim (redeem) a reward
router.post('/claim/:rewardId', authenticateToken as any, async (req: AuthRequest, res) => {
    try {
        const rewardId = req.params.rewardId as string;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Não autorizado.' });
        }

        const reward = await prisma.reward.findUnique({
            where: { id: rewardId }
        });

        if (!reward) return res.status(404).json({ error: 'Recompensa não encontrada.' });

        // Check user score
        const member = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId: reward.groupId } }
        });

        if (!member) return res.status(403).json({ error: 'Você não está neste grupo.' });

        if (member.score < reward.pointsCost) {
            return res.status(400).json({ error: 'Pontuação insuficiente para resgatar.' });
        }

        // Transaction: Decrease score, create claim
        await prisma.$transaction([
            prisma.groupMember.update({
                where: { userId_groupId: { userId, groupId: reward.groupId } },
                data: { score: { decrement: reward.pointsCost } }
            }),
            prisma.rewardClaim.create({
                data: {
                    rewardId,
                    userId
                }
            })
        ]);

        res.json({ message: 'Recompensa resgatada com sucesso!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao resgatar recompensa.' });
    }
});

// Delete Reward
router.delete('/:rewardId', authenticateToken as any, async (req: AuthRequest, res) => {
    try {
        const rewardId = req.params.rewardId as string;
        const userId = req.user?.userId;

        if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

        const reward = await prisma.reward.findUnique({ where: { id: rewardId } });
        if (!reward) return res.status(404).json({ error: 'Recompensa não encontrada.' });

        // Verify if admin
        const member = await prisma.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId: reward.groupId } }
        });

        if (!member || member.role !== 'Admin') {
            return res.status(403).json({ error: 'Apenas admins podem deletar opções.' });
        }

        await prisma.reward.delete({ where: { id: rewardId } });

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao deletar recompensa.' });
    }
});

export default router;
