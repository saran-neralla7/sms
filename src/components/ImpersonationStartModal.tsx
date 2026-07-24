"use client";

import React, { useState } from "react";
import { FaUserSecret, FaLock, FaShieldAlt, FaEye, FaExclamationTriangle } from "react-icons/fa";

interface Props {
  isOpen: boolean;
  targetUser: {
    id: string;
    username: string;
    name?: string;
    role: string;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImpersonationStartModal({ isOpen, targetUser, onClose, onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [preComment, setPreComment] = useState("");
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !targetUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password) {
      setError("Please enter your Admin Password to confirm identity.");
      return;
    }

    if (preComment.trim().length < 10) {
      setError("Pre-access reason is mandatory (minimum 10 characters).");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Verify Admin Password
      const pwdRes = await fetch("/api/admin/impersonate/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      const pwdData = await pwdRes.json();
      if (!pwdRes.ok) {
        setError(pwdData.error || "Password verification failed.");
        setLoading(false);
        return;
      }

      // Step 2: Start Impersonation & Log Audit
      const startRes = await fetch("/api/admin/impersonate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: targetUser.id,
          preComment: preComment.trim(),
          isReadOnly
        })
      });

      const startData = await startRes.json();
      if (!startRes.ok) {
        setError(startData.error || "Failed to start impersonation.");
        setLoading(false);
        return;
      }

      onSuccess();
      // Redirect to target user appropriate dashboard
      const targetRole = targetUser.role?.toUpperCase();
      if (targetRole === "FACULTY") {
        window.location.href = "/attendance";
      } else if (targetRole === "STUDENT") {
        window.location.href = "/student/dashboard";
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      console.error(err);
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900/80 via-slate-900 to-purple-900/80 p-6 border-b border-indigo-500/20">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <FaUserSecret className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                User Impersonation Access
              </h3>
              <p className="text-xs text-indigo-300">
                Accessing login for: <span className="font-semibold text-white">{targetUser.name || targetUser.username}</span> ({targetUser.role})
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-start space-x-2">
              <FaExclamationTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Admin Password Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FaLock className="text-indigo-400" />
              Confirm Your Admin Password <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your Admin password..."
              className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Mandatory Pre-Access Reason */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FaShieldAlt className="text-emerald-400" />
                Reason for Access (Mandatory) <span className="text-red-400">*</span>
              </label>
              <span className={`text-[11px] font-mono ${preComment.trim().length >= 10 ? "text-emerald-400" : "text-amber-400"}`}>
                {preComment.trim().length}/10 min chars
              </span>
            </div>
            <textarea
              rows={3}
              value={preComment}
              onChange={(e) => setPreComment(e.target.value)}
              placeholder="e.g. Investigating reported subject dropdown issue for Metrology Lab..."
              className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
              required
            />
          </div>

          {/* View-Only Mode Checkbox */}
          <div className="p-3.5 bg-indigo-950/40 border border-indigo-500/20 rounded-xl flex items-center space-x-3">
            <input
              type="checkbox"
              id="viewOnlyToggle"
              checked={isReadOnly}
              onChange={(e) => setIsReadOnly(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded bg-slate-800 border-slate-700 focus:ring-indigo-500"
            />
            <label htmlFor="viewOnlyToggle" className="text-xs text-slate-300 cursor-pointer select-none">
              <span className="font-semibold text-white flex items-center gap-1">
                <FaEye className="text-indigo-400 inline" /> View-Only Mode
              </span>
              <span className="block text-[11px] text-slate-400 mt-0.5">
                Inspect layout & data without allowing any edits or attendance postings.
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || preComment.trim().length < 10 || !password}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center space-x-2"
            >
              {loading ? (
                <span>Starting Session...</span>
              ) : (
                <>
                  <FaUserSecret className="w-3.5 h-3.5" />
                  <span>Start Impersonation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
