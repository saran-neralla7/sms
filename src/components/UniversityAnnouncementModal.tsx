"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaXmark } from "react-icons/fa6";
import Image from "next/image";
import confetti from "canvas-confetti";
import { useSession } from "next-auth/react";

type AnimationStage = "logo_intro" | "card_revealed";

export default function UniversityAnnouncementModal() {
    const { data: session, status } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [stage, setStage] = useState<AnimationStage>("logo_intro");
    const [timeLeft, setTimeLeft] = useState(15);
    const [rotateX, setRotateX] = useState(0);
    const [rotateY, setRotateY] = useState(0);

    const cardRef = useRef<HTMLDivElement>(null);
    const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

    const clearAllTimeouts = () => {
        timeoutsRef.current.forEach((t) => clearTimeout(t));
        timeoutsRef.current = [];
    };

    // Confetti: Center initial burst when logo hits peak
    const triggerCenterBurst = () => {
        confetti({
            particleCount: 90,
            spread: 90,
            origin: { x: 0.5, y: 0.45 },
            colors: ["#ffd700", "#f59e0b", "#fbbf24", "#3b82f6", "#ffffff", "#ef4444"],
            startVelocity: 42,
            scalar: 1.2,
            zIndex: 100002,
        });
    };

    // Confetti: High-powered dual cannons when card unfolds from the logo
    const triggerLateralCannons = () => {
        // Left cannon
        confetti({
            particleCount: 85,
            angle: 60,
            spread: 70,
            origin: { x: 0.05, y: 0.85 },
            colors: ["#ffd700", "#f59e0b", "#ec4899", "#3b82f6", "#10b981", "#8b5cf6"],
            startVelocity: 55,
            zIndex: 100002,
        });
        // Right cannon
        confetti({
            particleCount: 85,
            angle: 120,
            spread: 70,
            origin: { x: 0.95, y: 0.85 },
            colors: ["#ffd700", "#f59e0b", "#ec4899", "#3b82f6", "#10b981", "#8b5cf6"],
            startVelocity: 55,
            zIndex: 100002,
        });
    };

    // Confetti: Gentle golden shower over the announcement card
    const triggerCelebrationShower = () => {
        confetti({
            particleCount: 65,
            spread: 120,
            origin: { x: 0.5, y: 0.25 },
            colors: ["#ffd700", "#ffea75", "#ffffff", "#60a5fa"],
            scalar: 1.1,
            gravity: 0.8,
            ticks: 240,
            zIndex: 100002,
        });
    };

    // Start choreographed animation sequence
    const startSequence = useCallback(() => {
        clearAllTimeouts();
        setStage("logo_intro");
        setTimeLeft(15);
        setIsOpen(true);

        // Stage 1: Logo zooms in from center. At 600ms, center celebration burst fires
        const t1 = setTimeout(() => {
            triggerCenterBurst();
        }, 650);

        // Stage 2: At 1250ms, popup card dramatically emerges out of the logo!
        const t2 = setTimeout(() => {
            setStage("card_revealed");
            triggerLateralCannons();
        }, 1250);

        // Stage 3: At 1750ms, celebratory golden shimmer shower
        const t3 = setTimeout(() => {
            triggerCelebrationShower();
        }, 1750);

        timeoutsRef.current = [t1, t2, t3];
    }, []);

    const checkAndTrigger = useCallback((force = false) => {
        if (typeof window === "undefined" || isOpen) return;

        const justLoggedIn = sessionStorage.getItem("sms_just_logged_in");
        const hasSeen = sessionStorage.getItem("gvpihlr_announcement_shown");

        // Trigger if force, or user just logged in (every login), or never seen in session
        if (force || justLoggedIn === "true" || !hasSeen) {
            sessionStorage.removeItem("sms_just_logged_in");

            // Check if enabled in Admin System Settings
            fetch("/api/system/announcement-settings")
                .then((res) => res.json())
                .then((data) => {
                    if (data.enabled) {
                        startSequence();
                    }
                })
                .catch(() => {
                    // If API fails, default to showing
                    startSequence();
                });
        }
    }, [startSequence, isOpen]);

    useEffect(() => {
        // Only run for authenticated users
        if (status !== "authenticated" || !session) return;

        checkAndTrigger();

        return () => clearAllTimeouts();
    }, [status, session, checkAndTrigger]);

    // Support instant trigger on login event or admin preview
    useEffect(() => {
        const handleLoginEvent = () => {
            checkAndTrigger(true);
        };
        const handlePreview = () => {
            startSequence();
        };

        window.addEventListener("sms_user_logged_in", handleLoginEvent);
        window.addEventListener("preview_gvpihlr_popup", handlePreview);
        return () => {
            window.removeEventListener("sms_user_logged_in", handleLoginEvent);
            window.removeEventListener("preview_gvpihlr_popup", handlePreview);
        };
    }, [checkAndTrigger, startSequence]);

    // 15-second automatic countdown timer (runs once card is revealed)
    useEffect(() => {
        if (!isOpen || stage !== "card_revealed") return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleClose();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen, stage]);

    const handleClose = () => {
        clearAllTimeouts();
        sessionStorage.removeItem("sms_just_logged_in");
        sessionStorage.setItem("gvpihlr_announcement_shown", "true");
        setIsOpen(false);
    };

    // Subtle 3D perspective mouse tilt effect for the revealed card
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current || stage !== "card_revealed") return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const multiplier = 0.035;
        setRotateX(-y * multiplier);
        setRotateY(x * multiplier);
    };

    const handleMouseLeave = () => {
        setRotateX(0);
        setRotateY(0);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-lg overflow-hidden">
                    {/* Backdrop Click to dismiss */}
                    <div className="absolute inset-0" onClick={handleClose} />

                    {/* Ambient celebratory floating orbs */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute top-1/4 left-1/12 w-4 h-4 bg-amber-400/60 rounded-full blur-[2px] animate-ping duration-1000" />
                        <div className="absolute top-1/3 right-1/12 w-5 h-5 bg-rose-500/60 rounded-full blur-[2px] animate-pulse delay-300" />
                        <div className="absolute bottom-1/4 left-1/6 w-4 h-4 bg-indigo-400/60 rounded-full blur-[2px] animate-pulse delay-500" />
                        <div className="absolute bottom-1/3 right-1/6 w-4 h-4 bg-emerald-400/60 rounded-full blur-[2px] animate-pulse delay-200" />
                    </div>

                    {/* Close button always accessible */}
                    <button
                        onClick={handleClose}
                        aria-label="Close Announcement"
                        className="absolute top-5 right-5 z-[100001] flex h-10 w-10 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all shadow-lg border border-white/20"
                    >
                        <FaXmark className="h-5 w-5" />
                    </button>

                    {/* STAGE 1: CINEMATIC LOGO INTRO - Starts small, blooms big with aura & sunburst */}
                    {stage === "logo_intro" && (
                        <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none">
                            {/* Shockwave ripple rings */}
                            <motion.div
                                initial={{ scale: 0.2, opacity: 0.9 }}
                                animate={{ scale: 3, opacity: 0 }}
                                transition={{ duration: 1.1, repeat: 1, ease: "easeOut" }}
                                className="absolute h-44 w-44 rounded-full border-2 border-amber-300/80"
                            />
                            <motion.div
                                initial={{ scale: 0.3, opacity: 0.7 }}
                                animate={{ scale: 2.4, opacity: 0 }}
                                transition={{ duration: 1.2, delay: 0.2, repeat: 1, ease: "easeOut" }}
                                className="absolute h-44 w-44 rounded-full border-2 border-indigo-400/70"
                            />

                            {/* Rotating sunburst beam rays */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 0.85, scale: 1.6, rotate: 360 }}
                                transition={{
                                    scale: { duration: 0.8, ease: "easeOut" },
                                    rotate: { duration: 15, repeat: Infinity, ease: "linear" },
                                }}
                                className="absolute h-64 w-64 rounded-full blur-[8px]"
                                style={{
                                    background: "conic-gradient(from 0deg, #f59e0b, #ffd700, #ec4899, #6366f1, #ffd700, #f59e0b)",
                                }}
                            />

                            {/* Logo: Starts small (0.15) and grows big (1.45) */}
                            <motion.div
                                initial={{ scale: 0.15, opacity: 0, rotateY: 180 }}
                                animate={{
                                    scale: [0.15, 1.45, 1.3],
                                    opacity: 1,
                                    rotateY: [180, 0, 0],
                                }}
                                transition={{
                                    duration: 0.9,
                                    ease: [0.22, 1, 0.36, 1],
                                }}
                                className="relative p-2 rounded-full bg-white shadow-[0_0_50px_rgba(245,158,11,0.6)]"
                            >
                                <div className="relative h-32 w-32 sm:h-36 sm:w-36 rounded-full overflow-hidden border-4 border-amber-400">
                                    <Image
                                        src="/gvpihlr-logo.jpg"
                                        alt="GVPIHLR University Logo"
                                        fill
                                        priority
                                        unoptimized
                                        className="object-cover"
                                        sizes="144px"
                                    />
                                </div>
                            </motion.div>

                            {/* Shimmering Intro Badge */}
                            <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.35, duration: 0.5 }}
                                className="mt-6 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/30 via-white/20 to-amber-500/30 border border-amber-300/40 backdrop-blur-md shadow-xl"
                            >
                                <span className="text-amber-200 text-xs sm:text-sm font-black tracking-widest uppercase font-serif drop-shadow">
                                    ✦ GAYATRI VIDYA PARISHAD ✦
                                </span>
                            </motion.div>
                        </div>
                    )}

                    {/* STAGE 2: CARD EMERGES DIRECTLY OUT OF THE LOGO */}
                    {stage === "card_revealed" && (
                        <motion.div
                            ref={cardRef}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                            initial={{
                                scale: 0.15,
                                opacity: 0,
                                y: -20,
                            }}
                            animate={{
                                scale: 1,
                                opacity: 1,
                                y: 0,
                                rotateX: rotateX,
                                rotateY: rotateY,
                            }}
                            exit={{ opacity: 0, scale: 0.85, y: 25, transition: { duration: 0.25 } }}
                            transition={{
                                type: "spring",
                                damping: 20,
                                stiffness: 240,
                            }}
                            style={{
                                transformStyle: "preserve-3d",
                                perspective: 1200,
                                transformOrigin: "50% 120px", // Pop-out expansion originates directly from the logo position!
                            }}
                            className="relative z-10 w-full max-w-[620px] rounded-3xl bg-white shadow-2xl shadow-indigo-950/50 border-2 border-amber-300/80 overflow-hidden text-center"
                        >
                            {/* Top Decorative Celebration Ribbon Bar */}
                            <div className="h-3 w-full bg-gradient-to-r from-amber-400 via-rose-500 via-indigo-600 to-amber-400 bg-[length:200%_auto] animate-pulse" />

                            {/* Internal Card Close Button */}
                            <button
                                onClick={handleClose}
                                aria-label="Close"
                                className="absolute top-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors shadow-sm"
                            >
                                <FaXmark className="h-4 w-4" />
                            </button>

                            <div className="px-6 pt-5 pb-6 sm:px-10 sm:pt-6 sm:pb-7 flex flex-col items-center">
                                {/* University Emblem with 3D Aura / Rotating Sunburst */}
                                <motion.div
                                    initial={{ scale: 1.25 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    className="relative mb-3 flex items-center justify-center"
                                >
                                    {/* Rotating Golden Radial Halo */}
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                                        className="absolute -inset-3 rounded-full opacity-60 blur-[3px]"
                                        style={{
                                            background: "conic-gradient(from 0deg, #f59e0b, #ffd700, #ec4899, #6366f1, #ffd700, #f59e0b)",
                                        }}
                                    />

                                    {/* White Cushion Ring */}
                                    <div className="relative p-1 rounded-full bg-white shadow-xl">
                                        <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-full overflow-hidden border-2 border-amber-300 shadow-inner">
                                            <Image
                                                src="/gvpihlr-logo.jpg"
                                                alt="GVPIHLR University Logo"
                                                fill
                                                priority
                                                unoptimized
                                                className="object-cover"
                                                sizes="112px"
                                            />
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Top Eyebrow Tag */}
                                <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="mb-1.5 inline-flex items-center gap-1.5 px-3.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100/90 text-[11px] sm:text-xs font-black tracking-widest text-indigo-900 uppercase shadow-sm"
                                >
                                    ✨ A PROUD MOMENT FOR ✨
                                </motion.div>

                                {/* Main Institution Heading */}
                                <motion.h2
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.18 }}
                                    className="text-2xl sm:text-3xl font-black text-[#0f2b5c] tracking-tight leading-tight uppercase font-serif"
                                >
                                    GAYATRI VIDYA PARISHAD
                                </motion.h2>

                                {/* Golden Ornamental Divider */}
                                <motion.div
                                    initial={{ opacity: 0, scaleX: 0 }}
                                    animate={{ opacity: 1, scaleX: 1 }}
                                    transition={{ delay: 0.25, duration: 0.4 }}
                                    className="my-2.5 flex items-center justify-center gap-2 w-full max-w-xs"
                                >
                                    <div className="h-[1.5px] flex-grow bg-gradient-to-r from-transparent to-amber-400" />
                                    <span className="text-amber-500 text-xs">✦</span>
                                    <div className="h-[1.5px] flex-grow bg-gradient-to-l from-transparent to-amber-400" />
                                </motion.div>

                                {/* Subtitle */}
                                <motion.p
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-[11px] sm:text-xs font-bold text-slate-700 tracking-wider uppercase max-w-md leading-snug"
                                >
                                    LETTER OF PERMISSION (LOP) GRANTED FOR THE ESTABLISHMENT OF
                                </motion.p>

                                {/* Prominent Golden Plaque Box */}
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.92, y: 12 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ delay: 0.38, type: "spring", stiffness: 350, damping: 22 }}
                                    whileHover={{ scale: 1.01 }}
                                    className="my-3.5 w-full rounded-xl bg-gradient-to-b from-amber-50/95 via-amber-50/40 to-amber-50/85 p-4 sm:p-5 border-2 border-amber-300 shadow-md shadow-amber-500/10 relative overflow-hidden"
                                >
                                    {/* Gold corner brackets */}
                                    <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-amber-500" />
                                    <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-amber-500" />
                                    <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-amber-500" />
                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-amber-500" />

                                    <h3 className="text-sm sm:text-base font-extrabold text-[#7a1818] leading-snug tracking-wide uppercase font-serif">
                                        GAYATRI VIDYA PARISHAD INSTITUTE OF HIGHER LEARNING AND RESEARCH
                                    </h3>
                                    <div className="mt-1 text-base sm:text-lg font-black text-[#0f2b5c] tracking-wider">
                                        (GVPIHLR)
                                    </div>
                                </motion.div>

                                {/* Blue Pill Category Badge */}
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.46 }}
                                    className="w-full rounded-full bg-[#eaf0fc] border border-[#cbd9f5] px-4 py-2 text-center shadow-sm"
                                >
                                    <span className="text-xs sm:text-sm font-extrabold text-[#0f3b82] tracking-wider uppercase">
                                        DEEMED-TO-BE UNIVERSITY UNDER DISTINCT CATEGORY
                                    </span>
                                </motion.div>

                                {/* Auto Close Indicator Bar with Animated Ring */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.55 }}
                                    className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500"
                                >
                                    <span className="text-slate-600">
                                        This popup will automatically close in
                                    </span>
                                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-400 text-[#0f2b5c] font-black text-xs shadow-sm">
                                        {timeLeft}
                                    </span>
                                    <span className="text-slate-600">seconds</span>
                                </motion.div>
                            </div>
                        </motion.div>
                    )}
                </div>
            )}
        </AnimatePresence>
    );
}

