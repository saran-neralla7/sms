import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const subjectId = searchParams.get("subjectId");

  if (!subjectId) {
    return NextResponse.json({ error: "Missing subjectId" }, { status: 400 });
  }

  try {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: {
        id: true,
        name: true,
        code: true,
        syllabus: true,
      },
    });

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    const mappings = await prisma.subjectCoPoMapping.findMany({
      where: { subjectId },
    });

    return NextResponse.json({
      subject,
      mappings,
    });
  } catch (error) {
    console.error("Error fetching CO-PO mappings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { subjectId, mappings } = body;

    if (!subjectId || !Array.isArray(mappings)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch subject to get custom outcomes from syllabus
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { syllabus: true },
    });

    let validCOs = ["CO1", "CO2", "CO3", "CO4", "CO5"];
    if (subject?.syllabus) {
      const syllabusObj = subject.syllabus as any;
      if (Array.isArray(syllabusObj.outcomes) && syllabusObj.outcomes.length > 0) {
        validCOs = syllabusObj.outcomes.map((co: any) => co.code || co.id || co);
      }
    }

    const validPOs = Array.from({ length: 12 }, (_, i) => `PO${i + 1}`);

    const validatedMappings: { subjectId: string; co: string; po: string; weight: number | null }[] = [];

    for (const m of mappings) {
      if (!validCOs.includes(m.co) || !validPOs.includes(m.po)) {
        return NextResponse.json(
          { error: `Invalid CO (${m.co}) or PO (${m.po}) value` },
          { status: 400 }
        );
      }

      if (m.weight !== null && (typeof m.weight !== "number" || m.weight < 1 || m.weight > 3)) {
        return NextResponse.json(
          { error: `Invalid weight value: ${m.weight}. Must be 1, 2, 3, or null` },
          { status: 400 }
        );
      }

      validatedMappings.push({
        subjectId,
        co: m.co,
        po: m.po,
        weight: m.weight,
      });
    }

    // Run delete & recreate in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.subjectCoPoMapping.deleteMany({
        where: { subjectId },
      });

      if (validatedMappings.length > 0) {
        await tx.subjectCoPoMapping.createMany({
          data: validatedMappings,
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving CO-PO mappings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
