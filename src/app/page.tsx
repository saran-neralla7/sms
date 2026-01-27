"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import LogoSpinner from "@/components/LogoSpinner";
import { FaChalkboardTeacher, FaUserGraduate } from "react-icons/fa";
import { motion } from "framer-motion";

export default function LandingPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "authenticated") {
            // Redirect based on role if needed, or just to dashboard
            const role = (session?.user?.role || "").toUpperCase();
            if (["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD", "FACULTY", "USER"].includes(role)) {
                router.push("/dashboard");
            } else {
                router.push("/dashboard");
            }
        }
    }, [status, session, router]);

    if (status === "loading" || status === "authenticated") {
        return <LogoSpinner />;
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            {/* College Header */}
            <header className="bg-white px-4 py-6 shadow-sm sm:px-6 lg:px-8">
                <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 text-center md:flex-row md:text-left">
                    {/* Logo */}
                    <div className="flex-shrink-0">
                        <img
                            src="https://www.gvpcdpgc.edu.in/gvplogo.jpg"
                            alt="GVPCDPGC Logo"
                            className="h-24 w-24 rounded-full object-cover shadow-md md:h-28 md:w-28"
                        />
                    </div>

                    {/* Header Text */}
                    <div className="flex flex-col gap-1">
                        <h1 className="text-xl font-bold uppercase text-blue-900 sm:text-2xl md:text-3xl">
                            Gayatri Vidya Parishad College for Degree and PG Courses (Autonomous)
                        </h1>
                        <p className="text-sm font-semibold text-red-600 sm:text-base">
                            (Affiliated to Andhra University | Accredited by NAAC with &apos;A&apos; Grade)
                        </p>
                        <p className="text-xs font-semibold text-red-600 sm:text-sm">
                            (MBA and UG Engineering B.Tech(CE,CSE,ECE and ME) programs are Accredited by NBA)
                        </p>
                        <p className="text-sm font-bold text-slate-800">
                            Visakhapatnam - 530045.
                        </p>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-4xl text-center"
                >
                    <h2 className="mb-12 text-3xl font-extrabold tracking-tight text-blue-900 sm:text-4xl md:text-5xl">
                        STUDENT MANAGEMENT SYSTEM
                    </h2>

                    <div className="grid gap-8 sm:grid-cols-2 sm:gap-6 max-w-2xl mx-auto">
                        {/* Faculty Login Card */}
                        <Link href="/login" className="group relative block overflow-hidden rounded-2xl bg-white p-8 shadow-md transition-all hover:shadow-xl hover:-translate-y-1 ring-1 ring-slate-100">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                            <div className="relative flex flex-col items-center gap-4">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                                    <FaChalkboardTeacher size={32} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Faculty Login</h3>
                                    <p className="mt-2 text-sm text-slate-500">Access for Staff and Administrators</p>
                                </div>
                            </div>
                        </Link>

                        {/* Student Login Card */}
                        <Link href="/student-login" className="group relative block overflow-hidden rounded-2xl bg-white p-8 shadow-md transition-all hover:shadow-xl hover:-translate-y-1 ring-1 ring-slate-100">
                            <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                            <div className="relative flex flex-col items-center gap-4">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors duration-300">
                                    <FaUserGraduate size={32} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Student Login</h3>
                                    <p className="mt-2 text-sm text-slate-500">Access for Students and Parents</p>
                                </div>
                            </div>
                        </Link>
                    </div>
                </motion.div>
            </main>

            {/* Footer */}
            <footer className="absolute bottom-0 w-full py-6 text-center text-sm text-slate-400">
                &copy; {new Date().getFullYear()} GVPCDPGC(A). All rights reserved.
            </footer>
        </div>
    );
}
