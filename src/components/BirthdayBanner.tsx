"use client";

import React from "react";
import { FaCakeCandles, FaWandMagicSparkles } from "react-icons/fa6";

interface BirthdayBannerProps {
    empName: string;
    salutation: string;
}

export default function BirthdayBanner({ empName, salutation }: BirthdayBannerProps) {
    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 p-4 sm:p-5 text-white shadow-xl mb-6">
            {/* Background Decorative Sparkles */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10 blur-xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 -mb-6 h-32 w-32 rounded-full bg-amber-300/20 blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md text-2xl shadow-inner">
                        🎂
                    </div>
                    <div>
                        <div className="flex items-center justify-center sm:justify-start gap-1.5 text-amber-200 text-xs font-black uppercase tracking-wider">
                            <FaWandMagicSparkles /> Official Birthday Celebration
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
                            Happy Birthday {salutation}! 🎓
                        </h2>
                        <p className="text-xs sm:text-sm text-rose-100 font-medium mt-0.5">
                            Wishing you a wonderful and successful year ahead from Gayatri Vidya Parishad College for Degree and PG Courses (A).
                        </p>
                    </div>
                </div>

                <div className="shrink-0">
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 backdrop-blur-md px-4 py-2 text-xs font-bold text-white border border-white/30 shadow-sm">
                        <FaCakeCandles className="text-amber-300" /> Celebrated Today
                    </span>
                </div>
            </div>
        </div>
    );
}
