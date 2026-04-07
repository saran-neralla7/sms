import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const path = req.nextUrl.pathname;
        const role = token?.role;

        // Global Restriction: Only ADMIN, DIRECTOR, PRINCIPAL, HOD can access dashboard and admin routes
        const allowedRoles = ["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"];
        const isGlobalAdmin = allowedRoles.includes(role as string);

        // Allow access to public/student photos and the new dynamic stream route
        if (path.startsWith("/student-photos") || path.startsWith("/api/student-photos")) {
            return;
        }

        // --- STUDENT ROLE RESTRICTION ---
        // If the user is a STUDENT, completely trap them in the student portal
        if (role === "STUDENT") {
            if (!path.startsWith("/student") && !path.startsWith("/api") && path !== "/login") {
                const url = req.nextUrl.clone();
                url.pathname = "/student/dashboard";
                return NextResponse.redirect(url);
            }
            return; // Let them access /student routes
        }

        // --- OFFICE ROLE RESTRICTION ---
        if (role === "OFFICE") {
            if (!path.startsWith("/office") && !path.startsWith("/api") && path !== "/login") {
                const url = req.nextUrl.clone();
                url.pathname = "/office/dashboard";
                return NextResponse.redirect(url);
            }
            return;
        }

        // Protected Admin Routes: /admin, /reports, /faculty, /fees, /timetables, /student
        // Notice we explicitly added /student here to prevent Admins/Faculty from needing to go there, though harmless.
        const adminRoutes = ["/admin", "/reports", "/faculty", "/fees", "/timetables"];

        if (adminRoutes.some(prefix => path.startsWith(prefix))) {
            // Special exemption: FACULTY role can access /faculty and /reports routes
            if ((path.startsWith("/faculty") || path.startsWith("/reports")) && role === "FACULTY") {
                return;
            }

            if (!isGlobalAdmin) {
                const url = req.nextUrl.clone();
                url.pathname = "/dashboard"; // Redirect unauthorized access to their dashboard
                return NextResponse.redirect(url);
            }
        }

        // /dashboard and /attendance are valid for all authenticated users EXCEPT STUDENT (handled above)
    },
    {
        callbacks: {
            authorized: ({ req, token }) => {
                const path = req.nextUrl.pathname;
                if (path === "/") return true;
                return !!token;
            },
        },
    }
);

export const config = {
    matcher: [
        "/((?!login|api/auth|api/upload-photos|api/student-photos|_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|sw.js|workbox|icon-|apple-icon|student-photos).*)",
    ],
};
