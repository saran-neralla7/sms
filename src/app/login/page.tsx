"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaEye, FaEyeSlash, FaTimes, FaPaperPlane } from "react-icons/fa";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    // Forgot Password State
    const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
    const [forgotUsername, setForgotUsername] = useState("");
    const [forgotStatus, setForgotStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: "" });
    const [resetLoading, setResetLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        // ... (existing login logic)
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
            // ... (existing redirect logic)
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
                    router.push("/dashboard");
                } else if (targetRole === "FACULTY") {
                    router.push("/faculty/dashboard");
                } else if (targetRole === "OFFICE") {
                    router.push("/office/dashboard");
                } else {
                    router.push("/dashboard"); // Fallback
                }
            } catch (e) {
                console.error("Failed to fetch session for redirect", e);
                router.push("/dashboard");
            }
        }
    };

    const handleForgotSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotUsername.trim()) return;

        setResetLoading(true);
        setForgotStatus({ type: null, message: "" });

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: forgotUsername }),
            });

            if (res.ok) {
                setForgotStatus({
                    type: "success",
                    message: "Request submitted! Please contact your administrator to complete the reset."
                });
                setForgotUsername("");
            } else {
                setForgotStatus({ type: "error", message: "Failed to submit request. Try again." });
            }
        } catch (error) {
            setForgotStatus({ type: "error", message: "Something went wrong." });
        } finally {
            setResetLoading(false);
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
                                name="username"
                                id="username"
                                autoComplete="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                placeholder="Enter username"
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    id="password"
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 pr-10 text-slate-900 placeholder-slate-400 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
                                </button>
                            </div>

                            <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center">
                                    <input
                                        id="remember-me"
                                        name="remember-me"
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-700">
                                        Remember me
                                    </label>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsForgotModalOpen(true)}
                                    className="text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
                                >
                                    Forgot Password?
                                </button>
                            </div>
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
            </motion.div >

            {/* Forgot Password Modal */}
            <AnimatePresence>
                {
                    isForgotModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsForgotModalOpen(false)}
                                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
                            >
                                <button
                                    onClick={() => setIsForgotModalOpen(false)}
                                    className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
                                >
                                    <FaTimes />
                                </button>

                                <h3 className="mb-2 text-xl font-bold text-slate-900">Reset Password</h3>
                                <p className="mb-6 text-sm text-slate-500">
                                    Enter your username below to request a password reset from the administrator.
                                </p>

                                <form onSubmit={handleForgotSubmit} className="space-y-4">
                                    {forgotStatus.message && (
                                        <div className={`rounded-lg p-3 text-sm border ${forgotStatus.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                            {forgotStatus.message}
                                        </div>
                                    )}

                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
                                        <input
                                            type="text"
                                            value={forgotUsername}
                                            onChange={(e) => setForgotUsername(e.target.value)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                            placeholder="Enter your username"
                                            required
                                            disabled={forgotStatus.type === 'success'}
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={resetLoading || forgotStatus.type === 'success'}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {resetLoading ? (
                                            <>Processing...</>
                                        ) : (
                                            <>
                                                <FaPaperPlane size={12} /> Send Request
                                            </>
                                        )}
                                    </button>
                                </form>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence >
        </div >
    );
}
