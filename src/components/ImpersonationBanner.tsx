"use client";

import React, { useEffect, useState, useRef } from "react";
import { FaUserSecret, FaEye, FaSignOutAlt, FaClock } from "react-icons/fa";
import ImpersonationStopModal from "./ImpersonationStopModal";

export default function ImpersonationBanner() {
  const [sessionData, setSessionData] = useState<any>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);
  const [idleSeconds, setIdleSeconds] = useState(0);

  const IDLE_LIMIT = 600; // 10 minutes idle limit
  const idleTimerRef = useRef<any>(null);

  const getCookie = (name: string) => {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift();
    return null;
  };

  useEffect(() => {
    const rawCookie = getCookie("impersonate_session");
    if (rawCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(rawCookie));
        setSessionData(parsed);
      } catch (e) {}
    }
  }, []);

  // Idle timer & window beforeunload listener
  useEffect(() => {
    if (!sessionData) return;

    const resetIdleTimer = () => {
      setIdleSeconds(0);
    };

    window.addEventListener("mousemove", resetIdleTimer);
    window.addEventListener("keydown", resetIdleTimer);
    window.addEventListener("click", resetIdleTimer);
    window.addEventListener("scroll", resetIdleTimer);

    const interval = setInterval(() => {
      setIdleSeconds(prev => {
        if (prev + 1 >= IDLE_LIMIT) {
          clearInterval(interval);
          setIsTimeout(true);
          setShowExitModal(true);
          return IDLE_LIMIT;
        }
        return prev + 1;
      });
    }, 1000);

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You are in Impersonation Mode. Please submit your exit summary before leaving.";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("mousemove", resetIdleTimer);
      window.removeEventListener("keydown", resetIdleTimer);
      window.removeEventListener("click", resetIdleTimer);
      window.removeEventListener("scroll", resetIdleTimer);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(interval);
    };
  }, [sessionData]);

  if (!sessionData) return null;

  const remainingSeconds = Math.max(0, IDLE_LIMIT - idleSeconds);
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeFormatted = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

  return (
    <>
      <div className="sticky top-0 z-[49] bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 border-b border-amber-500/40 text-white px-4 py-2 shadow-xl backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30 font-semibold animate-pulse">
              <FaUserSecret className="w-3.5 h-3.5" />
              <span>IMPERSONATION MODE ACTIVE</span>
            </div>

            <div className="text-slate-300">
              Viewing as: <span className="font-bold text-white">{sessionData.targetName || sessionData.targetUsername}</span> ({sessionData.targetRole})
            </div>

            {sessionData.isReadOnly && (
              <span className="flex items-center gap-1 bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-md border border-indigo-500/30 font-medium text-[11px]">
                <FaEye className="w-3 h-3" /> View-Only
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 text-slate-400 font-mono text-[11px]">
              <FaClock className="text-amber-400" />
              <span>Idle Timeout in:</span>
              <span className={`font-bold ${remainingSeconds < 60 ? "text-red-400 animate-bounce" : "text-amber-300"}`}>
                {timeFormatted}
              </span>
            </div>

            <button
              onClick={() => {
                setIsTimeout(false);
                setShowExitModal(true);
              }}
              className="px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-semibold rounded-lg shadow-md transition flex items-center space-x-1.5"
            >
              <FaSignOutAlt className="w-3 h-3" />
              <span>Exit Impersonation</span>
            </button>
          </div>
        </div>
      </div>

      <ImpersonationStopModal
        isOpen={showExitModal}
        targetUsername={sessionData.targetName || sessionData.targetUsername}
        auditLogId={sessionData.auditLogId}
        isAutoTimeout={isTimeout}
        onClose={() => setShowExitModal(false)}
        onSuccess={() => {
          setSessionData(null);
          setShowExitModal(false);
        }}
      />
    </>
  );
}
