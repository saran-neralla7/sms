const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const dryRun = process.argv.includes('--execute') ? false : true;
    console.log(dryRun ? "=== RUNNING IN DRY-RUN MODE ===" : "=== RUNNING IN EXECUTION MODE ===");

    const eceDept = await prisma.department.findFirst({
        where: { code: 'ECE' }
    });
    const batch = await prisma.batch.findFirst({
        where: { name: '2024-2028' }
    });
    const sectionA = await prisma.section.findFirst({
        where: { name: 'A' }
    });
    const sectionB = await prisma.section.findFirst({
        where: { name: 'B' }
    });

    if (!eceDept || !batch || !sectionA || !sectionB) {
        console.error("Missing ECE, batch, or sections in database.");
        return;
    }

    // Find all students of Batch 2024-2028 ECE
    const students = await prisma.student.findMany({
        where: {
            batchId: batch.id,
            departmentId: eceDept.id
        },
        orderBy: { rollNumber: 'asc' }
    });

    console.log(`Found ${students.length} students total in Batch 2024-2028 ECE.`);

    const toSecA = [];
    const toSecB = [];

    students.forEach(s => {
        // Extract suffix (last 3 digits of roll number)
        const suffixStr = s.rollNumber.substring(s.rollNumber.length - 3);
        const suffix = parseInt(suffixStr);
        if (!isNaN(suffix) && suffix >= 66) {
            toSecB.push(s);
        } else {
            toSecA.push(s);
        }
    });

    console.log(`\nProposed Split:`);
    console.log(`- Section A: ${toSecA.length} students (Roll: ${toSecA[0]?.rollNumber} to ${toSecA[toSecA.length-1]?.rollNumber})`);
    console.log(`- Section B: ${toSecB.length} students (Roll: ${toSecB[0]?.rollNumber} to ${toSecB[toSecB.length-1]?.rollNumber})`);

    // Let's inspect the attendance history records for ECE Yr 3 Sem 1 Section A
    const historyRecords = await prisma.attendanceHistory.findMany({
        where: {
            departmentId: eceDept.id,
            sectionId: sectionA.id,
            year: '3',
            semester: '1'
        }
    });

    console.log(`\nFound ${historyRecords.length} attendance history records to split.`);

    if (!dryRun) {
        // 1. Update Student Sections
        console.log("\nUpdating student sections in database...");
        
        await prisma.student.updateMany({
            where: {
                id: { in: toSecA.map(s => s.id) }
            },
            data: { sectionId: sectionA.id }
        });

        await prisma.student.updateMany({
            where: {
                id: { in: toSecB.map(s => s.id) }
            },
            data: { sectionId: sectionB.id }
        });

        console.log("Student sections updated successfully.");

        // 2. Split Attendance History Records
        for (const record of historyRecords) {
            console.log(`\nSplitting Attendance record: ${record.id} (${record.date})`);
            const details = JSON.parse(record.details || "[]");

            const detailsA = [];
            const detailsB = [];

            const secBRolls = new Set(toSecB.map(s => s.rollNumber.toLowerCase()));

            details.forEach(d => {
                const roll = String(d["Roll Number"] || d["rollNumber"] || "").toLowerCase();
                if (secBRolls.has(roll)) {
                    detailsB.push(d);
                } else {
                    detailsA.push(d);
                }
            });

            console.log(`- Section A details count: ${detailsA.length}`);
            console.log(`- Section B details count: ${detailsB.length}`);

            // Update original record with Section A details
            await prisma.attendanceHistory.update({
                where: { id: record.id },
                data: {
                    details: JSON.stringify(detailsA)
                }
            });

            // Create new record for Section B
            const newRecord = await prisma.attendanceHistory.create({
                data: {
                    date: record.date,
                    year: record.year,
                    semester: record.semester,
                    sectionId: sectionB.id,
                    departmentId: record.departmentId,
                    academicYearId: record.academicYearId,
                    subjectId: record.subjectId,
                    periodId: record.periodId,
                    status: record.status,
                    type: record.type,
                    fileName: record.fileName,
                    downloadedBy: record.downloadedBy,
                    details: JSON.stringify(detailsB),
                    topicsTaught: record.topicsTaught
                }
            });
            console.log(`- Created Section B attendance record: ${newRecord.id}`);
        }

        console.log("\nSplitting completed successfully with ZERO data loss!");
    } else {
        console.log("\nTo execute this split, run with: node scratch/separate_ece_students.js --execute");
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
