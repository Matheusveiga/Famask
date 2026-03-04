import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function run() {
    try {
        const user = await prisma.user.findFirst();
        const group = await prisma.familyGroup.findFirst();
        if (!user || !group) return console.log("Missing user/group");

        console.log("Found user and group", user.id, group.id);

        // ensure member
        const member = await prisma.groupMember.upsert({
            where: { userId_groupId: { userId: user.id, groupId: group.id } },
            create: { userId: user.id, groupId: group.id, role: 'Admin', score: 0 },
            update: {}
        });

        const task = await prisma.task.create({
            data: { groupId: group.id, title: "Test", createdBy: user.id, isCompleted: false, points: 10 }
        });

        console.log("Created task", task.id);

        const isCompleted = true;
        const existingTask = task;
        const pointDelta = 10;
        const targetUserId = user.id;

        const transaction = [];

        transaction.push(
            prisma.task.update({
                where: { id: task.id },
                data: {
                    isCompleted,
                    completedBy: isCompleted ? user.id : (isCompleted === false ? null : undefined),
                },
            })
        );

        // Push the second transaction
        transaction.push(
            prisma.groupMember.update({
                where: { userId_groupId: { userId: targetUserId, groupId: existingTask.groupId } },
                data: { score: { increment: pointDelta } }
            }) as any
        );

        console.log("Executing transaction...");
        const [updatedTask] = await prisma.$transaction(transaction);
        console.log("Success:", updatedTask);
    } catch (err: any) {
        console.log("FAIL STR:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    } finally {
        await prisma.$disconnect();
    }
}
run();
