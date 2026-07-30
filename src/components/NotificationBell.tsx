"use client";

import React, { useState, useEffect, useRef } from "react";
import { FaBell, FaCheckDouble, FaMobileAlt } from "react-icons/fa";

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());

    const triggerBrowserPushAlert = (n: any) => {
        if ("Notification" in window && Notification.permission === "granted") {
            try {
                const options: NotificationOptions = {
                    body: n.message,
                    icon: n.photoUrl || "/icons/icon-192x192.png",
                    tag: n.id
                };
                new Notification(n.title, options);
            } catch (err) {
                console.error("Browser push alert error:", err);
            }
        }
    };

    const fetchNotifications = async () => {
        try {
            const res = await fetch("/api/notifications");
            if (res.ok) {
                const data = await res.json();
                const newNotifs: any[] = data.notifications || [];
                setNotifications(newNotifs);
                setUnreadCount(data.unreadCount || 0);

                // Trigger PWA / Browser notification for unread items not yet alerted
                newNotifs.forEach((n) => {
                    if (!n.isRead && !notifiedIds.has(n.id)) {
                        triggerBrowserPushAlert(n);
                        setNotifiedIds(prev => new Set(prev).add(n.id));
                    }
                });
            }
        } catch (e) {
            console.error("Error loading notifications:", e);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Polling every 30s
        return () => clearInterval(interval);
    }, [notifiedIds]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await fetch("/api/notifications", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notificationId: id })
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (e) {
            console.error(e);
        }
    };

    const markAllAsRead = async () => {
        try {
            await fetch("/api/notifications", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ markAll: true })
            });
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (e) {
            console.error(e);
        }
    };

    const requestBrowserPermission = async () => {
        if ("Notification" in window) {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                alert("Browser & Mobile Push Notifications are now enabled for this app!");
            } else {
                alert("Notification permission was denied. Please allow notifications in your browser settings.");
            }
        } else {
            alert("Push Notifications are not supported by this browser.");
        }
    };

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors focus:outline-none"
                title="Notifications"
            >
                <FaBell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-sm animate-pulse">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl z-50">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                            >
                                <FaCheckDouble /> Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 space-y-1">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                                No notifications yet.
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    onClick={() => markAsRead(n.id)}
                                    className={`p-3 rounded-xl transition-colors cursor-pointer text-left flex items-start gap-3 ${
                                        n.isRead ? "bg-white hover:bg-slate-50" : "bg-blue-50/50 border-l-4 border-blue-500"
                                    }`}
                                >
                                    {n.photoUrl ? (
                                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-amber-300 shadow-sm mt-0.5">
                                            <img src={n.photoUrl} alt="Faculty" className="h-full w-full object-cover" />
                                        </div>
                                    ) : n.type === "FACULTY_BIRTHDAY" ? (
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-lg shadow-sm mt-0.5">
                                            🎂
                                        </div>
                                    ) : n.type === "SYSTEM_BACKUP" ? (
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-lg shadow-sm mt-0.5">
                                            💾
                                        </div>
                                    ) : null}

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-1">
                                            <h4 className={`text-xs font-bold truncate ${n.isRead ? "text-slate-700" : "text-blue-900"}`}>
                                                {n.title}
                                            </h4>
                                            <span className="text-[10px] text-slate-400 shrink-0">
                                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 mt-1 leading-snug break-words">{n.message}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-3 border-t border-slate-100 pt-3">
                        <button
                            onClick={requestBrowserPermission}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                            <FaMobileAlt /> Enable Mobile / Browser Push Alerts
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
