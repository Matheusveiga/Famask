import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth';
import groupsRouter from './routes/groups';
import tasksRouter from './routes/tasks';
import rewardsRouter from './routes/rewards';
import notifRouter from './routes/notifications';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/notifications', notifRouter);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Famask API is running' });
});

// Daily Tasks Reset — runs every day at midnight (BRT, UTC-3)
// Resets isCompleted and completedBy for all recurring daily tasks
cron.schedule('0 3 * * *', async () => {
    try {
        const result = await prisma.task.updateMany({
            where: { isDaily: true, isCompleted: true },
            data: {
                isCompleted: false,
                completedBy: null,
                completedAt: null,
            },
        });
        console.log(`[CRON] Daily task reset: ${result.count} task(s) reset at ${new Date().toISOString()}`);
    } catch (err) {
        console.error('[CRON] Error resetting daily tasks:', err);
    }
}, {
    timezone: 'America/Sao_Paulo'
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
