const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const eceDept = await prisma.department.findFirst({
        where: { code: 'ECE' }
    });
    
    // 1. Faculty Subject Mappings
    const mappings = await prisma.facultySubjectMapping.findMany({
        where: {
            subject: {
                departmentId: eceDept?.id,
                year: '3',
                semester: '1'
            }
        },
        include: {
            subject: true,
            section: true,
            faculty: true
        }
    });

    console.log(`Found ${mappings.length} FacultySubjectMapping records for ECE Yr 3 Sem 1:`);
    mappings.forEach(m => {
        console.log(`- Faculty: ${m.faculty?.name || m.facultyId}, Subject: ${m.subject?.name} (${m.subject?.code}), Section: ${m.section?.name}`);
    });

    // 2. Timetable records
    const timetables = await prisma.timetable.findMany({
        where: {
            subject: {
                departmentId: eceDept?.id,
                year: '3',
                semester: '1'
            }
        },
        include: {
            subject: true,
            section: true
        }
    });
    console.log(`\nFound ${timetables.length} Timetable records for ECE Yr 3 Sem 1:`);
    timetables.forEach(t => {
        console.log(`- Subject: ${t.subject?.name}, Section: ${t.section?.name}, Day: ${t.dayOfWeek}, Period: ${t.periodId}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
