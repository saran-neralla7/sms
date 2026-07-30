"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaPaperPlane,
    FaMobileAlt,
    FaUsers,
    FaBuilding,
    FaGraduationCap,
    FaArrowLeft,
    FaCheckCircle,
    FaExclamationTriangle,
    FaHistory,
    FaBell
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

export default function BroadcastNotificationPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [departments, setDepartments] = useState<any[]>([]);
    const [targetRole, setTargetRole] = useState<string>("ALL");
    const [departmentId, setDepartmentId] = useState<string>("ALL");
    const [year, setYear] = useState<string>("ALL");
    const [title, setTitle] = useState<string>("");
    const [message, setMessage] = useState<string>("");
    const [link, setLink] = useState<string>("/dashboard");

    const [targetCount, setTargetCount] = useState<number | null>(null);
    const [countLoading, setCountLoading] = useState<boolean>(false);
    const [sending, setSending] = useState<boolean>(false);
    const [testingPush, setTestingPush] = useState<boolean>(false);

    const [alertStatus, setAlertStatus] = useState<{ type: "success" | "error" | null; msg: string }>({ type: null, msg: "" });
    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState<boolean>(true);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
            return;
        }

        if (status === "authenticated" && session?.user) {
            const role = (session.user as any).role;
            if (!["ADMIN", "DIRECTOR"].includes(role)) {
                router.push("/dashboard");
                return;
            }

            // Fetch departments
            fetch("/api/departments?all=true")
                .then((res) => res.json())
                .then((data) => setDepartments(Array.isArray(data) ? data : []))
                .catch(console.error);

            // Fetch broadcast history
            fetchHistory();
        }
    }, [status, session, router]);

    const fetchHistory = async () => {
        try {
            setHistoryLoading(true);
            const res = await fetch("/api/admin/notifications/history");
            if (res.ok) {
                const data = await res.json();
                setHistory(data.history || []);
            }
        } catch (e) {
            console.error("History fetch error:", e);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Calculate recipient count whenever filters change
    useEffect(() => {
        if (status !== "authenticated") return;

        const updateTargetCount = async () => {
            try {
                setCountLoading(true);
                const params = new URLSearchParams({
                    targetRole,
                    departmentId,
                    year
                });
                const res = await fetch(`/api/admin/notifications/broadcast?${params.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    setTargetCount(data.count);
                }
            } catch (e) {
                console.error("Count fetch error:", e);
            } finally {
                setCountLoading(false);
            }
        };

        const timer = setTimeout(updateTargetCount, 300);
        return () => clearTimeout(timer);
    }, [targetRole, departmentId, year, status]);

    const handleSendTestPush = async () => {
        try {
            setTestingPush(true);
            setAlertStatus({ type: null, msg: "" });

            const res = await fetch("/api/admin/notifications/test-push", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: "iPhone Push Test Notification 🚀",
                    message: `Test notification sent at ${new Date().toLocaleTimeString()}! If your iPhone notifications are turned on, this banner will pop up immediately.`
                })
            });

            const data = await res.json();

            if (res.ok) {
                setAlertStatus({
                    type: "success",
                    msg: "Test push notification sent! Check your notification bell and mobile alert bar."
                });

                // Also trigger native browser notification immediately if granted
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("iPhone Push Test Notification 🚀", {
                        body: "Test notification delivered successfully to your device!",
                        icon: "/icons/icon-192x192.png"
                    });
                }
            } else {
                setAlertStatus({ type: "error", msg: data.error || "Failed to send test push notification" });
            }
        } catch (e: any) {
            setAlertStatus({ type: "error", msg: e.message || "Failed to send test push" });
        } finally {
            setTestingPush(false);
        }
    };

    const handleBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            setAlertStatus({ type: "error", msg: "Please fill in both the notification title and message." });
            return;
        }

        try {
            setSending(true);
            setAlertStatus({ type: null, msg: "" });

            const res = await fetch("/api/admin/notifications/broadcast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    message,
                    targetRole,
                    departmentId,
                    year,
                    link
                })
            });

            const data = await res.json();

            if (res.ok) {
                setAlertStatus({ type: "success", msg: data.message });
                setTitle("");
                setMessage("");
                fetchHistory();
            } else {
                setAlertStatus({ type: "error", msg: data.error || "Failed to send broadcast notification" });
            }
        } catch (e: any) {
            setAlertStatus({ type: "error", msg: e.message || "Error broadcasting notification" });
        } finally {
            setSending(false);
        }
    };

    if (status === "loading") {
        return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">

                {/* Top Bar */}
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                        onClick={() => router.push("/admin")}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        <FaArrowLeft /> Back to Admin Dashboard
                    </button>

                    <button
                        onClick={handleSendTestPush}
                        disabled={testingPush}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:from-indigo-700 hover:to-blue-700 transition-all disabled:opacity-50"
                    >
                        <FaMobileAlt className="text-sm" />
                        {testingPush ? "Sending Test Push..." : "⚡ Send Test Push Notification to My iPhone / Device"}
                    </button>
                </div>

                {/* Header Title */}
                <div className="mb-8">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
                            <FaBell className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
                                Broadcast Notification Center
                            </h1>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Send targeted push & in-app notifications filtered by role, department, and batch.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Alert Box */}
                <AnimatePresence>
                    {alertStatus.type && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`mb-6 flex items-center gap-3 rounded-2xl p-4 text-sm font-semibold shadow-sm ${
                                alertStatus.type === "success"
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : "bg-rose-50 text-rose-800 border border-rose-200"
                            }`}
                        >
                            {alertStatus.type === "success" ? (
                                <FaCheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                            ) : (
                                <FaExclamationTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                            )}
                            <span className="flex-1">{alertStatus.msg}</span>
                            <button onClick={() => setAlertStatus({ type: null, msg: "" })} className="text-slate-400 hover:text-slate-600">✕</button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main Composer Card */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                    <form onSubmit={handleBroadcast} className="space-y-6">

                        {/* Audience Filters Header */}
                        <div>
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <FaUsers className="text-indigo-600" /> Select Recipient Audience
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Choose target roles, department, and year to refine who receives this notification.
                            </p>
                        </div>

                        {/* Filters Grid */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
                            
                            {/* Role Selection */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                    <FaUsers className="text-slate-400" /> Target Role
                                </label>
                                <select
                                    value={targetRole}
                                    onChange={(e) => setTargetRole(e.target.value)}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                >
                                    <option value="ALL">🌐 All Roles (Faculty, Students, Admin, etc.)</option>
                                    <option value="FACULTY">👨‍🏫 Faculty Members Only</option>
                                    <option value="STUDENT">🎓 Students Only</option>
                                    <option value="HOD">👔 HODs Only</option>
                                    <option value="SMS_USER">💬 SMS Users Only</option>
                                    <option value="ADMIN">🛡️ Admin & Directors Only</option>
                                </select>
                            </div>

                            {/* Department Selection */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                    <FaBuilding className="text-slate-400" /> Department
                                </label>
                                <select
                                    value={departmentId}
                                    onChange={(e) => setDepartmentId(e.target.value)}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                >
                                    <option value="ALL">🏛️ All Departments</option>
                                    {departments.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.code} - {d.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Year / Batch Selection */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                    <FaGraduationCap className="text-slate-400" /> Student Year / Batch
                                </label>
                                <select
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                >
                                    <option value="ALL">📚 All Years (Yr 1 - Yr 4)</option>
                                    <option value="1">1st Year Students</option>
                                    <option value="2">2nd Year Students</option>
                                    <option value="3">3rd Year Students</option>
                                    <option value="4">4th Year Students</option>
                                </select>
                            </div>

                        </div>

                        {/* Live Recipient Count Preview */}
                        <div className="flex items-center justify-between rounded-xl bg-indigo-50/60 px-4 py-3 border border-indigo-100">
                            <div className="flex items-center gap-2">
                                <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-600 animate-ping" />
                                <span className="text-xs font-bold text-indigo-900">Delivering To:</span>
                            </div>
                            <div className="text-xs font-extrabold text-indigo-700">
                                {countLoading ? (
                                    <span className="animate-pulse">Calculating audience count...</span>
                                ) : (
                                    <span>~ {targetCount !== null ? targetCount : 0} Matching User(s)</span>
                                )}
                            </div>
                        </div>

                        {/* Message Composer */}
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Notification Title <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g., Important Circular: Mid Examinations Schedule"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                    maxLength={100}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Notification Message <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Enter the message body to send to selected users..."
                                    rows={4}
                                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all resize-y"
                                    maxLength={500}
                                    required
                                />
                                <div className="text-right text-[10px] text-slate-400 mt-1">
                                    {message.length} / 500 characters
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Action Link / Destination URL (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={link}
                                    onChange={(e) => setLink(e.target.value)}
                                    placeholder="/dashboard or /student/dashboard"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={sending || targetCount === 0 || countLoading}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 px-6 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50"
                            >
                                <FaPaperPlane className="text-xs" />
                                {sending ? "Broadcasting Notification..." : `Send Broadcast Notification (~${targetCount ?? 0} Users)`}
                            </button>
                        </div>

                    </form>
                </div>

                {/* History Section */}
                <div className="mt-12">
                    <div className="flex items-center gap-2 mb-4">
                        <FaHistory className="text-slate-600" />
                        <h3 className="text-lg font-bold text-slate-900">Recent Broadcast History</h3>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        {historyLoading ? (
                            <div className="py-8 text-center text-xs text-slate-400">Loading history...</div>
                        ) : history.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">No broadcast notifications sent yet.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                                            <th className="py-3 px-4">Date & Time</th>
                                            <th className="py-3 px-4">Title & Message</th>
                                            <th className="py-3 px-4">Target Filters</th>
                                            <th className="py-3 px-4 text-center">Recipients</th>
                                            <th className="py-3 px-4">Sender</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {history.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3 px-4 font-semibold text-slate-600 whitespace-nowrap">
                                                    {new Date(item.createdAt).toLocaleString([], {
                                                        month: "short",
                                                        day: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit"
                                                    })}
                                                </td>
                                                <td className="py-3 px-4 max-w-xs">
                                                    <div className="font-bold text-slate-900 truncate">{item.title}</div>
                                                    <div className="text-slate-500 line-clamp-1 mt-0.5">{item.message}</div>
                                                </td>
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                                                        Role: {item.targetRole}
                                                    </span>
                                                    {item.year !== "ALL" && (
                                                        <span className="ml-1 rounded-md bg-blue-100 px-2 py-0.5 font-bold text-blue-700">
                                                            Yr: {item.year}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-center whitespace-nowrap">
                                                    <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
                                                        {item.deliveredCount}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                                                    {item.performerName}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
