const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const eceDept = await prisma.department.findFirst({
        where: { code: 'ECE' }
    });

    const records = await prisma.attendanceHistory.findMany({
        where: {
            departmentId: eceDept?.id,
            year: '3',
            semester: '1'
        },
        include: {
            section: true,
            subject: true
        }
    });

    console.log(`Found ${records.length} records in ECE Yr 3 Sem 1:`);
    records.forEach((r, idx) => {
        console.log(`\nRecord ${idx + 1}:`);
        console.log(`ID: ${r.id}`);
        console.log(`Date: ${r.date}`);
        console.log(`Section: ${r.section?.name}`);
        console.log(`Subject: ${r.subject?.name}`);
        const details = JSON.parse(r.details || "[]");
        console.log(`Details count: ${details.length}`);
        
        // Print a count of Present and Absent
        let present = 0, absent = 0;
        details.forEach(d => {
            const status = d.Status || d.status;
            if (status === 'Present') present++;
            else if (status === 'Absent') absent++;
        });
        console.log(`Present: ${present}, Absent: ${absent}`);
        console.log("Sample details (first 5):", details.slice(0, 5));
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
