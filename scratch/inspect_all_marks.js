const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const papers = await prisma.midExamPaper.findMany({
        include: {
            subject: true,
            section: true
        }
    });

    console.log(`Found ${papers.length} mid exam papers:`);
    const papersDist = {};
    papers.forEach(p => {
        const key = `Yr ${p.year} - Sem ${p.semester} - Sec ${p.section?.name || 'None'} - Subj ${p.subject?.name || 'None'}`;
        papersDist[key] = (papersDist[key] || 0) + 1;
    });
    console.log(papersDist);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
