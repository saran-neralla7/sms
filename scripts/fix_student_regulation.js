
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting Migration: Tagging Students with Regulation R22...");

    const r22 = await prisma.regulation.findUnique({ where: { name: "R22" } });
    if (!r22) { console.error("R22 Regulation not found!"); return; }

    const dept = await prisma.department.findFirst({ where: { name: "Computer Science and Engineering" } });
    if (!dept) { console.error("CSE Dept not found!"); return; }

    // Find students with NO regulation in Year 1 or 2 (Typical R22 batches)
    const updateResult = await prisma.student.updateMany({
        where: {
            departmentId: dept.id,
            regulationId: null, // Only update those missing a regulation
            year: { in: ["1", "2"] } // Safe target
        },
        data: {
            regulationId: r22.id
        }
    });

    console.log(`SUCCESS: Updated ${updateResult.count} students to Regulation R22.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
