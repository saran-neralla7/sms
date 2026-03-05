import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting TEMPORARY seed for Graph Testing...');

    // 0. Get Admin User for history tracking
    const adminUser = await prisma.user.findFirst({
        where: { role: 'ADMIN' }
    });

    if (!adminUser) {
        console.error("CRITICAL: No Admin user found. Cannot create attendance history.");
        return;
    }

    // 1. Ensure a dummy department exists
    let dept = await prisma.department.findFirst({ where: { code: 'TEST-DEPT' } });
    if (!dept) {
        dept = await prisma.department.create({
            data: { name: 'Test Department', code: 'TEST-DEPT' }
        });
    }

    // 2. Ensure a dummy section exists
    let section = await prisma.section.findFirst({ where: { name: 'TEST-SEC' } });
    if (!section) {
        section = await prisma.section.create({
            data: { name: 'TEST-SEC' }
        });
    }

    // 3. Create Test Students
    const students = [
        { roll: 'TEST-001', name: 'Test Student Graph 1' },
        { roll: 'TEST-002', name: 'Test Student Graph 2' },
        { roll: 'TEST-003', name: 'Test Student Graph 3' }
    ];

    for (const s of students) {
        await prisma.student.upsert({
            where: { rollNumber: s.roll },
            update: {},
            create: {
                rollNumber: s.roll,
                name: s.name,
                mobile: '0000000000',
                year: '1',
                semester: '1',
                departmentId: dept.id,
                sectionId: section.id
            }
        });
    }
    console.log('Test Students created.');

    // 4. Create Subject (Find First since Code is not unique)
    let subject = await prisma.subject.findFirst({
        where: { code: 'TEST-SUB-001', departmentId: dept.id }
    });

    if (!subject) {
        subject = await prisma.subject.create({
            data: {
                name: 'Test Subject Graph',
                code: 'TEST-SUB-001',
                type: 'CORE',
                departmentId: dept.id,
                semester: '1',
                year: '1'
            }
        });
    }

    // 5. Create Attendance Records (Nov, Dec, Jan)
    const months = [
        { year: 2024, month: 10 }, // Nov
        { year: 2024, month: 11 }, // Dec
        { year: 2025, month: 0 }   // Jan
    ];

    for (const m of months) {
        // Create 20 records per month
        for (let day = 1; day <= 20; day++) {
            const date = new Date(m.year, m.month, day);
            if (date.getDay() === 0) continue; // Skip Sundays

            // Logic:
            // Student 1: 90%
            // Student 2: Increasing
            // Student 3: 40%
            const details = students.map(s => {
                let status = 'PRESENT';
                if (s.roll === 'TEST-001') {
                    status = Math.random() < 0.9 ? 'PRESENT' : 'ABSENT';
                } else if (s.roll === 'TEST-003') {
                    status = Math.random() < 0.4 ? 'PRESENT' : 'ABSENT';
                } else {
                    const successRate = m.month === 10 ? 0.5 : m.month === 11 ? 0.7 : 0.9;
                    status = Math.random() < successRate ? 'PRESENT' : 'ABSENT';
                }

                return {
                    "Roll Number": s.roll,
                    "rollNumber": s.roll, // Dual support for variations
                    "Name": s.name,
                    "Status": status,
                    "status": status
                };
            });

            await prisma.attendanceHistory.create({
                data: {
                    date: date,
                    subjectId: subject.id,
                    // topic: `Topic Day ${day}`, // Not in schema based on error earlier? Let's check Schema line 230-245.
                    // Schema view showed: status, fileName, downloadedBy, details, user relation.
                    // It did NOT show 'topic'. Let's verify line 218-245 of schema.
                    // Line 240: status String. Line 241: fileName.
                    // Wait, schema does NOT have 'topic'.

                    status: "Computed",
                    fileName: "Seeded_Gen.xlsx",
                    downloadedBy: adminUser.id,
                    details: JSON.stringify(details),

                    sectionId: section.id,
                    departmentId: dept.id,
                    year: '1',
                    semester: '1',
                }
            });
        }
    }
    console.log('Attendance History created.');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
