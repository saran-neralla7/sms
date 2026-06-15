"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";

// Dynamically import mathlive only on client side
let mathliveLoaded = false;

interface MathFieldEditorProps {
  /** The current LaTeX value (may contain mixed text + $...$ / $$...$$ segments) */
  value: string;
  /** Called when the user edits the math field */
  onChange: (latex: string) => void;
  /** Whether the field is disabled (frozen paper) */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Optional element ID */
  id?: string;
}

/**
 * A WYSIWYG math equation editor powered by MathLive.
 * Faculty can visually type fractions, integrals, greek letters, etc.
 * Outputs standard LaTeX that the existing MathRenderer/KaTeX can render.
 */
export default function MathFieldEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "Type math here...",
  id,
}: MathFieldEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mathFieldRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const isInternalUpdate = useRef(false);

  // Load mathlive dynamically (it uses browser APIs)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadMathLive = async () => {
      if (!mathliveLoaded) {
        await import("mathlive");
        mathliveLoaded = true;
      }
      setIsReady(true);
    };

    loadMathLive();
  }, []);

  // Create and configure the math-field element
  useEffect(() => {
    if (!isReady || !containerRef.current) return;

    // Check if already created
    if (mathFieldRef.current) return;

    const mf = document.createElement("math-field") as any;
    mf.id = id || "";

    // Styling
    mf.style.width = "100%";
    mf.style.minHeight = "60px";
    mf.style.fontSize = "16px";
    mf.style.padding = "8px 12px";
    mf.style.border = "1px solid #e2e8f0";
    mf.style.borderRadius = "8px";
    mf.style.backgroundColor = disabled ? "#f8fafc" : "#ffffff";
    mf.style.outline = "none";
    mf.style.fontFamily = "'Times New Roman', serif";

    // Configure the math field
    mf.mathVirtualKeyboardPolicy = "manual";
    mf.smartMode = true;
    mf.smartFence = true;
    mf.smartSuperscript = true;

    if (disabled) {
      mf.readOnly = true;
    }

    // Set initial value
    if (value) {
      // Extract pure LaTeX from $...$ wrapping if present
      const cleanLatex = extractLatex(value);
      mf.value = cleanLatex;
    }

    // Listen for input events
    const handleInput = () => {
      if (isInternalUpdate.current) return;
      const latex = mf.value || "";
      // Wrap in $...$ for inline math compatibility with the existing system
      if (latex.trim()) {
        onChange(latex);
      } else {
        onChange("");
      }
    };

    mf.addEventListener("input", handleInput);

    // Focus styling
    mf.addEventListener("focus", () => {
      mf.style.borderColor = "#3b82f6";
      mf.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.15)";
    });
    mf.addEventListener("blur", () => {
      mf.style.borderColor = "#e2e8f0";
      mf.style.boxShadow = "none";
    });

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(mf);
    mathFieldRef.current = mf;

    return () => {
      mf.removeEventListener("input", handleInput);
    };
  }, [isReady, disabled, id]);

  // Sync external value changes
  useEffect(() => {
    if (!mathFieldRef.current || !isReady) return;

    const cleanLatex = extractLatex(value);
    const currentValue = mathFieldRef.current.value || "";

    if (cleanLatex !== currentValue) {
      isInternalUpdate.current = true;
      mathFieldRef.current.value = cleanLatex;
      isInternalUpdate.current = false;
    }
  }, [value, isReady]);

  if (!isReady) {
    return (
      <div className="w-full min-h-[60px] rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-400">
        Loading math editor...
      </div>
    );
  }

  return <div ref={containerRef} className="math-field-container" />;
}

/**
 * Extract pure LaTeX from text that may be wrapped with $ or $$ delimiters.
 * If there are no delimiters, return the raw text.
 */
function extractLatex(text: string): string {
  if (!text) return "";

  // If the entire string is wrapped with $$...$$
  if (text.startsWith("$$") && text.endsWith("$$") && text.length > 4) {
    return text.slice(2, -2);
  }

  // If the entire string is wrapped with $...$
  if (text.startsWith("$") && text.endsWith("$") && text.length > 2 && !text.startsWith("$$")) {
    return text.slice(1, -1);
  }

  return text;
}
