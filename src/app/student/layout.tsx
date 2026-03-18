import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

    return (
        <div className="flex min-h-screen bg-slate-50">
            <StudentSidebar />
            <main className="flex-1 flex flex-col min-w-0 md:ml-64 py-8 px-4 sm:px-6 lg:px-8 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
