import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { isBSHHod } from "@/lib/permissions";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(req.url);
        const academicYearId = url.searchParams.get("academicYearId");
        const departmentId = url.searchParams.get("departmentId");
        const searchQuery = url.searchParams.get("search")?.toLowerCase() || "";

        if (!academicYearId) {
            return NextResponse.json({ error: "academicYearId is required" }, { status: 400 });
        }

        // Fetch all responses for the academic year
        // We join via the form to ensure it belongs to the selected academic year.
        const whereClause: any = {
            form: {
                academicYearId: academicYearId
            },
            facultyId: { not: null }
        };

        const isBSH = isBSHHod(session.user);
        if (isBSH) {
            whereClause.subject = {
                year: "1"
            };
        }

        if (departmentId) {
            whereClause.faculty = {
                departmentId: departmentId
            };
        }

        const responses = await prisma.feedbackResponse.findMany({
            where: whereClause,
            include: {
                faculty: {
                    select: {
                        id: true,
                        empName: true,
                        photoUrl: true,
                        department: { select: { name: true, code: true } }
                    }
                }
            }
        });

        // Group by Faculty
        const facultyStats: Record<string, any> = {};

        responses.forEach((res) => {
            if (!res.faculty) return;
            
            // Search filter applied in JS since nested relation search in prisma can be complex
            if (searchQuery && !res.faculty.empName.toLowerCase().includes(searchQuery)) {
                return;
            }

            const facId = res.faculty.id;
            if (!facultyStats[facId]) {
                facultyStats[facId] = {
                    id: facId,
                    name: res.faculty.empName,
                    photoUrl: res.faculty.photoUrl,
                    departmentCode: res.faculty.department?.code || "-",
                    totalScore: 0,
                    respondents: 0
                };
            }

            facultyStats[facId].totalScore += res.overallRating;
            facultyStats[facId].respondents += 1;
        });

        // Calculate average and sort
        let result = Object.values(facultyStats).map((fac: any) => ({
            id: fac.id,
            name: fac.name,
            photoUrl: fac.photoUrl,
            departmentCode: fac.departmentCode,
            overallAverage: fac.respondents > 0 ? parseFloat((fac.totalScore / fac.respondents).toFixed(2)) : 0,
            totalRespondents: fac.respondents
        }));

        // Sort descending by overallAverage
        result.sort((a, b) => b.overallAverage - a.overallAverage);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Overall Faculty Report Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
