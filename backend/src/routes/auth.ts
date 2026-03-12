import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const registerSchema = z.object({
    name: z.string().min(2, 'O nome deve ter no mínimo 2 caracteres.'),
    email: z.string().email('E-mail inválido.'),
    password: z.string()
        .min(6, 'A senha deve ter no mínimo 6 caracteres.')
        .refine((val) => !/^(123456(789)?|password|senha123|qwerty)$/i.test(val), {
            message: 'Esta senha é muito fraca ou comum.',
        }),
    birthDate: z.string().refine((val) => {
        const date = new Date(val);
        if (isNaN(date.getTime())) return false;
        const ageDifMs = Date.now() - date.getTime();
        const ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970) >= 13;
    }, { message: 'Você deve ter pelo menos 13 anos para se registrar.' }),
    avatar: z.string().optional(),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, birthDate, avatar } = registerSchema.parse(req.body);

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email já cadastrado.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash,
                birthDate: new Date(birthDate),
                avatar: avatar || 'fox'
            },
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

// Update profile (name and avatar)

const updateProfileSchema = z.object({
    name: z.string().min(2, 'O nome deve ter no mínimo 2 caracteres.').optional(),
    avatar: z.string().optional(),
});

router.patch('/me', authenticateToken as any, async (req: AuthRequest, res) => {
    try {
        const { name, avatar } = updateProfileSchema.parse(req.body);
        const userId = req.user!.userId;

        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(name && { name }),
                ...(avatar && { avatar }),
            },
            select: { id: true, name: true, email: true, avatar: true },
        });

        res.json({ user: updated });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: (error as any).errors });
        }
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar perfil.' });
    }
});

// Change password
const changePasswordSchema = z.object({
    currentPassword: z.string(),
    newPassword: z.string()
        .min(6, 'A nova senha deve ter no mínimo 6 caracteres.')
        .refine((val) => !/^(123456(789)?|password|senha123|qwerty)$/i.test(val), {
            message: 'Esta senha é muito fraca ou comum.',
        }),
});

router.post('/change-password', authenticateToken as any, async (req: AuthRequest, res) => {
    try {
        const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
        const userId = req.user!.userId;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) return res.status(400).json({ error: 'Senha atual incorreta.' });

        const newHash = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newHash },
        });

        res.json({ message: 'Senha alterada com sucesso.' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: (error as any).errors });
        }
        console.error(error);
        res.status(500).json({ error: 'Erro ao alterar senha.' });
    }
});

router.get('/whoami', authenticateToken as any, async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user?.userId },
            select: { id: true, name: true, email: true, avatar: true }
        });
        res.json({ jwt: req.user, db: user });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao verificar identidade.' });
    }
});

export default router;
