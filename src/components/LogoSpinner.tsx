import React from "react";
import { motion } from "framer-motion";

interface LogoSpinnerProps {
    fullScreen?: boolean;
}

export default function LogoSpinner({ fullScreen = true }: LogoSpinnerProps) {
    return (
        <div className={`flex w-full flex-col items-center justify-center bg-white ${fullScreen ? "h-screen" : "py-12"}`}>
            <div className="relative flex items-center justify-center">
                {/* Rotating Spinner Ring */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="absolute h-32 w-32 rounded-full border-b-4 border-t-4 border-blue-600"
                />

                {/* Static Logo in Center */}
                <img
                    src="https://www.gvpcdpgc.edu.in/gvplogo.jpg"
                    alt="GVP Logo"
                    className="h-24 w-24 rounded-full object-cover"
                />
            </div>
            <p className="mt-8 text-lg font-medium text-slate-600 animate-pulse">Loading...</p>
        </div>
    );
}
