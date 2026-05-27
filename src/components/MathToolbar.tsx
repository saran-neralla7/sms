"use client";

import React, { useState } from "react";

interface MathToolbarProps {
  onInsert: (latex: string) => void;
}

const CATEGORIES = {
  Structures: [
    { label: "Fraction (a/b)", latex: "\\frac{a}{b}" },
    { label: "Exponent (x²)", latex: "x^{2}" },
    { label: "Subscript (x₁)", latex: "x_{1}" },
    { label: "Square Root (√x)", latex: "\\sqrt{x}" },
    { label: "nth Root (ⁿ√x)", latex: "\\sqrt[n]{x}" },
    { label: "2x2 Matrix", latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
  ],
  "Calculus & Sums": [
    { label: "Integral (∫)", latex: "\\int_{a}^{b} x \\, dx" },
    { label: "Double Integral (∬)", latex: "\\iint" },
    { label: "Summation (∑)", latex: "\\sum_{i=1}^{n}" },
    { label: "Limit (lim)", latex: "\\lim_{x \\to \\infty}" },
    { label: "Partial Diff (∂)", latex: "\\frac{\\partial y}{\\partial x}" },
    { label: "Vector (v)", latex: "\\vec{v}" },
  ],
  "Greek & Math": [
    { label: "lambda (λ)", latex: "\\lambda" },
    { label: "Lambda (Λ)", latex: "\\Lambda" },
    { label: "omega (ω)", latex: "\\omega" },
    { label: "Omega (Ω)", latex: "\\Omega" },
    { label: "pi (π)", latex: "\\pi" },
    { label: "theta (θ)", latex: "\\theta" },
    { label: "alpha (α)", latex: "\\alpha" },
    { label: "beta (β)", latex: "\\beta" },
    { label: "Delta (Δ)", latex: "\\Delta" },
    { label: "infinity (∞)", latex: "\\infty" },
  ],
  Operators: [
    { label: "times (×)", latex: "\\times" },
    { label: "divide (÷)", latex: "\\div" },
    { label: "plus-minus (±)", latex: "\\pm" },
    { label: "approx (≈)", latex: "\\approx" },
    { label: "degree (°)", latex: "^{\\circ}" },
    { label: "gradient (∇)", latex: "\\nabla" },
  ]
};

export default function MathToolbar({ onInsert }: MathToolbarProps) {
  const [activeCategory, setActiveCategory] = useState<keyof typeof CATEGORIES>("Structures");

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 mb-2 shadow-sm text-xs">
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200/80 pb-2 mb-2">
        <span className="font-semibold text-slate-500 mr-2 self-center text-[11px] uppercase tracking-wider">LaTeX Math Helper:</span>
        {Object.keys(CATEGORIES).map((catName) => (
          <button
            key={catName}
            type="button"
            onClick={() => setActiveCategory(catName as any)}
            className={`rounded-lg px-2.5 py-1 font-medium transition-all ${
              activeCategory === catName
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {catName}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
        {CATEGORIES[activeCategory].map((item, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onInsert(item.latex)}
            className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-center text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700 active:scale-95 transition-all"
            title={`Click to insert ${item.latex}`}
          >
            <span className="font-semibold text-slate-800 text-[11px] truncate w-full">{item.label}</span>
            <code className="text-[10px] text-blue-500 font-mono mt-0.5 truncate w-full">{item.latex}</code>
          </button>
        ))}
      </div>
    </div>
  );
}
