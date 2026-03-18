import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

interface AdminLayoutProps {
    children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const role = (session.user as any).role;
    const allowedRoles = ["ADMIN", "DIRECTOR", "PRINCIPAL"]; // Matches middleware

    if (!allowedRoles.includes(role)) {
        redirect("/dashboard"); // Unauthorized users go to their dashboard
    }

    return (
        <div className="container mx-auto py-8 px-4">
            {children}
        </div>
    );
}
