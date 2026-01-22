"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const res = await signIn("credentials", {
            username,
            password,
            redirect: false,
        });
        setIsLoading(false);

        if (res?.error) {
            setError("Invalid username or password");
        } else {
            // Fetch session to determine role
            try {
                // Add timestamp to prevent caching
                const sessionRes = await fetch(`/api/auth/session?t=${Date.now()}`);
                const sessionData = await sessionRes.json();
                const role = sessionData?.user?.role;

                console.log("Login Success: Detected Role:", role); // Debugging

                // Redirect based on role (Case insensitive check just in case)
                const targetRole = role?.toUpperCase();

                if (["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes(targetRole)) {
                    router.push("/admin/students");
                } else {
                    router.push("/dashboard"); // Faculty/User -> Attendance Page
                }
            } catch (e) {
                console.error("Failed to fetch session for redirect", e);
                router.push("/dashboard");
            }
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-900/5"
            >
                <div className="bg-blue-600 p-8 text-center">
                    <div className="mb-4 flex justify-center">
                        <img
                            src="https://gvpcdpgc.edu.in/gvplogo.jpg"
                            alt="GVP Logo"
                            className="h-20 w-20 rounded-full border-4 border-white object-cover bg-white"
                        />
                    </div>
                    <h1 className="text-3xl font-bold text-white">GVPCDPGC(A)</h1>
                    <p className="mt-2 text-blue-100">Student Management System</p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                placeholder="Enter username"
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {error && (
                            <div className="rounded-md bg-red-50 p-3 text-sm font-medium text-red-600 border border-red-100">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-lg bg-blue-600 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400"
                        >
                            {isLoading ? "Signing in..." : "Sign In"}
                        </button>
                    </form>
                </div>
                {/* Footer removed to avoid duplication with global footer */}
            </motion.div>
        </div>
    );
}
