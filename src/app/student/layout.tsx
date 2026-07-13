import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import StudentSidebar from "@/components/StudentSidebar";

export default async function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "STUDENT") {
        redirect("/login");
    }

    // If admin has disabled student logins, kick out already-logged-in students too
    const disableSetting = await prisma.systemSetting.findUnique({
        where: { key: "DISABLE_STUDENT_LOGIN" }
    });
    if (disableSetting?.value === "true") {
        // Redirect to student login page with a flag so it shows the "disabled" popup
        redirect("/student-login?disabled=1");
    }

    return (
        <div className="flex min-h-screen bg-slate-50">
            <StudentSidebar />
            <main className="flex-1 flex flex-col min-w-0 md:ml-64 py-8 px-4 sm:px-6 lg:px-8 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
