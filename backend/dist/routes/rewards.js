"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Create a new Reward
router.post('/:groupId', auth_1.authenticateToken, async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const { title, pointsCost } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Não autorizado.' });
        }
        // Verify if admin
        const member = await prisma_1.default.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId } }
        });
        if (!member || member.role !== 'Admin') {
            return res.status(403).json({ error: 'Apenas admins podem criar recompensas.' });
        }
        const reward = await prisma_1.default.reward.create({
            data: {
                groupId,
                title,
                pointsCost: Number(pointsCost)
            }
        });
        res.status(201).json(reward);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar recompensa.' });
    }
});
// Fetch all rewards for a group
router.get('/:groupId', auth_1.authenticateToken, async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const rewards = await prisma_1.default.reward.findMany({
            where: { groupId },
            orderBy: { pointsCost: 'asc' },
            include: {
                claims: {
                    include: { user: { select: { name: true } } }
                }
            }
        });
        res.json(rewards);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar recompensas.' });
    }
});
// Claim (redeem) a reward
router.post('/claim/:rewardId', auth_1.authenticateToken, async (req, res) => {
    try {
        const rewardId = req.params.rewardId;
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Não autorizado.' });
        }
        const reward = await prisma_1.default.reward.findUnique({
            where: { id: rewardId }
        });
        if (!reward)
            return res.status(404).json({ error: 'Recompensa não encontrada.' });
        // Check user score
        const member = await prisma_1.default.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId: reward.groupId } }
        });
        if (!member)
            return res.status(403).json({ error: 'Você não está neste grupo.' });
        if (member.score < reward.pointsCost) {
            return res.status(400).json({ error: 'Pontuação insuficiente para resgatar.' });
        }
        // Transaction: Decrease score, create claim
        await prisma_1.default.$transaction([
            prisma_1.default.groupMember.update({
                where: { userId_groupId: { userId, groupId: reward.groupId } },
                data: { score: { decrement: reward.pointsCost } }
            }),
            prisma_1.default.rewardClaim.create({
                data: {
                    rewardId,
                    userId
                }
            })
        ]);
        res.json({ message: 'Recompensa resgatada com sucesso!' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao resgatar recompensa.' });
    }
});
// Delete Reward
router.delete('/:rewardId', auth_1.authenticateToken, async (req, res) => {
    try {
        const rewardId = req.params.rewardId;
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: 'Não autorizado.' });
        const reward = await prisma_1.default.reward.findUnique({ where: { id: rewardId } });
        if (!reward)
            return res.status(404).json({ error: 'Recompensa não encontrada.' });
        // Verify if admin
        const member = await prisma_1.default.groupMember.findUnique({
            where: { userId_groupId: { userId, groupId: reward.groupId } }
        });
        if (!member || member.role !== 'Admin') {
            return res.status(403).json({ error: 'Apenas admins podem deletar opções.' });
        }
        await prisma_1.default.reward.delete({ where: { id: rewardId } });
        res.json({ success: true });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao deletar recompensa.' });
    }
});
exports.default = router;
