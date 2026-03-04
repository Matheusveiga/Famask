const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function run() {
    try {
        const user = await prisma.user.findFirst();
        const group = await prisma.familyGroup.findFirst();

        const transaction = [];
        transaction.push(
            prisma.task.update({
                where: { id: "00000000-0000-0000-0000-000000000000" },
                data: { isCompleted: true, completedBy: user.id },
            })
        );
        transaction.push(
            prisma.groupMember.update({
                where: { userId_groupId: { userId: user.id, groupId: group.id } },
                data: { score: { increment: 10 } }
            })
        );

        await prisma.$transaction(transaction);
    } catch (err) {
        fs.writeFileSync('err.json', JSON.stringify({ message: err.message, meta: err.meta, code: err.code }));
        console.log("Error written to err.json");
    } finally {
        await prisma.$disconnect();
    }
}
run();
