import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth';
import groupRoutes from './routes/groups';
import taskRoutes from './routes/tasks';
import rewardRoutes from './routes/rewards';

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
app.use('/api/groups', groupRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/rewards', rewardRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Famask API is running' });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
