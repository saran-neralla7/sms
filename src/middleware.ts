import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const path = req.nextUrl.pathname;
        let role = token?.role;

        // Check for impersonate_session cookie to override role/identity in middleware
        const impersonateSessionCookie = req.cookies.get("impersonate_session")?.value;
        let isImpersonating = false;
        let isReadOnly = false;
        if (impersonateSessionCookie) {
            try {
                const parsed = JSON.parse(decodeURIComponent(impersonateSessionCookie));
                // Only allow impersonation identity overriding if the actual authenticated token role is admin/director/superadmin
                if (["ADMIN", "DIRECTOR", "SUPERADMIN"].includes(token?.role as string)) {
                    role = parsed.targetRole;
                    isImpersonating = true;
                    isReadOnly = !!parsed.isReadOnly;
                }
            } catch (e) {
                console.error("Error parsing impersonation cookie in middleware:", e);
            }
        }

        // Global read-only enforcement during impersonation
        if (isImpersonating && isReadOnly) {
            const method = req.method.toUpperCase();
            if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
                if (!path.startsWith("/api/admin/impersonate/stop") && !path.startsWith("/api/auth")) {
                    return new NextResponse(
                        JSON.stringify({ error: "Access Denied: Impersonation session is in Read-Only mode." }),
                        { status: 403, headers: { "Content-Type": "application/json" } }
                    );
                }
            }
        }

        // Global Restriction: Only ADMIN, DIRECTOR, PRINCIPAL, HOD can access dashboard and admin routes
        const allowedRoles = ["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"];
        const isGlobalAdmin = allowedRoles.includes(role as string);

        // Allow access to public/student/faculty photos and the new dynamic stream route
        if (path.startsWith("/student-photos") || path.startsWith("/api/student-photos") || path.startsWith("/api/faculty-photos") || path.startsWith("/uploads/")) {
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

        // --- FACULTY ROLE RESTRICTION ---
        if (role === "FACULTY") {
            if (path === "/dashboard") {
                const url = req.nextUrl.clone();
                url.pathname = "/faculty";
                return NextResponse.redirect(url);
            }
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
                url.pathname = role === "FACULTY" ? "/faculty" : "/dashboard"; // Redirect unauthorized access to their dashboard
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
        "/((?!login|api/auth|api/upload-photos|api/student-photos|api/faculty-photos|uploads|_next/static|_next/image|favicon.ico|gvplogo.jpg|logo.png|gvp-logo.jpg|default-avatar.png|app-icon.jpg|favicon.png|file.svg|globe.svg|next.svg|vercel.svg|window.svg|icon-192.png|icon-512.png|manifest.webmanifest|manifest.json|sw.js|workbox|icon-|apple-icon|student-photos).*)",
    ],
};
