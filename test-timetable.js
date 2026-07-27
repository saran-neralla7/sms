const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("=== Timetable for Compiler Design (CS3102) ===");
    const timetable = await prisma.timetable.findMany({
        where: {
            subject: { code: "CS3102" }
        },
        include: {
            section: true,
            period: true
        }
    });

    console.log(timetable.map(t => ({
        section: t.section.name,
        dayOfWeek: t.dayOfWeek, // 1 = Mon, 2 = Tue, etc.
        period: `${t.period.name} (${t.period.startTime}-${t.period.endTime})`
    })));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
