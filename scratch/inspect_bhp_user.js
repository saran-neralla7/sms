const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Search for BHP user
    const user = await prisma.user.findFirst({
        where: {
            username: { contains: 'BHP', mode: 'insensitive' }
        },
        include: {
            faculty: true
        }
    });

    if (!user) {
        console.log("No user found with BHP in username.");
        return;
    }

    console.log("User details:");
    console.log(JSON.stringify(user, null, 2));

    if (user.facultyId) {
        // Find mapped subjects
        const mappings = await prisma.facultySubjectMapping.findMany({
            where: { facultyId: user.facultyId },
            include: {
                subject: true,
                section: true
            }
        });

        console.log(`\nMappings for Faculty ID ${user.facultyId}:`);
        mappings.forEach(m => {
            console.log(`- Subject: ${m.subject.name} (${m.subject.code}), Sec: ${m.section.name}, Year: ${m.subject.year}, Sem: ${m.subject.semester}`);
        });
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
