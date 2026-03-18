"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaEye, FaEyeSlash, FaTimes, FaPaperPlane, FaArrowLeft } from "react-icons/fa";
import Link from "next/link";

export default function StudentLoginPage() {
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
        e.preventDefault();
        setIsLoading(true);
        setError("");

        const res = await signIn("credentials", {
            username,
            password,
            redirect: false,
        });

        if (res?.error) {
            setError("Invalid roll number or password");
            setIsLoading(false);
        } else {
            // Success - Next.js Middleware will handle role-based redirection 
            // but we'll manually push to student dashboard for better UX
            router.push("/student/dashboard");
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
                    message: "Reset request submitted! Please inform your HOD or Administrator."
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
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-4">
            <Link href="/" className="absolute left-8 top-8 flex items-center gap-2 text-slate-500 hover:text-red-600 transition-colors font-semibold">
                <FaArrowLeft /> Back to Website
            </Link>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/5"
            >
                <div className="bg-red-600 p-10 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 -ml-8 -mb-8 h-32 w-32 rounded-full bg-black/10 blur-2xl"></div>
                    
                    <div className="relative mb-6 flex justify-center">
                        <div className="h-24 w-24 rounded-full border-4 border-white/30 p-1 shadow-2xl backdrop-blur-sm">
                            <img
                                src="https://gvpcdpgc.edu.in/gvplogo.jpg"
                                alt="GVP Logo"
                                className="h-full w-full rounded-full object-cover bg-white"
                            />
                        </div>
                    </div>
                    <h1 className="relative text-3xl font-black tracking-tight text-white uppercase">Student Login</h1>
                    <p className="relative mt-2 text-red-100 font-medium">GVPCDPGC(A) SMS Portal</p>
                </div>

                <div className="p-8 sm:p-10">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wide">Roll Number</label>
                            <input
                                type="text"
                                name="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.toUpperCase())}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 placeholder-slate-400 text-base font-medium focus:border-red-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-red-500/10 transition-all uppercase"
                                placeholder="Enter your roll number"
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wide">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 pr-12 text-slate-900 placeholder-slate-400 text-base font-medium focus:border-red-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-red-500/10 transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors focus:outline-none"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
                                </button>
                            </div>

                            <div className="flex items-center justify-between mt-4">
                                <div className="flex items-center">
                                    <input
                                        id="remember-me"
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                                    />
                                    <label htmlFor="remember-me" className="ml-2 block text-sm font-semibold text-slate-600">
                                        Stay signed in
                                    </label>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsForgotModalOpen(true)}
                                    className="text-sm font-bold text-red-600 hover:text-red-700 focus:outline-none transition-colors"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                        </div>

                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, x: -10 }} 
                                animate={{ opacity: 1, x: 0 }}
                                className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-600 border border-red-100 flex items-center gap-2"
                            >
                                <FaTimes size={16} className="shrink-0" />
                                {error}
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-xl bg-red-600 py-4 text-lg font-black text-white shadow-xl shadow-red-600/20 transition-all hover:bg-red-700 hover:shadow-2xl hover:shadow-red-600/30 active:scale-[0.98] disabled:bg-red-300 disabled:cursor-not-allowed"
                        >
                            {isLoading ? "Validating Account..." : "Login to Portal"}
                        </button>
                    </form>
                </div>
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
                                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 h-1 w-full bg-red-600"></div>
                                <button
                                    onClick={() => setIsForgotModalOpen(false)}
                                    className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <FaTimes size={20} />
                                </button>

                                <h3 className="mb-2 text-2xl font-black text-slate-900 tracking-tight">Recover Account</h3>
                                <p className="mb-8 text-slate-500 font-medium leading-relaxed">
                                    Enter your roll number below. We will send a reset request to your department administrator for approval.
                                </p>

                                <form onSubmit={handleForgotSubmit} className="space-y-5">
                                    {forgotStatus.message && (
                                        <div className={`rounded-xl p-4 text-sm font-bold border ${forgotStatus.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                            {forgotStatus.message}
                                        </div>
                                    )}

                                    <div>
                                        <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wide">Roll Number</label>
                                        <input
                                            type="text"
                                            value={forgotUsername}
                                            onChange={(e) => setForgotUsername(e.target.value.toUpperCase())}
                                            className="w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base font-medium outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all uppercase"
                                            placeholder="Enter roll number"
                                            required
                                            disabled={forgotStatus.type === 'success'}
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={resetLoading || forgotStatus.type === 'success'}
                                        className="flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 py-4 text-base font-black text-white transition-all hover:bg-slate-800 hover:shadow-xl active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {resetLoading ? (
                                            <>Processing...</>
                                        ) : (
                                            <>
                                                <FaPaperPlane size={14} /> Request Password Reset
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
