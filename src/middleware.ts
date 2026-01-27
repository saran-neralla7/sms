import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const path = req.nextUrl.pathname;
        const role = token?.role;

        // Global Restriction: Only ADMIN, DIRECTOR, PRINCIPAL can access dashboard and admin routes
        const allowedRoles = ["ADMIN", "DIRECTOR", "PRINCIPAL"];
        const isGlobalAdmin = allowedRoles.includes(role as string);

        // Allow access to public/student photos
        if (path.startsWith("/student-photos")) {
            return;
        }

        // Redirect non-admins trying to access protected routes
        // Protected routes: /dashboard, /admin, /reports, /faculty, /fees, /timetables
        const protectedPrefixes = ["/dashboard", "/admin", "/reports", "/faculty", "/fees", "/timetables"];

        if (protectedPrefixes.some(prefix => path.startsWith(prefix))) {
            if (!isGlobalAdmin) {
                // Determine redirect based on role (e.g., Student -> Student Profile, Faculty -> Faculty Dashboard in future)
                // For now, redirect to home or show error
                const url = req.nextUrl.clone();
                url.pathname = "/"; // Or a specific "Access Denied" page
                return NextResponse.redirect(url);
            }
        }
    },
    {
        callbacks: {
            authorized: ({ req, token }) => {
                const path = req.nextUrl.pathname;
                if (path === "/" || path === "/student-login") return true;
                return !!token;
            },
        },
    }
);

export const config = {
    matcher: [
        "/((?!login|api/auth|api/upload-photos|_next/static|_next/image|favicon.ico|manifest.json|student-photos).*)",
    ],
};
