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

        // Protected Admin Routes: /admin, /reports, /faculty, /fees, /timetables
        const adminRoutes = ["/admin", "/reports", "/faculty", "/fees", "/timetables"];

        if (adminRoutes.some(prefix => path.startsWith(prefix))) {
            if (!isGlobalAdmin) {
                const url = req.nextUrl.clone();
                url.pathname = "/dashboard"; // Redirect unauthorized access to their dashboard
                return NextResponse.redirect(url);
            }
        }

        // /dashboard and /attendance are valid for all authenticated users (handled by authorized callback)
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
