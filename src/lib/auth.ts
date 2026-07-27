import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logActivity } from "@/lib/logging";
import { cookies } from "next/headers";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) {
                    return null;
                }

                const user = await prisma.user.findUnique({
                    where: { username: credentials.username },
                    include: { faculty: true }
                });

                if (!user) {
                    await logActivity("SYSTEM", "LOGIN_FAILURE", "Auth", credentials.username, { reason: "User not found" });
                    return null;
                }

                if (user.role === "STUDENT") {
                    const disableSetting = await prisma.systemSetting.findUnique({
                        where: { key: "DISABLE_STUDENT_LOGIN" }
                    });
                    if (disableSetting && disableSetting.value === "true") {
                        await logActivity(user.id, "LOGIN_FAILURE", "Auth", user.username, { reason: "Deactivated: Student logins disabled by Admin" });
                        throw new Error("Student logins are currently disabled by the Administrator.");
                    }

                    const student = await prisma.student.findUnique({
                        where: { rollNumber: user.username }
                    });
                    if (student?.isLeftCollege) {
                        await logActivity(user.id, "LOGIN_FAILURE", "Auth", user.username, { reason: "Deactivated: Left College" });
                        throw new Error("Your account has been deactivated as you have left the college.");
                    }
                }

                const isPasswordValid = await bcrypt.compare(
                    credentials.password,
                    user.password
                );

                if (!isPasswordValid) {
                    await logActivity(user.id, "LOGIN_FAILURE", "Auth", user.username, { reason: "Incorrect password" });
                    return null;
                }

                await logActivity(user.id, "LOGIN_SUCCESS", "Auth", user.username, { role: user.role });

                return {
                    id: user.id,
                    username: user.username,
                    name: user.faculty?.empName || user.username, // Attach full name here
                    role: user.role,
                    departmentId: user.departmentId,
                    facultyId: user.facultyId
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role;
                token.id = user.id;
                token.departmentId = user.departmentId as string | null | undefined;
                token.username = (user as any).username;
                token.name = user.name;
                token.facultyId = (user as any).facultyId;
            }
            return token;
        },
        async session({ session, token }) {
            if (session?.user) {
                (session.user as any).role = token.role;
                (session.user as any).id = token.id;
                (session.user as any).departmentId = token.departmentId;
                (session.user as any).username = token.username;
                (session.user as any).facultyId = token.facultyId;
                session.user.name = token.name as string | null | undefined;

                try {
                    const cookieStore = await cookies();
                    const impersonateCookie = cookieStore.get("impersonate_session")?.value;
                    if (impersonateCookie) {
                        const parsed = JSON.parse(decodeURIComponent(impersonateCookie));
                        if (["ADMIN", "DIRECTOR", "SUPERADMIN"].includes(token.role as string)) {
                            (session.user as any).role = parsed.targetRole;
                            (session.user as any).id = parsed.targetUserId;
                            (session.user as any).departmentId = parsed.targetDepartmentId;
                            (session.user as any).username = parsed.targetUsername;
                            (session.user as any).facultyId = parsed.targetFacultyId;
                            session.user.name = parsed.targetName;
                            (session.user as any).isImpersonating = true;
                            (session.user as any).impersonateReadOnly = parsed.isReadOnly;
                        }
                    }
                } catch (e) {
                    console.error("Error parsing impersonation cookie in session callback:", e);
                }
            }
            return session;
        },
    },
    events: {
        async signOut({ token }) {
            if (token && token.id) {
                await logActivity(token.id as string, "LOGOUT", "Auth", (token as any).username || "", { role: token.role });
            }
        }
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
};
