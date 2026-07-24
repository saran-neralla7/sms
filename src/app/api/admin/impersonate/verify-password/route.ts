import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (!["ADMIN", "DIRECTOR", "SUPERADMIN"].includes(role?.toUpperCase())) {
    return NextResponse.json({ error: "Access Denied: Only Admins can impersonate." }, { status: 403 });
  }

  try {
    const { password } = await req.json();
    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: (session.user as any).id }
    });

    if (!adminUser) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const isValid = await bcrypt.compare(password, adminUser.password);
    if (!isValid) {
      return NextResponse.json({ error: "Incorrect Admin Password" }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error verifying password:", error);
    return NextResponse.json({ error: "Failed to verify password" }, { status: 500 });
  }
}
