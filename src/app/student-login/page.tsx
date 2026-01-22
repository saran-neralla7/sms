"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";

export default function StudentLoginPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
            <Link href="/" className="absolute left-6 top-6 flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors">
                <FaArrowLeft /> Back to Home
            </Link>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
            >
                <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 ring-4 ring-blue-50">
                    <img
                        src="https://www.gvpcdpgc.edu.in/gvplogo.jpg"
                        alt="Logo"
                        className="h-20 w-20 rounded-full object-cover"
                    />
                </div>

                <h1 className="mb-2 text-3xl font-bold text-slate-900">Student Login</h1>
                <div className="mb-6 inline-block rounded-full bg-blue-100 px-4 py-1 text-sm font-semibold text-blue-700">
                    Coming Soon
                </div>
                <p className="max-w-md text-slate-500">
                    We are working on a dedicated portal for students. Please check back later.
                </p>
            </motion.div>
        </div>
    );
}
