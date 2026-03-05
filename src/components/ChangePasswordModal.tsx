"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaLock, FaCheck, FaExclamationCircle, FaShieldAlt } from "react-icons/fa";

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: "" });
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            setStatus({ type: "error", message: "New passwords do not match" });
            return;
        }

        setLoading(true);
        setStatus({ type: null, message: "" });

        try {
            const res = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await res.json();

            if (res.ok) {
                setStatus({ type: "success", message: "Password updated successfully!" });
                setTimeout(() => {
                    onClose();
                    // Reset form
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setStatus({ type: null, message: "" });
                }, 2000);
            } else {
                setStatus({ type: "error", message: data.error || "Failed to update password" });
            }
        } catch (error) {
            setStatus({ type: "error", message: "Something went wrong" });
        } finally {
            setLoading(false);
        }
    };

    // Use createPortal to escape the stacking context of motion.nav in Navbar
    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5"
                >
                    {/* Decorative Header */}
                    <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-6 text-white">
                        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-xl"></div>
                        <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/10 blur-xl"></div>

                        <div className="relative flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md shadow-inner border border-white/20">
                                <FaShieldAlt className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold tracking-tight">Security Settings</h3>
                                <p className="text-blue-100 text-sm">Update your account password</p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="absolute right-4 top-4 rounded-full p-1 text-blue-100 hover:bg-white/10 hover:text-white transition-colors"
                        >
                            <FaTimes size={18} />
                        </button>
                    </div>

                    <div className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <AnimatePresence mode="wait">
                                {status.message && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium border ${status.type === 'success'
                                            ? 'bg-green-50 text-green-700 border-green-200'
                                            : 'bg-red-50 text-red-700 border-red-200'
                                            }`}
                                    >
                                        {status.type === 'success' ? <FaCheck className="shrink-0" /> : <FaExclamationCircle className="shrink-0" />}
                                        {status.message}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current Password</label>
                                    <div className="relative">
                                        <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                                            placeholder="Enter current password"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">New Password</label>
                                    <div className="relative">
                                        <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                                            placeholder="Min. 6 characters"
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Confirm Password</label>
                                    <div className="relative">
                                        <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                                            placeholder="Re-enter new password"
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || status.type === 'success'}
                                    className="relative overflow-hidden rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30 disabled:opacity-70 disabled:cursor-not-allowed active:scale-95"
                                >
                                    {loading ? (
                                        <div className="flex items-center gap-2">
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                                            <span>Updating...</span>
                                        </div>
                                    ) : "Update Password"}
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
}
