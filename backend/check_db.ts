import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const tasks = await prisma.task.findMany({ select: { id: true, isCompleted: true, completedBy: true, points: true } });
    console.log("Total tasks:", tasks.length);
    const brokenTasks = tasks.filter(t => t.isCompleted && t.completedBy === null);
    console.log("Tasks completed but with completedBy=null:", brokenTasks.length);
    console.log(brokenTasks.slice(0, 3));
}
main().finally(() => prisma.$disconnect());
