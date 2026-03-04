import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import webpush from 'web-push';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken as any);

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
    webpush.setVapidDetails(
        vapidSubject,
        vapidPublicKey,
        vapidPrivateKey
    );
} else {
    console.warn("VAPID Keys not found in environment variables. Web Push will not work.");
}

const subscriptionSchema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
        p256dh: z.string(),
        auth: z.string()
    })
});

// Save a device subscription
router.post('/subscribe', async (req: AuthRequest, res: Response) => {
    try {
        const { endpoint, keys } = subscriptionSchema.parse(req.body);
        const userId = req.user!.userId;

        await prisma.pushSubscription.upsert({
            where: { endpoint },
            create: {
                userId,
                endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth,
            },
            update: {
                userId, // update the user if the same device is logged into a different account
                p256dh: keys.p256dh,
                auth: keys.auth,
            }
        });

        res.status(201).json({ success: true });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: (error as any).errors });
        }
        console.error("Push Subscribe Error:", error);
        res.status(500).json({ error: 'Erro ao salvar assinatura de push.' });
    }
});

// Remove a device subscription
router.post('/unsubscribe', async (req: AuthRequest, res: Response) => {
    try {
        const { endpoint } = req.body;

        if (endpoint) {
            await prisma.pushSubscription.deleteMany({
                where: { endpoint }
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Push Unsubscribe Error:", error);
        res.status(500).json({ error: 'Erro ao remover assinatura de push.' });
    }
});

export default router;
