import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subject = await prisma.subject.findUnique({
      where: { id: params.id },
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

    return NextResponse.json(subject);
  } catch (error: any) {
    console.error("Fetch Syllabus Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch syllabus" }, { status: 500 });
  }
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { syllabus } = body;

    if (!syllabus) {
      return NextResponse.json({ error: "Syllabus content is required" }, { status: 400 });
    }

    const subject = await prisma.subject.update({
      where: { id: params.id },
      data: {
        syllabus: syllabus,
      },
    });

    return NextResponse.json({ success: true, syllabus: subject.syllabus });
  } catch (error: any) {
    console.error("Save Syllabus Error:", error);
    return NextResponse.json({ error: error.message || "Failed to save syllabus" }, { status: 500 });
  }
}
