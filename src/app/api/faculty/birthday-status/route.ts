import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ isBirthday: false });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                facultyId: true,
                faculty: {
                    select: {
                        id: true,
                        empName: true,
                        gender: true,
                        dob: true,
                        photoUrl: true,
                        resignDate: true
                    }
                }
            }
        });

        if (!user || !user.faculty || user.faculty.resignDate !== null || !user.faculty.dob) {
            return NextResponse.json({ isBirthday: false });
        }

        const today = new Date();
        const dob = new Date(user.faculty.dob);

        const isToday = dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();

        if (!isToday) {
            return NextResponse.json({ isBirthday: false });
        }

        const genderStr = (user.faculty.gender || "").trim().toUpperCase();
        const isFemale = genderStr === "FEMALE" || genderStr === "F" || genderStr === "WOMAN";
        const salutation = isFemale ? "Madam" : "Sir";

        return NextResponse.json({
            isBirthday: true,
            salutation,
            empName: user.faculty.empName,
            gender: user.faculty.gender,
            photoUrl: user.faculty.photoUrl || null
        });
    } catch (error: any) {
        console.error("Error in GET /api/faculty/birthday-status:", error);
        return NextResponse.json({ isBirthday: false }, { status: 500 });
    }
}
