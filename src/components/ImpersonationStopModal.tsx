"use client";

import React, { useState } from "react";
import { FaSignOutAlt, FaClipboardCheck, FaExclamationTriangle } from "react-icons/fa";

interface Props {
  isOpen: boolean;
  targetUsername: string;
  auditLogId?: string;
  onClose?: () => void;
  onSuccess: () => void;
  isAutoTimeout?: boolean;
}

export default function ImpersonationStopModal({
  isOpen,
  targetUsername,
  auditLogId,
  onClose,
  onSuccess,
  isAutoTimeout
}: Props) {
  const [postComment, setPostComment] = useState("");
  const [quickChecklist, setQuickChecklist] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const toggleChecklist = (item: string) => {
    setQuickChecklist(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const fullComment = [
      postComment.trim(),
      quickChecklist.length > 0 ? `[Actions: ${quickChecklist.join(", ")}]` : ""
    ].filter(Boolean).join(" ");

    if (fullComment.trim().length < 5) {
      setError("Post-exit summary is required (minimum 5 characters).");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/impersonate/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditLogId,
          postComment: fullComment,
          exitType: isAutoTimeout ? "TIMEOUT" : "MANUAL_EXIT"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit exit summary.");
        setLoading(false);
        return;
      }

      onSuccess();
      window.location.href = "/admin/users";
    } catch (err) {
      console.error(err);
      setError("An error occurred while logging out.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 p-6 border-b border-emerald-500/20">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <FaSignOutAlt className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                Exit Impersonation Session
              </h3>
              <p className="text-xs text-emerald-300">
                {isAutoTimeout ? (
                  <span className="text-amber-400 font-semibold">⚠️ Session Idle Timeout Triggered for: {targetUsername}</span>
                ) : (
                  <>Logging exit for: <span className="font-semibold text-white">{targetUsername}</span></>
                )}
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

          {/* Quick Checkboxes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <FaClipboardCheck className="text-emerald-400" />
              Quick Summary Checkbox Options:
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                "Verified Subject Dropdown",
                "Checked Lab Batches",
                "Corrected Attendance Entry",
                "Assisted User Inquiry"
              ].map((item) => (
                <label
                  key={item}
                  onClick={() => toggleChecklist(item)}
                  className={`p-2.5 rounded-xl border border-slate-700/60 cursor-pointer select-none transition flex items-center space-x-2 ${
                    quickChecklist.includes(item)
                      ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-300 font-medium"
                      : "bg-slate-800/40 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={quickChecklist.includes(item)}
                    onChange={() => {}}
                    className="w-3.5 h-3.5 text-emerald-500 rounded bg-slate-900 border-slate-700"
                  />
                  <span className="text-[11px]">{item}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Mandatory Exit Summary */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Post-Exit Summary (Mandatory) <span className="text-red-400">*</span>
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                {postComment.trim().length} chars
              </span>
            </div>
            <textarea
              rows={3}
              value={postComment}
              onChange={(e) => setPostComment(e.target.value)}
              placeholder="e.g. Verified subject mappings, confirmed lab batch lists, and logged out cleanly."
              className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            {!isAutoTimeout && onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading || (postComment.trim().length < 5 && quickChecklist.length === 0)}
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center space-x-2"
            >
              {loading ? (
                <span>Saving Audit Log...</span>
              ) : (
                <>
                  <FaSignOutAlt className="w-3.5 h-3.5" />
                  <span>Submit Audit Summary & Exit</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
