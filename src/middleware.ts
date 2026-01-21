import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const path = req.nextUrl.pathname;
        const role = token?.role;

        // 1. Student Management -> Allow All Authenticated Users
        // (Access control is handled within the page for Read-Only vs Edit)
        if (path.startsWith("/admin/students")) {
            return;
        }

        // 2. Promotion -> Admin Only
        if (path.startsWith("/admin/promote")) {
            if (role !== "ADMIN" && role !== "DIRECTOR" && role !== "PRINCIPAL") {
                const url = req.nextUrl.clone();
                url.pathname = "/";
                return NextResponse.redirect(url);
            }
            return;
        }

        // 3. General Admin -> Global Admins (Users, Departments, Sections, Alumni)
        if (path.startsWith("/admin")) {
            const globalAdmins = ["ADMIN", "DIRECTOR", "PRINCIPAL"];
            if (!globalAdmins.includes(role as string)) {
                const url = req.nextUrl.clone();
                url.pathname = "/";
                return NextResponse.redirect(url);
            }
            return;
        }
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
    }
);

export const config = {
    matcher: [
        "/((?!login|api/auth|_next/static|_next/image|favicon.ico|manifest.json).*)",
    ],
};
