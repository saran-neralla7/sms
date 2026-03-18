"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FaKey, FaShieldAlt, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";

export default function StudentSettingsPage() {
    const [passwords, setPasswords] = useState({
        current: "",
        new: "",
        confirm: ""
    });
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: "" });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (passwords.new !== passwords.confirm) {
            setStatus({ type: 'error', message: "New passwords do not match." });
            return;
        }

        if (passwords.new.length < 6) {
            setStatus({ type: 'error', message: "Password must be at least 6 characters long." });
            return;
        }

        setLoading(true);
        setStatus({ type: null, message: "" });

        try {
            const res = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentPassword: passwords.current,
                    newPassword: passwords.new
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setStatus({ type: 'success', message: "Password updated successfully!" });
                setPasswords({ current: "", new: "", confirm: "" });
            } else {
                setStatus({ type: 'error', message: data.error || "Failed to update password." });
            }
        } catch (error) {
            setStatus({ type: 'error', message: "An unexpected error occurred." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-4xl animate-in fade-in duration-500">
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-slate-900">Account Settings</h1>
                <p className="mt-2 text-slate-600">Manage your password and security preferences.</p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div className="md:col-span-1">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
                            <FaShieldAlt size={24} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900">Security Tips</h2>
                        <ul className="mt-4 space-y-3 text-sm text-slate-600">
                            <li className="flex items-start gap-2">
                                <span className="mt-1 text-red-500">•</span>
                                Use a mix of letters, numbers, and symbols.
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="mt-1 text-red-500">•</span>
                                Avoid using common words or your roll number.
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="mt-1 text-red-500">•</span>
                                Change your password periodically.
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="md:col-span-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                        <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900">
                            <FaKey className="text-red-500" />
                            Change Password
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {status.message && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex items-center gap-3 rounded-xl p-4 text-sm font-medium border ${
                                        status.type === 'success' 
                                            ? 'bg-green-50 text-green-700 border-green-100' 
                                            : 'bg-red-50 text-red-700 border-red-100'
                                    }`}
                                >
                                    {status.type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />}
                                    {status.message}
                                </motion.div>
                            )}

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-700">Current Password</label>
                                <input
                                    type="password"
                                    value={passwords.current}
                                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 placeholder:text-slate-400"
                                    placeholder="Enter current password"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">New Password</label>
                                    <input
                                        type="password"
                                        value={passwords.new}
                                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 placeholder:text-slate-400"
                                        placeholder="Min. 6 characters"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">Confirm New Password</label>
                                    <input
                                        type="password"
                                        value={passwords.confirm}
                                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 placeholder:text-slate-400"
                                        placeholder="Repeat new password"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full rounded-xl bg-slate-900 py-4 text-base font-bold text-white shadow-xl shadow-slate-900/10 transition-all hover:bg-slate-800 hover:shadow-2xl hover:shadow-slate-900/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loading ? "Updating Security..." : "Update Password"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
