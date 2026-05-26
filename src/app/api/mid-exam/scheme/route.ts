import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["ADMIN", "HOD", "DIRECTOR", "PRINCIPAL", "FACULTY"];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const schemes = await prisma.evaluationScheme.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    return NextResponse.json(schemes);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch schemes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["ADMIN", "HOD", "DIRECTOR"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const scheme = await prisma.evaluationScheme.create({
      data: {
        name: body.name,
        subjectType: body.subjectType,
        mid1MaxMarks: body.mid1MaxMarks ?? 30,
        mid2MaxMarks: body.mid2MaxMarks ?? 30,
        mid1ScaledTo: body.mid1ScaledTo ?? 20,
        mid2ScaledTo: body.mid2ScaledTo ?? 20,
        assignmentMax: body.assignmentMax ?? 10,
        internalMax: body.internalMax ?? 30,
        isDefault: body.isDefault ?? false,
        departmentId: body.departmentId ?? null,
      },
    });
    return NextResponse.json(scheme);
  } catch (e) {
    return NextResponse.json({ error: "Failed to create scheme" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["ADMIN", "HOD", "DIRECTOR"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { id, ...data } = body;
    const scheme = await prisma.evaluationScheme.update({ where: { id }, data });
    return NextResponse.json(scheme);
  } catch (e) {
    return NextResponse.json({ error: "Failed to update scheme" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["ADMIN", "DIRECTOR"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.evaluationScheme.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
