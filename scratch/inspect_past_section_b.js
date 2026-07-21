const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find all attendance history records for Section B in ECE
    const records = await prisma.attendanceHistory.findMany({
        where: {
            sectionId: 'e4356b8c-041f-4613-b79c-7cefbb219e72' // Section B
        }
    });

    console.log(`Found ${records.length} Section B attendance history records.`);

    const foundRollNumbers = new Set();
    records.forEach(r => {
        try {
            const details = JSON.parse(r.details || "[]");
            details.forEach(s => {
                const roll = s["Roll Number"] || s["rollNumber"];
                if (roll) {
                    foundRollNumbers.add(roll);
                }
            });
        } catch (e) {
            console.error("Error parsing details", e);
        }
    });

    console.log(`\nFound ${foundRollNumbers.size} unique roll numbers in Section B attendance history:`);
    const sortedRolls = Array.from(foundRollNumbers).sort();
    console.log(sortedRolls.slice(0, 20));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
