
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting Migration: Backfilling Batch Strings...");

    const currentYear = new Date().getFullYear(); // 2026

    // Logic:
    // Year 1 (Joined 2025) -> Batch 2025-2029
    // Year 2 (Joined 2024) -> Batch 2024-2028
    // Year 3 (Joined 2023) -> Batch 2023-2027
    // Year 4 (Joined 2022) -> Batch 2022-2026

    const years = ["1", "2", "3", "4"];

    for (const year of years) {
        const studentYearInt = parseInt(year);
        const batchStart = currentYear - studentYearInt; // e.g. 2026 - 2 = 2024
        const batchEnd = batchStart + 4;
        const batchString = `${batchStart}-${batchEnd}`;

        console.log(`Processing Year ${year} -> Batch ${batchString}`);

        const result = await prisma.student.updateMany({
            where: { year: year },
            data: { batch: batchString }
        });

        console.log(`Updated ${result.count} students in Year ${year}.`);
    }

    console.log("Migration Complete.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
