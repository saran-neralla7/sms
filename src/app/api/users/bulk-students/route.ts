import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(session.user.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        // Fetch all current students
        const allStudents = await prisma.student.findMany({
            select: { id: true, rollNumber: true, departmentId: true }
        });

        // Fetch all existing STUDENT users to see who already has an account
        const existingStudentUsers = await prisma.user.findMany({
            where: { role: "STUDENT" },
            select: { username: true }
        });
        
        const existingUsernames = new Set(existingStudentUsers.map(u => u.username));

        // Filter students missing a login account
        const missingLogins = allStudents.filter(s => !existingUsernames.has(s.rollNumber));

        if (missingLogins.length === 0) {
            return NextResponse.json({ message: "All students already have login accounts.", createdCount: 0 });
        }

        // We prepare to hash passwords. This takes compute, so we do it optimally.
        // For default student logins, username = rollNumber, password = rollNumber
        console.log(`Generating ${missingLogins.length} missing student logins...`);
        let createdCount = 0;

        for (const student of missingLogins) {
            const hashedPassword = await bcrypt.hash(student.rollNumber, 10);
            await prisma.user.create({
                data: {
                    username: student.rollNumber,
                    password: hashedPassword,
                    role: "STUDENT",
                    departmentId: student.departmentId
                }
            });
            createdCount++;
        }

        return NextResponse.json({ 
            message: `Successfully generated ${createdCount} student login accounts.`,
            createdCount
        });

    } catch (error: any) {
        console.error("Bulk Student Login Generation Error:", error);
        return NextResponse.json({ error: "Failed to generate student logins" }, { status: 500 });
    }
}
