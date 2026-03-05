import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting seed...')

    // 1. Create Departments
    const cse = await prisma.department.upsert({
        where: { code: 'CSE' },
        update: {},
        create: { name: 'Computer Science and Engineering', code: 'CSE' }
    })
    const csm = await prisma.department.upsert({
        where: { code: 'CSM' },
        update: {},
        create: { name: 'Computer Science and Machine Learning', code: 'CSM' }
    })
    console.log('Departments created.')

    // 2. Create Sections
    const sections = ['A', 'B', 'C']
    const sectionMap: Record<string, string> = {}
    for (const s of sections) {
        const sec = await prisma.section.upsert({
            where: { name: s },
            update: {},
            create: { name: s }
        })
        sectionMap[s] = sec.id
    }
    console.log('Sections created.')

    // 3. Create Users
    const password = await hash('password123', 12)

    // Admin
    await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: { username: 'admin', password, role: 'ADMIN' }
    })

    // HODs
    await prisma.user.upsert({
        where: { username: 'hod-cse' },
        update: {},
        create: { username: 'hod-cse', password, role: 'HOD', departmentId: cse.id }
    })
    await prisma.user.upsert({
        where: { username: 'hod-csm' },
        update: {},
        create: { username: 'hod-csm', password, role: 'HOD', departmentId: csm.id }
    })
    console.log('Users created.')

    // 4. Create Academic Year
    const currentAcademicYear = await prisma.academicYear.upsert({
        where: { name: '2024-2025' },
        update: { isCurrent: true },
        create: {
            name: '2024-2025',
            startDate: new Date('2024-06-01'),
            endDate: new Date('2025-05-31'),
            isCurrent: true
        }
    })
    console.log('Academic Year created.')

    // 5. Create Batches
    const batchesData = [
        { name: '2021-2025', start: 2021, end: 2025 },
        { name: '2022-2026', start: 2022, end: 2026 },
        { name: '2023-2027', start: 2023, end: 2027 },
        { name: '2024-2028', start: 2024, end: 2028 },
    ]
    const batchMap: Record<string, string> = {} // Maps startYear (string) to batchId

    for (const b of batchesData) {
        const batch = await prisma.batch.upsert({
            where: { name: b.name },
            update: {},
            create: { name: b.name, startYear: b.start, endYear: b.end }
        })
        batchMap[b.start.toString()] = batch.id
    }
    console.log('Batches created.')

    // 6. Create Students (Specifically 2nd Semester as requested)
    const currentYearStart = 2024 // Based on 2024-2025 academic year

    // Helper to get batch ID based on current student year
    const getBatchIdForYear = (studentYear: string) => {
        const yearInt = parseInt(studentYear)
        const joinYear = currentYearStart - (yearInt - 1)
        return batchMap[joinYear.toString()]
    }

    const studentData = [
        // Year 1 (Batch 2024)
        { roll: '24B81A0501', name: 'John Doe (1st Yr)', year: '1', dept: cse.id, sec: 'A' },
        { roll: '24B81A0502', name: 'Jane Smith (1st Yr)', year: '1', dept: cse.id, sec: 'B' },
        { roll: '24B81A4201', name: 'Alice ML (1st Yr)', year: '1', dept: csm.id, sec: 'A' },

        // Year 2 (Batch 2023)
        { roll: '23B81A0501', name: 'Bob Johnson (2nd Yr)', year: '2', dept: cse.id, sec: 'A' },
        { roll: '23B81A0560', name: 'Emily Davis (2nd Yr)', year: '2', dept: cse.id, sec: 'B' },
        { roll: '23B81A4201', name: 'Charlie ML (2nd Yr)', year: '2', dept: csm.id, sec: 'A' },

        // Year 3 (Batch 2022)
        { roll: '22B81A0501', name: 'David Wilson (3rd Yr)', year: '3', dept: cse.id, sec: 'A' },
        { roll: '22B81A05L1', name: 'Fiona Lateral (3rd Yr)', year: '3', dept: cse.id, sec: 'C' },

        // Year 4 (Batch 2021)
        { roll: '21B81A0501', name: 'George Senior (4th Yr)', year: '4', dept: cse.id, sec: 'A' },
        { roll: '21B81A0599', name: 'Hannah Final (4th Yr)', year: '4', dept: cse.id, sec: 'B' },
    ]

    for (const stud of studentData) {
        await prisma.student.upsert({
            where: { rollNumber: stud.roll },
            update: {
                year: stud.year,
                semester: '2', // Force 2nd Sem
                departmentId: stud.dept,
                sectionId: sectionMap[stud.sec],
                batchId: getBatchIdForYear(stud.year)
            },
            create: {
                rollNumber: stud.roll,
                name: stud.name,
                mobile: '9876543210',
                year: stud.year,
                semester: '2',
                departmentId: stud.dept,
                sectionId: sectionMap[stud.sec],
                batchId: getBatchIdForYear(stud.year)
            }
        })
    }
    console.log('Students created.')

    // 5. Create Alumni
    await prisma.alumni.upsert({
        where: { rollNumber: '19B81A0501' },
        update: {},
        create: {
            rollNumber: '19B81A0501',
            name: 'Alumni Alpha',
            mobile: '9988776655',
            passingYear: '2023',
            departmentId: cse.id
        }
    })
    await prisma.alumni.upsert({
        where: { rollNumber: '19B81A4299' },
        update: {},
        create: {
            rollNumber: '19B81A4299',
            name: 'Alumni Beta',
            mobile: '1122334455',
            passingYear: '2023',
            departmentId: csm.id
        }
    })
    console.log('Alumni created.')

    console.log('Seeding completed.')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
