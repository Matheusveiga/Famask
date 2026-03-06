import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function run() {
    try {
        const users = await prisma.user.findMany({ take: 2 });
        if (users.length < 2) return console.log("Need at least 2 users");
        const userA = users[0];
        const userB = users[1];

        const group = await prisma.familyGroup.findFirst();
        if (!group) return console.log("Missing group");

        console.log(`User A: ${userA.name} (${userA.id})`);
        console.log(`User B: ${userB.name} (${userB.id})`);

        // Ensure both are members
        for (const u of [userA, userB]) {
            await prisma.groupMember.upsert({
                where: { userId_groupId: { userId: u.id, groupId: group.id } },
                create: { userId: u.id, groupId: group.id, role: 'Member', score: 100 },
                update: {}
            });
        }

        // 1. Create Task (by User A)
        let task = await prisma.task.create({
            data: { groupId: group.id, title: "Test Bug Task", createdBy: userA.id, isCompleted: false, points: 10 }
        });

        // 2. User A completes it
        await prisma.$transaction([
            prisma.task.update({
                where: { id: task.id },
                data: { isCompleted: true, completedBy: userA.id },
            }),
            prisma.groupMember.update({
                where: { userId_groupId: { userId: userA.id, groupId: group.id } },
                data: { score: { increment: 10 } }
            })
        ]);

        console.log("Task completed by User A.");

        // 3. User B uncompletes it (the bug)
        // Fetch existing task just like the backend does
        const existingTask = await prisma.task.findUnique({ where: { id: task.id } });
        console.log("Existing task completedBy:", existingTask?.completedBy);

        const isCompleted = false;
        const userId = userB.id; // User B is making the request
        const isStatusChanging = true;
        const pointDelta = -existingTask!.points; // -10

        const targetUserId = isCompleted ? userId : (existingTask!.completedBy || userId);
        console.log("Target User ID evaluated to:", targetUserId, "Expected:", userA.id);
        console.log("Is target user = User A?", targetUserId === userA.id);
        console.log("Is target user = User B?", targetUserId === userB.id);

        await prisma.$transaction([
            prisma.task.update({
                where: { id: task.id },
                data: { isCompleted: false, completedBy: null },
            }),
            prisma.groupMember.update({
                where: { userId_groupId: { userId: targetUserId, groupId: existingTask!.groupId } },
                data: { score: { increment: pointDelta } }
            })
        ]);

        console.log("Task uncompleted by User B.");

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}
run();
