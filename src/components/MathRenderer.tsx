"use client";

import React, { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  text: string;
  className?: string;
}

export default function MathRenderer({ text, className = "" }: MathRendererProps) {
  const renderedSegments = useMemo(() => {
    if (!text) return [];

    // Split text into tokens based on block math "$$" first, then inline math "$"
    // We parse block math ($$...$$) and inline math ($...$)
    const parts: { type: "text" | "inline" | "block"; content: string }[] = [];
    
    // Step 1: Parse block math "$$"
    const blockSplit = text.split("$$");
    blockSplit.forEach((blockChunk, bIdx) => {
      if (bIdx % 2 === 1) {
        // This is inside a $$ ... $$ block
        parts.push({ type: "block", content: blockChunk });
      } else {
        // This is outside block math, could contain inline math ($ ... $)
        const inlineSplit = blockChunk.split("$");
        inlineSplit.forEach((inlineChunk, iIdx) => {
          if (iIdx % 2 === 1) {
            // This is inside a $ ... $ block
            parts.push({ type: "inline", content: inlineChunk });
          } else {
            // This is normal text
            if (inlineChunk) {
              parts.push({ type: "text", content: inlineChunk });
            }
          }
        });
      }
    });

    return parts.map((part, index) => {
      if (part.type === "text") {
        return <span key={index}>{part.content}</span>;
      }

      const displayMode = part.type === "block";
      try {
        const html = katex.renderToString(part.content, {
          displayMode,
          throwOnError: false,
          trust: true,
        });
        
        if (displayMode) {
          return (
            <div
              key={index}
              className="my-3 overflow-x-auto py-1"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } else {
          return (
            <span
              key={index}
              className="inline-block px-1 align-middle"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
      } catch (err) {
        console.error("KaTeX rendering error", err);
        return (
          <span key={index} className="text-red-500 font-mono">
            {part.type === "block" ? `$$${part.content}$$` : `$${part.content}$`}
          </span>
        );
      }
    });
  }, [text]);

  return <div className={`whitespace-pre-wrap leading-relaxed ${className}`}>{renderedSegments}</div>;
}
