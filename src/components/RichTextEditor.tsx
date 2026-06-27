"use client";

import React, { useRef, useEffect } from "react";
import {
    FaBold,
    FaItalic,
    FaUnderline,
    FaListUl,
    FaListOl,
    FaAlignLeft,
    FaAlignCenter,
    FaAlignRight,
    FaAlignJustify,
    FaEraser
} from "react-icons/fa";

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export default function RichTextEditor({
    value,
    onChange,
    placeholder = "Enter topics taught in this session..."
}: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastValueRef = useRef<string>(value);

    // Initial load and external updates
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            // Prevent cursor reset by only updating if values are actually different
            if (value !== lastValueRef.current) {
                editorRef.current.innerHTML = value || "";
                lastValueRef.current = value;
            }
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            const currentHTML = editorRef.current.innerHTML;
            // Treat empty paragraph or empty divs as empty string
            const cleanedHTML = currentHTML === "<br>" || currentHTML === "<div><br></div>" || currentHTML === "<p><br></p>" ? "" : currentHTML;
            lastValueRef.current = cleanedHTML;
            onChange(cleanedHTML);
        }
    };

    const execCmd = (command: string, ui: boolean = false, val: string = "") => {
        if (typeof document !== "undefined") {
            document.execCommand(command, ui, val);
            handleInput();
            // Restore focus
            editorRef.current?.focus();
        }
    };

    return (
        <div className="flex flex-col w-full border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-50 border-b border-slate-200 p-2 select-none">
                <button
                    type="button"
                    onClick={() => execCmd("bold")}
                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
                    title="Bold (Ctrl+B)"
                >
                    <FaBold size={13} />
                </button>
                <button
                    type="button"
                    onClick={() => execCmd("italic")}
                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
                    title="Italic (Ctrl+I)"
                >
                    <FaItalic size={13} />
                </button>
                <button
                    type="button"
                    onClick={() => execCmd("underline")}
                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
                    title="Underline (Ctrl+U)"
                >
                    <FaUnderline size={13} />
                </button>

                <div className="w-px h-5 bg-slate-200 mx-1"></div>

                <button
                    type="button"
                    onClick={() => execCmd("insertUnorderedList")}
                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
                    title="Bullet List"
                >
                    <FaListUl size={13} />
                </button>
                <button
                    type="button"
                    onClick={() => execCmd("insertOrderedList")}
                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
                    title="Numbered List"
                >
                    <FaListOl size={13} />
                </button>

                <div className="w-px h-5 bg-slate-200 mx-1"></div>

                <button
                    type="button"
                    onClick={() => execCmd("justifyLeft")}
                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
                    title="Align Left"
                >
                    <FaAlignLeft size={13} />
                </button>
                <button
                    type="button"
                    onClick={() => execCmd("justifyCenter")}
                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
                    title="Align Center"
                >
                    <FaAlignCenter size={13} />
                </button>
                <button
                    type="button"
                    onClick={() => execCmd("justifyRight")}
                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
                    title="Align Right"
                >
                    <FaAlignRight size={13} />
                </button>
                <button
                    type="button"
                    onClick={() => execCmd("justifyFull")}
                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
                    title="Justify"
                >
                    <FaAlignJustify size={13} />
                </button>

                <div className="w-px h-5 bg-slate-200 mx-1"></div>

                <button
                    type="button"
                    onClick={() => execCmd("removeFormat")}
                    className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Clear Formatting"
                >
                    <FaEraser size={13} />
                </button>
            </div>

            {/* Editable Area */}
            <div className="relative min-h-[150px] bg-white flex flex-col">
                <div
                    ref={editorRef}
                    contentEditable
                    onInput={handleInput}
                    onBlur={handleInput}
                    className="flex-1 p-4 outline-none text-slate-800 text-sm min-h-[150px] prose prose-sm max-w-none focus:outline-none select-text"
                    style={{ minHeight: "150px" }}
                />
                
                {/* Custom CSS for editor styles */}
                <style jsx global>{`
                    .prose ul {
                        list-style-type: disc !important;
                        padding-left: 1.5rem !important;
                        margin-top: 0.5rem !important;
                        margin-bottom: 0.5rem !important;
                    }
                    .prose ol {
                        list-style-type: decimal !important;
                        padding-left: 1.5rem !important;
                        margin-top: 0.5rem !important;
                        margin-bottom: 0.5rem !important;
                    }
                    .prose li {
                        margin-top: 0.25rem !important;
                        margin-bottom: 0.25rem !important;
                    }
                `}</style>
                
                {/* Placeholder */}
                {!value && (
                    <div className="absolute top-4 left-4 text-slate-400 text-sm pointer-events-none select-none">
                        {placeholder}
                    </div>
                )}
            </div>
        </div>
    );
}
