"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaCakeCandles, FaGift, FaXmark } from "react-icons/fa6";
import Image from "next/image";

interface BirthdayCelebrationModalProps {
    empName: string;
    salutation: string;
    photoUrl?: string | null;
}

export default function BirthdayCelebrationModal({ empName, salutation, photoUrl }: BirthdayCelebrationModalProps) {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const todayStr = new Date().toISOString().split("T")[0];
        const hasShown = sessionStorage.getItem(`birthday_modal_shown_${todayStr}`);
        if (!hasShown) {
            setIsOpen(true);
        }
    }, []);

    const handleClose = () => {
        const todayStr = new Date().toISOString().split("T")[0];
        sessionStorage.setItem(`birthday_modal_shown_${todayStr}`, "true");
        setIsOpen(false);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                    {/* Floating Confetti / Particles Animation */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute -top-10 left-1/4 w-3 h-3 bg-pink-500 rounded-full animate-bounce delay-100" />
                        <div className="absolute -top-10 left-1/2 w-4 h-4 bg-amber-400 rounded-full animate-bounce delay-300" />
                        <div className="absolute -top-10 left-3/4 w-3 h-3 bg-indigo-400 rounded-full animate-bounce delay-200" />
                        <div className="absolute top-1/3 left-10 w-4 h-4 bg-emerald-400 rotate-45 animate-pulse" />
                        <div className="absolute top-2/3 right-10 w-5 h-5 bg-purple-400 rotate-12 animate-pulse" />
                    </div>

                    <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-gradient-to-b from-amber-50 via-white to-rose-50 p-6 sm:p-8 shadow-2xl border border-amber-200/80 text-center"
                    >
                        {/* Close button */}
                        <button
                            onClick={handleClose}
                            className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                        >
                            <FaXmark className="h-5 w-5" />
                        </button>

                        {/* Top Decorative Header */}
                        <div className="flex justify-center mb-3">
                            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-md">
                                <FaCakeCandles className="h-4 w-4" /> Official Birthday Greetings
                            </span>
                        </div>

                        {/* Faculty Photo / Avatar */}
                        <div className="relative mx-auto my-4 h-28 w-28 rounded-full p-1 bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-500 shadow-xl">
                            <div className="relative h-full w-full overflow-hidden rounded-full bg-white border-2 border-white">
                                {photoUrl ? (
                                    <img
                                        src={photoUrl}
                                        alt={empName}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400 text-3xl font-bold">
                                        {empName.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-white shadow-lg text-lg">
                                🎂
                            </span>
                        </div>

                        {/* Personal Wish Header */}
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                            Happy Birthday {salutation}! 🎉
                        </h2>
                        <p className="mt-1 text-sm font-bold text-amber-600">
                            {empName}
                        </p>

                        {/* Official Wishing Message */}
                        <div className="my-5 rounded-2xl bg-white/80 p-4 border border-amber-100 shadow-inner">
                            <p className="text-sm sm:text-base font-semibold text-slate-700 leading-relaxed">
                                Wishing you a wonderful and successful year ahead from <br />
                                <span className="font-bold text-indigo-900">
                                    Gayatri Vidya Parishad College for Degree and PG Courses (A)
                                </span>.
                            </p>
                        </div>

                        {/* Bottom CTA Button */}
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={handleClose}
                            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 px-8 py-3 text-sm font-extrabold text-white shadow-lg shadow-rose-500/25 hover:brightness-110 transition-all"
                        >
                            <FaGift className="h-4 w-4" /> Thank You! 🎉
                        </motion.button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
