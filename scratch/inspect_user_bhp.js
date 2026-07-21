const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Searching for user 'BHP'...");
    const user = await prisma.user.findFirst({
        where: {
            username: { equals: 'BHP', mode: 'insensitive' }
        },
        include: {
            faculty: true,
            department: true
        }
    });

    console.log("User details:", user);
    
    if (user && user.faculty) {
        // Let's check their faculty subject mappings
        const mappings = await prisma.facultySubjectMapping.findMany({
            where: { facultyId: user.faculty.id },
            include: {
                subject: true,
                section: true
            }
        });
        console.log(`\nFound ${mappings.length} FacultySubjectMapping records for ${user.faculty.empName}:`);
        mappings.forEach(m => {
            console.log(`- Subject: ${m.subject?.name} (${m.subject?.code}), Year: ${m.subject?.year}, Sem: ${m.subject?.semester}, Section: ${m.section?.name}`);
        });
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
