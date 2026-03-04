import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../prisma';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const registerSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    avatar: z.string().optional(),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, avatar } = registerSchema.parse(req.body);

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email já cadastrado.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { name, email, passwordHash, avatar: avatar || 'fox' },
        });

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '365d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: true, // Always true for HTTPS in cloud
            sameSite: 'none',
            partitioned: true, // Fix Chrome 3rd-party cookie warning
            maxAge: 365 * 24 * 60 * 60 * 1000 // 365 days
        });

        res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: (error as any).errors });
        }
        console.error(error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ error: 'Credenciais inválidas.' });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(400).json({ error: 'Credenciais inválidas.' });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '365d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            partitioned: true,
            maxAge: 365 * 24 * 60 * 60 * 1000
        });

        res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: (error as any).errors });
        }
        console.error(error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        partitioned: true
    });
    res.json({ message: 'Logout realizado.' });
});

import { authenticateToken, AuthRequest } from '../middleware/auth';
router.get('/whoami', authenticateToken as any, async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user?.userId },
            select: { id: true, name: true, email: true }
        });
        res.json({ jwt: req.user, db: user });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao verificar identidade.' });
    }
});

export default router;
