import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getElectiveBatches, saveElectiveBatches } from "@/lib/elective-batches";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subjectId");
    if (!subjectId) {
        return NextResponse.json({ error: "subjectId is required" }, { status: 400 });
    }

    const allBatches = getElectiveBatches();
    const result: Record<string, string> = {};

    // Filter only keys that end with _subjectId
    Object.entries(allBatches).forEach(([key, batchName]) => {
        const parts = key.split("_");
        if (parts.length === 2 && parts[1] === subjectId) {
            const studentId = parts[0];
            result[studentId] = batchName;
        }
    });

    return NextResponse.json(result);
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { subjectId, studentBatches } = body; // studentBatches is { [studentId]: batchName }

        if (!subjectId || !studentBatches) {
            return NextResponse.json({ error: "subjectId and studentBatches are required" }, { status: 400 });
        }

        const allBatches = getElectiveBatches();

        // 1. Clear existing mappings for this subjectId
        Object.keys(allBatches).forEach((key) => {
            const parts = key.split("_");
            if (parts.length === 2 && parts[1] === subjectId) {
                delete allBatches[key];
            }
        });

        // 2. Set new mappings
        Object.entries(studentBatches).forEach(([studentId, batchName]) => {
            if (batchName && typeof batchName === "string" && batchName.trim() !== "") {
                allBatches[`${studentId}_${subjectId}`] = batchName.trim();
            }
        });

        saveElectiveBatches(allBatches);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error saving elective batches:", error);
        return NextResponse.json({ error: "Failed to save elective batches" }, { status: 500 });
    }
}
