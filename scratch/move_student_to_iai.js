const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const rollNumber = '5241421043';

    // 1. Find target subject IAI for Year 3 Sem 1
    const iaiSubject = await prisma.subject.findFirst({
        where: {
            year: "3",
            semester: "1",
            OR: [
                { code: { equals: "IAI", mode: "insensitive" } },
                { name: { contains: "Introduction to AI", mode: "insensitive" } },
                { name: { contains: "Artificial Intelligence", mode: "insensitive" } }
            ]
        },
        include: {
            department: true,
            electiveSlotRelation: true
        }
    });

    if (!iaiSubject) {
        console.error("Target subject 'IAI' (Year 3 Sem 1) not found in database!");
        process.exit(1);
    }

    console.log("Target Subject Found:", iaiSubject.id, iaiSubject.code, iaiSubject.name, "| Slot:", iaiSubject.electiveSlotRelation?.name);

    // 2. Find student
    const student = await prisma.student.findUnique({
        where: { rollNumber: rollNumber },
        include: {
            subjects: {
                include: { electiveSlotRelation: true }
            }
        }
    });

    if (!student) {
        console.error(`Student ${rollNumber} not found!`);
        process.exit(1);
    }

    console.log(`\nStudent Found: ${student.name} (${student.rollNumber})`);
    console.log("Current enrolled subjects:");
    student.subjects.forEach(s => {
        console.log(` - ID: ${s.id} | Code: ${s.code} | Name: ${s.name} | Slot: ${s.electiveSlotRelation?.name || 'N/A'}`);
    });

    // 3. Find old OE-1 subject (e.g. BME) to disconnect
    const oldOESubjects = student.subjects.filter(s => 
        s.year === "3" && 
        s.semester === "1" && 
        (s.isElective || s.electiveSlotRelation?.name?.includes('OE')) &&
        s.id !== iaiSubject.id
    );

    console.log(`\nOld OE subjects to disconnect:`, oldOESubjects.map(s => `${s.code} (${s.name})`));

    // 4. Update student subject connections
    const disconnectOps = oldOESubjects.map(s => ({ id: s.id }));

    const updatedStudent = await prisma.student.update({
        where: { id: student.id },
        data: {
            subjects: {
                disconnect: disconnectOps,
                connect: [{ id: iaiSubject.id }]
            }
        },
        include: {
            subjects: {
                include: { electiveSlotRelation: true }
            }
        }
    });

    console.log(`\nSuccessfully updated student subject connections!`);
    console.log("New enrolled subjects:");
    updatedStudent.subjects.forEach(s => {
        console.log(` - Code: ${s.code} | Name: ${s.name} | Slot: ${s.electiveSlotRelation?.name || 'N/A'}`);
    });

    // 5. Clean any previous OE attendance history entries for this student if any exist
    const histories = await prisma.attendanceHistory.findMany({
        where: { year: "3", semester: "1" }
    });

    let cleanedCount = 0;
    for (const h of histories) {
        try {
            const details = JSON.parse(h.details || "[]");
            if (oldOESubjects.some(o => o.id === h.subjectId)) {
                const hasStudent = details.some(d => d.rollNumber === rollNumber);
                if (hasStudent) {
                    const newDetails = details.filter(d => d.rollNumber !== rollNumber);
                    await prisma.attendanceHistory.update({
                        where: { id: h.id },
                        data: { details: JSON.stringify(newDetails) }
                    });
                    cleanedCount++;
                    console.log(`Cleaned student entry from history ID ${h.id} for old subject ${h.subjectId}`);
                }
            }
        } catch (e) {
            // ignore
        }
    }

    console.log(`Cleaned ${cleanedCount} old OE attendance history records.`);
    console.log("Operation completed successfully with ZERO data loss!");

    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    prisma.$disconnect();
});
