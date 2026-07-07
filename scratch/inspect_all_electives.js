const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("=== ELECTIVE SLOTS ===");
    const slots = await prisma.electiveSlot.findMany({
        orderBy: { name: 'asc' }
    });
    for (const slot of slots) {
        const subjectsCount = await prisma.subject.count({
            where: { electiveSlotId: slot.id }
        });
        console.log(`Slot: ${slot.name} (${slot.id}) -> ${subjectsCount} subjects`);
    }

    console.log("\n=== ELECTIVE SUBJECTS GROUPED BY SLOT ===");
    const subjects = await prisma.subject.findMany({
        where: { isElective: true },
        include: {
            department: true,
            electiveSlotRelation: true,
            _count: {
                select: { students: true }
            }
        },
        orderBy: [
            { electiveSlotRelation: { name: 'asc' } },
            { year: 'asc' },
            { semester: 'asc' },
            { code: 'asc' }
        ]
    });

    subjects.forEach((sub, i) => {
        console.log(`${i+1}. Slot: ${sub.electiveSlotRelation?.name || 'NONE'} | ${sub.name} (${sub.code}) | Year: ${sub.year}, Sem: ${sub.semester} | Dept: ${sub.department?.code || 'NONE'} | Enrolled: ${sub._count.students} students`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
