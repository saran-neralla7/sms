"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
    FaDatabase,
    FaCloudUploadAlt,
    FaGithub,
    FaSync,
    FaCheckCircle,
    FaExclamationTriangle,
    FaShieldAlt,
    FaClock,
    FaFileArchive,
    FaArrowLeft
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import Link from "next/link";

export default function SystemBackupPage() {
    const { data: session, status } = useSession();
    const [backupStatus, setBackupStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [backingUp, setBackingUp] = useState(false);
    const [actionMessage, setActionMessage] = useState<{ type: "success" | "error" | null; text: string }>({ type: null, text: "" });

    const fetchBackupStatus = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/system/backup-status");
            if (res.ok) {
                const data = await res.json();
                setBackupStatus(data);
            }
        } catch (err) {
            console.error("Failed to fetch backup status:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === "authenticated" && ["ADMIN", "DIRECTOR"].includes((session?.user as any)?.role)) {
            fetchBackupStatus();
        }
    }, [status, session]);

    const handleTriggerBackup = async () => {
        try {
            setBackingUp(true);
            setActionMessage({ type: null, text: "" });
            const res = await fetch("/api/system/trigger-backup", { method: "POST" });
            const data = await res.json();

            if (res.ok && data.success) {
                setBackupStatus(data.backupStatus);
                setActionMessage({
                    type: "success",
                    text: "Full System Backup, Google Drive Sync & GitHub Push completed successfully!"
                });
            } else {
                if (data.backupStatus) setBackupStatus(data.backupStatus);
                setActionMessage({
                    type: "error",
                    text: data.error || "Backup failed to complete."
                });
            }
        } catch (err: any) {
            setActionMessage({
                type: "error",
                text: "Failed to connect to backup server: " + (err.message || "Network error")
            });
        } finally {
            setBackingUp(false);
        }
    };

    if (status === "loading" || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <LogoSpinner fullScreen={false} />
            </div>
        );
    }

    const isSuccess = backupStatus?.status === "success";
    const isWarning = backupStatus?.status === "warning";

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <Link href="/admin" className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
                        <FaArrowLeft size={14} /> Back to Admin Gateway
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                            <FaDatabase size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">System Backup & Sync Control</h1>
                            <p className="text-sm text-slate-500">Manage site database dumps, Google Drive cloud syncs, and GitHub code backups.</p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleTriggerBackup}
                    disabled={backingUp}
                    className={`flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all ${
                        backingUp
                            ? "bg-slate-400 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-blue-500/20"
                    }`}
                >
                    <FaSync className={backingUp ? "animate-spin" : ""} size={16} />
                    {backingUp ? "Running Full Backup..." : "Run Backup Now"}
                </button>
            </div>

            {/* Notification Banner Message */}
            {actionMessage.text && (
                <div
                    className={`mb-6 rounded-xl border p-4 text-sm font-medium ${
                        actionMessage.type === "success"
                            ? "border-green-200 bg-green-50 text-green-800"
                            : "border-red-200 bg-red-50 text-red-800"
                    }`}
                >
                    {actionMessage.type === "success" ? "✅ " : "⚠️ "}
                    {actionMessage.text}
                </div>
            )}

            {/* Current Status Card */}
            <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FaShieldAlt className="text-blue-600" /> Current Backup Status
                </h2>

                <div
                    className={`rounded-xl border p-6 ${
                        isSuccess
                            ? "border-green-200 bg-green-50/50"
                            : isWarning
                            ? "border-amber-200 bg-amber-50/50"
                            : "border-red-200 bg-red-50/50"
                    }`}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div
                                className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                    isSuccess
                                        ? "bg-green-100 text-green-600"
                                        : isWarning
                                        ? "bg-amber-100 text-amber-600"
                                        : "bg-red-100 text-red-600"
                                }`}
                            >
                                {isSuccess ? (
                                    <FaCheckCircle size={20} />
                                ) : (
                                    <FaExclamationTriangle size={20} />
                                )}
                            </div>
                            <div>
                                <h3
                                    className={`text-base font-bold ${
                                        isSuccess
                                            ? "text-green-900"
                                            : isWarning
                                            ? "text-amber-900"
                                            : "text-red-900"
                                    }`}
                                >
                                    {isSuccess
                                        ? "System Auto-Sync & Backup Successful"
                                        : isWarning
                                        ? "Local Backup OK (Cloud Warning)"
                                        : "Backup Failed"}
                                </h3>
                                <p className="mt-1 text-sm text-slate-600">
                                    {backupStatus?.message || "No backup recorded."}
                                </p>
                                {backupStatus?.timestamp && (
                                    <p className="mt-2 flex items-center gap-1 text-xs text-slate-500 font-mono">
                                        <FaClock size={12} />
                                        Last Executed: {new Date(backupStatus.timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" })}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Backup Features Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                        <FaFileArchive size={22} />
                    </div>
                    <h3 className="font-bold text-slate-900">PostgreSQL Database Dump</h3>
                    <p className="mt-2 text-sm text-slate-500">
                        Creates a full `.sql` snapshot of all students, faculty, attendance, internal marks, and exam data.
                    </p>
                    <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 font-mono">
                        Directory: /home/gvp/student-management-system/backups
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                        <FaCloudUploadAlt size={22} />
                    </div>
                    <h3 className="font-bold text-slate-900">Google Drive Cloud Sync</h3>
                    <p className="mt-2 text-sm text-slate-500">
                        Automatically uploads the database `.sql` files and student photo uploads via `rclone` to Google Drive.
                    </p>
                    <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 font-mono">
                        Remote: gdrive:SMS_Backups/
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                        <FaGithub size={22} />
                    </div>
                    <h3 className="font-bold text-slate-900">GitHub Code Sync</h3>
                    <p className="mt-2 text-sm text-slate-500">
                        Auto-commits any recent code changes, features, and fixes, then pushes directly to the GitHub origin repo.
                    </p>
                    <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 font-mono">
                        Repo: saran-neralla7/sms
                    </div>
                </div>
            </div>
        </div>
    );
}
