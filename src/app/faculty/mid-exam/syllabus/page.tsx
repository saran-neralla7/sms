"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  FaArrowLeft,
  FaSave,
  FaPlus,
  FaTrash,
  FaSpinner,
  FaInfoCircle,
  FaArrowRight,
  FaBookOpen,
  FaEye,
  FaDownload,
  FaBold,
  FaItalic,
  FaUnderline,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
  FaAlignJustify,
  FaListUl,
  FaListOl,
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Syllabus {
  credits: { L: number; T: number; P: number; C: number };
  contactHours: number;
  totalMarks: number;
  prerequisites: string;
  objectives: string[];
  outcomes: { code: string; description: string }[];
  units: { name: string; title: string; mappedCOs: string[]; content: string }[];
  textbooks: string[];
  referenceBooks: string[];
}

const defaultSyllabus: Syllabus = {
  credits: { L: 3, T: 0, P: 0, C: 3 },
  contactHours: 42,
  totalMarks: 100,
  prerequisites: "",
  objectives: ["To introduce ..."],
  outcomes: [
    { code: "CO1", description: "Describe the core concepts of ..." },
    { code: "CO2", description: "Apply principles of ... to solve ..." },
    { code: "CO3", description: "Analyze the performance of ..." },
    { code: "CO4", description: "Design a solution for ..." },
    { code: "CO5", description: "Evaluate the outcome of ..." },
  ],
  units: [
    { name: "UNIT-I", title: "Introduction & Basic Concepts", mappedCOs: ["CO1"], content: "Topics include: ..." },
    { name: "UNIT-II", title: "Core Architecture", mappedCOs: ["CO2"], content: "Topics include: ..." },
    { name: "UNIT-III", title: "Advanced Methods", mappedCOs: ["CO3"], content: "Topics include: ..." },
    { name: "UNIT-IV", title: "Implementation & Tuning", mappedCOs: ["CO4"], content: "Topics include: ..." },
    { name: "UNIT-V", title: "Applications & Case Studies", mappedCOs: ["CO5"], content: "Topics include: ..." },
  ],
  textbooks: ["Author Name, 'Title of the Book', Edition, Publisher, Year."],
  referenceBooks: ["Author Name, 'Title of the Reference Book', Edition, Publisher, Year."],
};

interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

interface Block {
  runs: TextRun[];
  align: "left" | "center" | "right" | "justify";
  isListItem: boolean;
  listType: "bullet" | "number" | null;
  listIndex: number;
}

interface Token {
  type: "text" | "tag";
  value: string;
}

function tokenizeHtml(html: string): Token[] {
  const tokens: Token[] = [];
  let currentText = "";
  let i = 0;
  while (i < html.length) {
    if (html[i] === "<") {
      if (currentText) {
        tokens.push({ type: "text", value: currentText });
        currentText = "";
      }
      let tag = "";
      i++;
      while (i < html.length && html[i] !== ">") {
        tag += html[i];
        i++;
      }
      tokens.push({ type: "tag", value: tag });
      i++;
    } else {
      currentText += html[i];
      i++;
    }
  }
  if (currentText) {
    tokens.push({ type: "text", value: currentText });
  }
  return tokens;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function parseHtml(html: string): Block[] {
  const tokens = tokenizeHtml(html);
  const blocks: Block[] = [];
  let currentRuns: TextRun[] = [];
  
  let bold = false;
  let italic = false;
  let underline = false;
  let align: "left" | "center" | "right" | "justify" = "left";
  
  let listType: "bullet" | "number" | null = null;
  let listIndex = 0;
  let isListItem = false;
  
  const pushBlock = () => {
    if (currentRuns.length > 0 || isListItem) {
      blocks.push({
        runs: [...currentRuns],
        align,
        isListItem,
        listType,
        listIndex
      });
      currentRuns = [];
    }
  };

  for (const token of tokens) {
    if (token.type === "tag") {
      const tagLower = token.value.toLowerCase().trim();
      
      if (tagLower.startsWith("p") || tagLower.startsWith("div")) {
        pushBlock();
        isListItem = false;
        if (tagLower.includes("text-align: center") || tagLower.includes("align=\"center\"") || tagLower.includes("align='center'")) {
          align = "center";
        } else if (tagLower.includes("text-align: right") || tagLower.includes("align=\"right\"") || tagLower.includes("align='right'")) {
          align = "right";
        } else if (tagLower.includes("text-align: justify") || tagLower.includes("align=\"justify\"") || tagLower.includes("align='justify'")) {
          align = "justify";
        } else {
          align = "left";
        }
      } else if (tagLower === "/p" || tagLower === "/div") {
        pushBlock();
        align = "left";
      } else if (tagLower === "ul") {
        pushBlock();
        listType = "bullet";
        listIndex = 0;
      } else if (tagLower === "/ul") {
        pushBlock();
        listType = null;
      } else if (tagLower === "ol") {
        pushBlock();
        listType = "number";
        listIndex = 0;
      } else if (tagLower === "/ol") {
        pushBlock();
        listType = null;
      } else if (tagLower.startsWith("li")) {
        pushBlock();
        isListItem = true;
        listIndex++;
        align = "left";
      } else if (tagLower === "/li") {
        pushBlock();
        isListItem = false;
      } else if (tagLower === "b" || tagLower === "strong") {
        bold = true;
      } else if (tagLower === "/b" || tagLower === "/strong") {
        bold = false;
      } else if (tagLower === "i" || tagLower === "em") {
        italic = true;
      } else if (tagLower === "/i" || tagLower === "/em") {
        italic = false;
      } else if (tagLower === "u") {
        underline = true;
      } else if (tagLower === "/u") {
        underline = false;
      } else if (tagLower === "br" || tagLower === "br/" || tagLower === "br /") {
        pushBlock();
      }
    } else {
      const text = decodeEntities(token.value);
      if (text) {
        currentRuns.push({
          text,
          bold,
          italic,
          underline
        });
      }
    }
  }
  
  pushBlock();
  
  if (blocks.length === 0) {
    blocks.push({
      runs: [],
      align: "left",
      isListItem: false,
      listType: null,
      listIndex: 0
    });
  }
  
  return blocks;
}

interface WordItem {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

function splitRunsToWords(runs: TextRun[]): WordItem[] {
  const words: WordItem[] = [];
  for (const run of runs) {
    const parts = run.text.match(/\S+\s*/g) || [];
    if (parts.length === 0 && run.text.length > 0) {
      words.push({
        text: run.text,
        bold: run.bold,
        italic: run.italic,
        underline: run.underline
      });
    } else {
      parts.forEach((part, idx) => {
        let wordText = part;
        if (idx === 0) {
          const leadingSpaces = run.text.match(/^\s+/);
          if (leadingSpaces) {
            wordText = leadingSpaces[0] + wordText;
          }
        }
        words.push({
          text: wordText,
          bold: run.bold,
          italic: run.italic,
          underline: run.underline
        });
      });
    }
  }
  return words;
}

function getWordWidth(doc: jsPDF, word: WordItem): number {
  let style = "normal";
  if (word.bold && word.italic) style = "bolditalic";
  else if (word.bold) style = "bold";
  else if (word.italic) style = "italic";
  
  doc.setFont("helvetica", style);
  return doc.getTextWidth(word.text);
}

interface LayoutLine {
  words: WordItem[];
  width: number;
}

function layoutWordsToLines(doc: jsPDF, words: WordItem[], maxW: number): LayoutLine[] {
  const lines: LayoutLine[] = [];
  let currentWords: WordItem[] = [];
  let currentWidth = 0;
  
  for (const word of words) {
    const wWidth = getWordWidth(doc, word);
    if (currentWords.length > 0 && currentWidth + wWidth > maxW) {
      const lastWord = currentWords[currentWords.length - 1];
      const trimmedText = lastWord.text.trimEnd();
      let trimmedWidth = currentWidth;
      if (trimmedText !== lastWord.text) {
        const fullW = getWordWidth(doc, lastWord);
        const trimmedWord = { ...lastWord, text: trimmedText };
        const trimW = getWordWidth(doc, trimmedWord);
        trimmedWidth = currentWidth - fullW + trimW;
        currentWords[currentWords.length - 1] = trimmedWord;
      }
      
      lines.push({ words: currentWords, width: trimmedWidth });
      currentWords = [word];
      currentWidth = wWidth;
    } else {
      currentWords.push(word);
      currentWidth += wWidth;
    }
  }
  
  if (currentWords.length > 0) {
    lines.push({ words: currentWords, width: currentWidth });
  }
  
  return lines;
}

function renderBlock(
  doc: jsPDF,
  block: Block,
  startX: number,
  startY: number,
  maxW: number,
  lineH: number,
  pageHeight: number,
  margin: number,
  isLastLineInDoc: boolean
): number {
  let currentY = startY;
  const indent = block.isListItem ? 6 : 0;
  const blockMaxW = block.isListItem ? maxW - indent : maxW;
  
  const words = splitRunsToWords(block.runs);
  if (words.length === 0) {
    if (block.isListItem) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      if (block.listType === "bullet") {
        doc.text("•", startX + 2, currentY);
      } else if (block.listType === "number") {
        doc.text(`${block.listIndex}.`, startX + 2, currentY);
      }
    }
    return currentY + lineH;
  }
  
  const lines = layoutWordsToLines(doc, words, blockMaxW);
  
  lines.forEach((line, lineIdx) => {
    if (currentY > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }
    
    let drawX = startX + indent;
    const isLastLine = lineIdx === lines.length - 1;
    
    if (block.isListItem && lineIdx === 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      if (block.listType === "bullet") {
        doc.text("•", startX + 2, currentY);
      } else if (block.listType === "number") {
        doc.text(`${block.listIndex}.`, startX + 2, currentY);
      }
    }
    
    let extraSpacePerGap = 0;
    if (block.align === "justify" && !isLastLine && line.words.length > 1) {
      const lineW = line.width;
      extraSpacePerGap = (blockMaxW - lineW) / (line.words.length - 1);
    }
    
    if (block.align === "center") {
      drawX = startX + indent + (blockMaxW - line.width) / 2;
    } else if (block.align === "right") {
      drawX = startX + indent + (blockMaxW - line.width);
    }
    
    line.words.forEach((word, wordIdx) => {
      let style = "normal";
      if (word.bold && word.italic) style = "bolditalic";
      else if (word.bold) style = "bold";
      else if (word.italic) style = "italic";
      
      doc.setFont("helvetica", style);
      doc.setFontSize(9);
      doc.text(word.text, drawX, currentY);
      
      const wordW = doc.getTextWidth(word.text);
      if (word.underline) {
        doc.setLineWidth(0.1);
        doc.line(drawX, currentY + 0.4, drawX + wordW, currentY + 0.4);
      }
      
      drawX += wordW;
      if (block.align === "justify" && !isLastLine) {
        drawX += extraSpacePerGap;
      }
    });
    
    currentY += lineH;
  });
  
  return currentY;
}

const renderHtmlToPdf = (
  doc: jsPDF,
  html: string,
  startX: number,
  startY: number,
  maxW: number,
  lineH: number = 4.5,
  pageHeight: number = 297,
  margin: number = 15
): number => {
  if (!html) return startY;
  const blocks = parseHtml(html);
  let currentY = startY;
  blocks.forEach((block, idx) => {
    currentY = renderBlock(
      doc,
      block,
      startX,
      currentY,
      maxW,
      lineH,
      pageHeight,
      margin,
      idx === blocks.length - 1
    );
    if (!block.isListItem) {
      currentY += 1.5;
    } else {
      currentY += 0.5;
    }
  });
  return currentY;
};

interface SyllabusRichFieldProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  className?: string;
}

function SyllabusRichField({
  value,
  onChange,
  placeholder,
  className = "",
}: SyllabusRichFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync initial value or external value changes to the editor content
  useEffect(() => {
    if (editorRef.current) {
      if (editorRef.current.innerHTML !== (value || "")) {
        editorRef.current.innerHTML = value || "";
      }
    }
  }, [value, isEditing]);

  // Click outside detection to exit editing mode
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsEditing(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      onChange(html);
    }
  };

  const executeCommand = (command: string, argValue: string = "") => {
    document.execCommand(command, false, argValue);
    if (editorRef.current) {
      editorRef.current.focus();
    }
    handleInput();
  };

  const handleStartEditing = () => {
    setIsEditing(true);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
        // Move cursor to end of text
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }, 50);
  };

  if (isEditing) {
    return (
      <div
        ref={wrapperRef}
        className={`w-full rounded-xl border border-blue-300 bg-white p-2 shadow-md focus-within:ring-2 focus-within:ring-blue-500/20 transition-all ${className}`}
      >
        <style>{`
          .syllabus-rich-content ul {
            list-style-type: disc !important;
            padding-left: 20px !important;
            margin-top: 4px !important;
            margin-bottom: 4px !important;
          }
          .syllabus-rich-content ol {
            list-style-type: decimal !important;
            padding-left: 20px !important;
            margin-top: 4px !important;
            margin-bottom: 4px !important;
          }
          .syllabus-rich-content li {
            margin-bottom: 2px !important;
          }
          .syllabus-rich-content p {
            margin: 0 !important;
            padding: 0 !important;
          }
          .syllabus-rich-content[contenteditable]:empty::before {
            content: attr(data-placeholder);
            color: #94a3b8;
            font-style: italic;
            cursor: text;
          }
        `}</style>
        {/* Toolbar */}
        <div className="flex flex-wrap gap-1 items-center pb-2 mb-2 border-b border-slate-100 text-slate-600 select-none">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); executeCommand("bold"); }}
            className="p-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            title="Bold"
          >
            <FaBold size={11} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); executeCommand("italic"); }}
            className="p-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            title="Italic"
          >
            <FaItalic size={11} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); executeCommand("underline"); }}
            className="p-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            title="Underline"
          >
            <FaUnderline size={11} />
          </button>
          <div className="w-px h-3.5 bg-slate-200 mx-1" />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); executeCommand("justifyLeft"); }}
            className="p-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            title="Align Left"
          >
            <FaAlignLeft size={11} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); executeCommand("justifyCenter"); }}
            className="p-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            title="Align Center"
          >
            <FaAlignCenter size={11} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); executeCommand("justifyRight"); }}
            className="p-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            title="Align Right"
          >
            <FaAlignRight size={11} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); executeCommand("justifyFull"); }}
            className="p-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            title="Justify"
          >
            <FaAlignJustify size={11} />
          </button>
          <div className="w-px h-3.5 bg-slate-200 mx-1" />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); executeCommand("insertUnorderedList"); }}
            className="p-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            title="Bullet List"
          >
            <FaListUl size={11} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); executeCommand("insertOrderedList"); }}
            className="p-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            title="Numbered List"
          >
            <FaListOl size={11} />
          </button>
        </div>

        {/* Editor Content Area */}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          data-placeholder={placeholder}
          className="syllabus-rich-content w-full min-h-[60px] text-xs outline-none text-slate-700 font-sans leading-relaxed focus:outline-none"
          style={{
            wordBreak: "break-word"
          }}
        />
      </div>
    );
  }

  const hasContent = value && value.replace(/<[^>]*>/g, "").trim().length > 0;

  return (
    <div
      onClick={handleStartEditing}
      className={`w-full min-h-[36px] rounded border border-slate-200 hover:border-slate-300 bg-white px-3 py-2 text-xs cursor-text transition-colors syllabus-rich-content ${className}`}
    >
      <style>{`
        .syllabus-rich-content ul {
          list-style-type: disc !important;
          padding-left: 20px !important;
          margin-top: 4px !important;
          margin-bottom: 4px !important;
        }
        .syllabus-rich-content ol {
          list-style-type: decimal !important;
          padding-left: 20px !important;
          margin-top: 4px !important;
          margin-bottom: 4px !important;
        }
        .syllabus-rich-content li {
          margin-bottom: 2px !important;
        }
        .syllabus-rich-content p {
          margin: 0 !important;
          padding: 0 !important;
        }
      `}</style>
      {hasContent ? (
        <div dangerouslySetInnerHTML={{ __html: value }} />
      ) : (
        <span className="text-slate-400 italic">{placeholder}</span>
      )}
    </div>
  );
}

function SyllabusConfigContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectId = searchParams ? searchParams.get("subjectId") : null;
  const { data: session } = useSession();

  const [subjectInfo, setSubjectInfo] = useState<{ name: string; code: string } | null>(null);
  const [syllabus, setSyllabus] = useState<Syllabus>(defaultSyllabus);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSavedOnce, setHasSavedOnce] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Cloning syllabus state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneSubjectsList, setCloneSubjectsList] = useState<any[]>([]);
  const [cloneSearchQuery, setCloneSearchQuery] = useState("");
  const [fetchingCloneSubjects, setFetchingCloneSubjects] = useState(false);
  const [cloningSubjectId, setCloningSubjectId] = useState<string | null>(null);

  const databaseSyllabusRef = useRef<Syllabus | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const openCloneModal = async () => {
    setShowCloneModal(true);
    setFetchingCloneSubjects(true);
    try {
      const res = await fetch("/api/subjects?hasSyllabus=true");
      if (res.ok) {
        const data = await res.json();
        // Filter out current subject
        setCloneSubjectsList(data.filter((s: any) => s.id !== subjectId));
      } else {
        showToast("Failed to fetch subjects for cloning", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error loading subjects list", "error");
    } finally {
      setFetchingCloneSubjects(false);
    }
  };

  const handleCloneSyllabus = async (sourceSubjectId: string) => {
    setCloningSubjectId(sourceSubjectId);
    try {
      const res = await fetch(`/api/subjects/${sourceSubjectId}/syllabus`);
      if (res.ok) {
        const data = await res.json();
        if (data.syllabus) {
          // Merge cloned syllabus with default structure to prevent missing fields
          const clonedSyllabus = {
            ...defaultSyllabus,
            ...data.syllabus,
            credits: { ...defaultSyllabus.credits, ...(data.syllabus.credits || {}) },
          };
          setSyllabus(clonedSyllabus);
          showToast(`Syllabus cloned from ${data.name} (${data.code})! Review and click 'Save' to apply.`, "success");
          setShowCloneModal(false);
        } else {
          showToast("Selected subject does not have a saved syllabus", "error");
        }
      } else {
        showToast("Failed to load source syllabus", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error cloning syllabus", "error");
    } finally {
      setCloningSubjectId(null);
    }
  };

  const loadSyllabusData = useCallback(async () => {
    if (!subjectId) return;
    try {
      const res = await fetch(`/api/subjects/${subjectId}/syllabus`);
      if (res.ok) {
        const data = await res.json();
        setSubjectInfo({ name: data.name, code: data.code });
        let initialSyllabus = defaultSyllabus;
        if (data.syllabus) {
          // Merge loaded syllabus with default to prevent missing structure fields
          initialSyllabus = {
            ...defaultSyllabus,
            ...data.syllabus,
            credits: { ...defaultSyllabus.credits, ...(data.syllabus.credits || {}) },
          };
          setHasSavedOnce(true);
        }
        databaseSyllabusRef.current = initialSyllabus;

        // Check for unsaved draft in sessionStorage
        const draftStr = sessionStorage.getItem(`syllabus_draft_${subjectId}`);
        if (draftStr) {
          try {
            const draft = JSON.parse(draftStr);
            if (draft && typeof draft === "object") {
              setSyllabus(draft);
              setTimeout(() => {
                showToast("Recovered unsaved draft from your active session.", "success");
              }, 100);
            } else {
              setSyllabus(initialSyllabus);
            }
          } catch (e) {
            console.error(e);
            setSyllabus(initialSyllabus);
          }
        } else {
          setSyllabus(initialSyllabus);
        }
      } else {
        showToast("Failed to load syllabus", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error loading subject syllabus data", "error");
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    if (session) {
      loadSyllabusData();
    }
  }, [session, loadSyllabusData]);

  useEffect(() => {
    if (!loading && subjectId && databaseSyllabusRef.current) {
      const isDifferent = JSON.stringify(syllabus) !== JSON.stringify(databaseSyllabusRef.current);
      if (isDifferent) {
        sessionStorage.setItem(`syllabus_draft_${subjectId}`, JSON.stringify(syllabus));
      } else {
        sessionStorage.removeItem(`syllabus_draft_${subjectId}`);
      }
    }
  }, [syllabus, loading, subjectId]);

  const handleCreditChange = (field: "L" | "T" | "P" | "C", val: string) => {
    const num = parseFloat(val) || 0;
    setSyllabus((prev) => ({
      ...prev,
      credits: {
        ...prev.credits,
        [field]: num,
      },
    }));
  };

  const handleMetadataChange = (field: "contactHours" | "totalMarks" | "prerequisites", val: string) => {
    setSyllabus((prev) => ({
      ...prev,
      [field]: field === "prerequisites" ? val : parseFloat(val) || 0,
    }));
  };

  // Objectives handlers
  const handleObjectiveChange = (index: number, val: string) => {
    setSyllabus((prev) => {
      const copy = [...prev.objectives];
      copy[index] = val;
      return { ...prev, objectives: copy };
    });
  };

  const addObjective = () => {
    setSyllabus((prev) => ({
      ...prev,
      objectives: [...prev.objectives, ""],
    }));
  };

  const removeObjective = (index: number) => {
    setSyllabus((prev) => {
      if (prev.objectives.length <= 1) {
        return { ...prev, objectives: [""] };
      }
      return { ...prev, objectives: prev.objectives.filter((_, i) => i !== index) };
    });
  };

  // Outcomes handlers
  const handleOutcomeChange = (index: number, field: "code" | "description", val: string) => {
    setSyllabus((prev) => {
      const copy = [...prev.outcomes];
      copy[index] = { ...copy[index], [field]: val };
      return { ...prev, outcomes: copy };
    });
  };

  const addOutcome = () => {
    setSyllabus((prev) => {
      const nextCodeNum = prev.outcomes.length + 1;
      return {
        ...prev,
        outcomes: [...prev.outcomes, { code: `CO${nextCodeNum}`, description: "" }],
      };
    });
  };

  const removeOutcome = (index: number) => {
    setSyllabus((prev) => {
      if (prev.outcomes.length <= 1) {
        return { ...prev, outcomes: [{ code: "CO1", description: "" }] };
      }
      return { ...prev, outcomes: prev.outcomes.filter((_, i) => i !== index) };
    });
  };

  // Textbooks handlers
  const handleTextbookChange = (index: number, val: string) => {
    setSyllabus((prev) => {
      const copy = [...prev.textbooks];
      copy[index] = val;
      return { ...prev, textbooks: copy };
    });
  };

  const addTextbook = () => {
    setSyllabus((prev) => ({ ...prev, textbooks: [...prev.textbooks, ""] }));
  };

  const removeTextbook = (index: number) => {
    setSyllabus((prev) => {
      if (prev.textbooks.length <= 1) return { ...prev, textbooks: [""] };
      return { ...prev, textbooks: prev.textbooks.filter((_, i) => i !== index) };
    });
  };

  // Reference Books handlers
  const handleReferenceChange = (index: number, val: string) => {
    setSyllabus((prev) => {
      const copy = [...prev.referenceBooks];
      copy[index] = val;
      return { ...prev, referenceBooks: copy };
    });
  };

  const addReference = () => {
    setSyllabus((prev) => ({ ...prev, referenceBooks: [...prev.referenceBooks, ""] }));
  };

  const removeReference = (index: number) => {
    setSyllabus((prev) => {
      if (prev.referenceBooks.length <= 1) return { ...prev, referenceBooks: [""] };
      return { ...prev, referenceBooks: prev.referenceBooks.filter((_, i) => i !== index) };
    });
  };

  // Unit handlers
  const handleUnitChange = (index: number, field: "title" | "content", val: string) => {
    setSyllabus((prev) => {
      const copy = [...prev.units];
      copy[index] = { ...copy[index], [field]: val };
      return { ...prev, units: copy };
    });
  };

  const handleUnitCOToggle = (unitIdx: number, coCode: string) => {
    setSyllabus((prev) => {
      const copy = [...prev.units];
      const mapped = [...copy[unitIdx].mappedCOs];
      if (mapped.includes(coCode)) {
        copy[unitIdx].mappedCOs = mapped.filter((c) => c !== coCode);
      } else {
        copy[unitIdx].mappedCOs = [...mapped, coCode].sort();
      }
      return { ...prev, units: copy };
    });
  };

  const addUnit = () => {
    setSyllabus((prev) => {
      const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
      const nextIndex = prev.units.length;
      const unitName = nextIndex < romanNumerals.length ? `UNIT-${romanNumerals[nextIndex]}` : `UNIT-${nextIndex + 1}`;
      return {
        ...prev,
        units: [...prev.units, { name: unitName, title: "", mappedCOs: [], content: "" }],
      };
    });
  };

  const removeUnit = (index: number) => {
    setSyllabus((prev) => {
      if (prev.units.length <= 1) {
        return {
          ...prev,
          units: [{ name: "UNIT-I", title: "", mappedCOs: [], content: "" }],
        };
      }
      const filtered = prev.units.filter((_, i) => i !== index);
      const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
      const remapped = filtered.map((unit, idx) => {
        const unitName = idx < romanNumerals.length ? `UNIT-${romanNumerals[idx]}` : `UNIT-${idx + 1}`;
        return { ...unit, name: unitName };
      });
      return { ...prev, units: remapped };
    });
  };


  const handleSave = async () => {
    // Validate Outcomes
    const invalidOutcomes = syllabus.outcomes.filter(o => !o.code.trim() || !o.description.trim());
    if (invalidOutcomes.length > 0) {
      showToast("All outcomes must have a valid CO code and description", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/subjects/${subjectId}/syllabus`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ syllabus }),
      });

      if (res.ok) {
        showToast("Syllabus configuration saved successfully!");
        setHasSavedOnce(true);
        databaseSyllabusRef.current = syllabus;
        sessionStorage.removeItem(`syllabus_draft_${subjectId}`);
      } else {
        const errorData = await res.json();
        showToast(errorData.error || "Failed to save syllabus", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Network error saving syllabus", "error");
    } finally {
      setSaving(false);
    }
  };

  const generateSyllabusPDF = async (mode: "preview" | "download") => {
    try {
      showToast(mode === "download" ? "Downloading syllabus PDF..." : "Preparing preview...", "success");
      
      const cleanHtml = (html: string): string => {
        if (!html) return "";
        let text = html
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n")
          .replace(/<\/div>/gi, "\n");
        text = text.replace(/<[^>]*>/g, "");
        return text
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .trim();
      };

      let logoBase64: string | null = null;
      try {
        const logoRes = await fetch("/logo.png");
        const blob = await logoRes.blob();
        logoBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error("Could not load logo", e);
      }

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const margin = 15;
      
      // Header Banner & Logo
      if (logoBase64) {
        const getImageType = (base64: string) => {
          if (base64.startsWith("data:image/png")) return "PNG";
          if (base64.startsWith("data:image/webp")) return "WEBP";
          return "JPEG";
        };
        try {
          doc.addImage(logoBase64, getImageType(logoBase64), 15, 10, 20, 20);
        } catch (e) {
          console.warn("Failed to add logo to PDF");
        }
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES(AUTONOMOUS)", 38, 15, { align: "left" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Rushikonda, Visakhapatnam - 530045.", 38, 20, { align: "left" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("COURSE STRUCTURE & SYLLABUS CONFIGURATION SHEET", 38, 25, { align: "left" });

      let currentY = 32;
      doc.setLineWidth(0.2);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, currentY, 210 - margin, currentY);
      currentY += 6;

      // Subject Details Info
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Subject Name: ", margin, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(subjectInfo?.name || "N/A", margin + 28, currentY);

      doc.setFont("helvetica", "bold");
      doc.text("Subject Code: ", 210 - margin - 50, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(subjectInfo?.code || "N/A", 210 - margin - 22, currentY);
      currentY += 6;

      doc.line(margin, currentY, 210 - margin, currentY);
      currentY += 6;

      // Section 1: Teaching Methodology Table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("1. Teaching Methodology & Credits Structure", margin, currentY);
      currentY += 4;

      const creditsHeaders = [["L", "T", "P", "C", "Contact Hours", "Total Marks"]];
      const creditsRows = [[
        syllabus.credits.L.toString(),
        syllabus.credits.T.toString(),
        syllabus.credits.P.toString(),
        syllabus.credits.C.toString(),
        syllabus.contactHours.toString(),
        syllabus.totalMarks.toString()
      ]];

      autoTable(doc, {
        head: creditsHeaders,
        body: creditsRows,
        startY: currentY,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 9,
          cellPadding: 2,
          halign: "center",
          valign: "middle",
          lineColor: [0, 0, 0],
          lineWidth: 0.3,
          font: "helvetica",
          textColor: [40, 40, 40]
        },
        headStyles: {
          fillColor: [240, 243, 246],
          textColor: [30, 41, 59],
          fontSize: 8.5,
          fontStyle: "bold",
          lineWidth: 0.4,
          lineColor: [0, 0, 0]
        },
        theme: "grid"
      });

      currentY = (doc as any).lastAutoTable.finalY + 6;

      // Prerequisites
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Prerequisite(s):", margin, currentY);
      if (!syllabus.prerequisites || cleanHtml(syllabus.prerequisites) === "None") {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("None", margin + 30, currentY);
        currentY += 4.5 + 3;
      } else {
        currentY = renderHtmlToPdf(doc, syllabus.prerequisites, margin + 30, currentY, 210 - margin * 2 - 30, 4.5, 297, 15);
        currentY += 3;
      }

      // Section 2: Course Objectives
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("2. Course Objectives", margin, currentY);
      currentY += 5;
      
      syllabus.objectives.forEach((obj, idx) => {
        const blocks = parseHtml(obj);
        if (blocks.length > 0) {
          blocks[0].runs.unshift({
            text: `${idx + 1}. `,
            bold: true,
            italic: false,
            underline: false
          });
        }
        blocks.forEach((block) => {
          currentY = renderBlock(doc, block, margin, currentY, 210 - margin * 2, 4.5, 297, 15, false);
        });
        currentY += 1.5;
      });
      currentY += 3;

      // Section 3: Course Outcomes
      if (currentY > 260) {
        doc.addPage();
        currentY = 15;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("3. Course Outcomes (COs)", margin, currentY);
      currentY += 4;

      const coHeaders = [["CO Code", "Outcome Description"]];
      const coRows = syllabus.outcomes.map(co => [co.code, cleanHtml(co.description)]);

      autoTable(doc, {
        head: coHeaders,
        body: coRows,
        startY: currentY,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 8.5,
          cellPadding: 2,
          halign: "left",
          valign: "middle",
          lineColor: [0, 0, 0],
          lineWidth: 0.3,
          font: "helvetica",
          textColor: [40, 40, 40]
        },
        headStyles: {
          fillColor: [240, 243, 246],
          textColor: [30, 41, 59],
          fontSize: 8.5,
          fontStyle: "bold",
          lineWidth: 0.4,
          lineColor: [0, 0, 0]
        },
        columnStyles: {
          0: { cellWidth: 20, halign: "center", fontStyle: "bold" }
        },
        theme: "grid"
      });

      currentY = (doc as any).lastAutoTable.finalY + 6;

      // Section 4: Unit-wise Content
      if (currentY > 260) {
        doc.addPage();
        currentY = 15;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("4. Unit-wise Content", margin, currentY);
      currentY += 5;

      syllabus.units.forEach((unit) => {
        const unitTitleText = `${cleanHtml(unit.name)}: ${cleanHtml(unit.title)} (Mapped COs: ${unit.mappedCOs.join(", ")})`;
        const titleLines = doc.splitTextToSize(unitTitleText, 210 - margin * 2);
        
        if (currentY + (titleLines.length * 4.5) + 10 > 280) {
          doc.addPage();
          currentY = 15;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.text(titleLines, margin, currentY);
        currentY += (titleLines.length * 4.5) + 1.5;

        currentY = renderHtmlToPdf(doc, unit.content, margin, currentY, 210 - margin * 2, 4.5, 297, 15);
        currentY += 4;
      });

      // Section 5: Textbooks & Reference Books
      if (currentY > 250) {
        doc.addPage();
        currentY = 15;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("5. Books & References", margin, currentY);
      currentY += 5;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Textbooks:", margin, currentY);
      currentY += 4.5;
      
      syllabus.textbooks.forEach((tb, idx) => {
        const blocks = parseHtml(tb);
        if (blocks.length > 0) {
          blocks[0].runs.unshift({
            text: `${idx + 1}. `,
            bold: true,
            italic: false,
            underline: false
          });
        }
        blocks.forEach((block) => {
          currentY = renderBlock(doc, block, margin, currentY, 210 - margin * 2, 4.5, 297, 15, false);
        });
        currentY += 1.5;
      });
      currentY += 3;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      if (currentY > 275) {
        doc.addPage();
        currentY = 15;
      }
      doc.text("Reference Books:", margin, currentY);
      currentY += 4.5;

      syllabus.referenceBooks.forEach((ref, idx) => {
        const blocks = parseHtml(ref);
        if (blocks.length > 0) {
          blocks[0].runs.unshift({
            text: `${idx + 1}. `,
            bold: true,
            italic: false,
            underline: false
          });
        }
        blocks.forEach((block) => {
          currentY = renderBlock(doc, block, margin, currentY, 210 - margin * 2, 4.5, 297, 15, false);
        });
        currentY += 1.5;
      });

      const filename = `Syllabus_${subjectInfo?.code || "Subject"}.pdf`;
      if (mode === "download") {
        doc.save(filename);
        showToast("Syllabus PDF downloaded successfully!", "success");
      } else {
        const pdfBlob = doc.output("blob");
        const blobUrl = URL.createObjectURL(pdfBlob);
        window.open(blobUrl, "_blank");
        showToast("Preview loaded in new tab!", "success");
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to generate PDF", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LogoSpinner fullScreen={false} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      {/* Sticky Header Bar */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                <FaArrowLeft /> Back
              </button>
              <div>
                <h1 className="font-bold text-slate-900">Syllabus Configuration</h1>
                <p className="text-xs text-slate-500">
                  {subjectInfo?.name} ({subjectInfo?.code})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={openCloneModal}
                className="flex items-center gap-2 rounded-xl bg-teal-50 border border-teal-200 px-4 py-2 text-sm font-medium text-teal-700 shadow-sm hover:bg-teal-100 transition-all cursor-pointer animate-pulse"
              >
                <FaBookOpen /> Clone Syllabus
              </button>

              <button
                onClick={() => generateSyllabusPDF("preview")}
                className="flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-200 transition-all cursor-pointer"
              >
                <FaEye /> Preview
              </button>

              <button
                onClick={() => generateSyllabusPDF("download")}
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-900 transition-all cursor-pointer"
              >
                <FaDownload /> Download
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                Save Syllabus
              </button>

              <button
                onClick={() => router.push(`/faculty/mid-exam/co-po-mapping?subjectId=${subjectId}`)}
                className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition-all ${
                  hasSavedOnce
                    ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 ring-2 ring-emerald-200 animate-pulse cursor-pointer"
                    : "bg-slate-200 text-slate-600 cursor-not-allowed hover:bg-slate-300"
                }`}
              >
                Go to CO-PO Mappings <FaArrowRight />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Info Guide */}
        <div className="mb-6 flex gap-3 rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100 shadow-sm">
          <FaInfoCircle className="mt-0.5 text-blue-500 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">LibreOffice Syllabus Layout Editor</p>
            <p className="mt-1">
              Configure the subject syllabus structure below. The list of Course Outcomes (COs) defined here will dynamically populate the question paper mapping forms and the CO-PO correlation matrices.
            </p>
          </div>
        </div>

        {/* The Document Sheet */}
        <div className="rounded-xl border border-slate-300 bg-white p-8 shadow-lg md:p-12">
          {/* Autonomous Document Header Mock */}
          <div className="mb-8 border-b-2 border-double border-slate-400 pb-6 text-center">
            <h2 className="text-lg font-bold tracking-wide text-slate-900 uppercase">
              GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES (AUTONOMOUS)
            </h2>
            <p className="text-xs font-semibold text-slate-600">
              Rushikonda, Visakhapatnam - 530045.
            </p>
            <p className="mt-1 text-sm font-bold text-slate-800 uppercase">
              Course Structure & Syllabus Configuration Sheet
            </p>
          </div>

          <div className="space-y-8">
            {/* 1. Methodology Credits Grid */}
            <div>
              <h3 className="mb-3 border-l-4 border-slate-700 pl-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                1. Teaching Methodology & Credits Structure
              </h3>
              <div className="overflow-x-auto rounded-lg border border-slate-300">
                <table className="w-full min-w-[500px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-300">
                      <th className="px-4 py-2 border-r border-slate-300 text-center w-20">L</th>
                      <th className="px-4 py-2 border-r border-slate-300 text-center w-20">T</th>
                      <th className="px-4 py-2 border-r border-slate-300 text-center w-20">P</th>
                      <th className="px-4 py-2 border-r border-slate-300 text-center w-20">C</th>
                      <th className="px-4 py-2 border-r border-slate-300 text-left">Contact Hours</th>
                      <th className="px-4 py-2 text-left">Total Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="p-2 border-r border-slate-300">
                        <input
                          type="number"
                          value={syllabus.credits.L}
                          onChange={(e) => handleCreditChange("L", e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-center font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-300">
                        <input
                          type="number"
                          value={syllabus.credits.T}
                          onChange={(e) => handleCreditChange("T", e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-center font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-300">
                        <input
                          type="number"
                          value={syllabus.credits.P}
                          onChange={(e) => handleCreditChange("P", e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-center font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-300">
                        <input
                          type="number"
                          value={syllabus.credits.C}
                          onChange={(e) => handleCreditChange("C", e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-center font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-300">
                        <input
                          type="number"
                          value={syllabus.contactHours}
                          onChange={(e) => handleMetadataChange("contactHours", e.target.value)}
                          className="w-full rounded border border-slate-200 px-3 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={syllabus.totalMarks}
                          onChange={(e) => handleMetadataChange("totalMarks", e.target.value)}
                          className="w-full rounded border border-slate-200 px-3 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Prerequisites */}
            <div>
              <h3 className="mb-2 border-l-4 border-slate-700 pl-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                Prerequisite(s)
              </h3>
              <SyllabusRichField
                value={syllabus.prerequisites}
                onChange={(val) => handleMetadataChange("prerequisites", val)}
                placeholder="e.g. Basic Mathematics, Programming Concepts in C"
                className="w-full"
              />
            </div>

            {/* 2. Course Objectives */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="border-l-4 border-slate-700 pl-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                  2. Course Objectives
                </h3>
                <button
                  type="button"
                  onClick={addObjective}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <FaPlus size={10} /> Add Objective
                </button>
              </div>
              <div className="space-y-2">
                {syllabus.objectives.map((obj, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <span className="text-xs font-bold text-slate-400 w-6 mt-2">{index + 1}.</span>
                    <SyllabusRichField
                      value={obj}
                      onChange={(val) => handleObjectiveChange(index, val)}
                      placeholder={`Enter Course Objective ${index + 1}`}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeObjective(index)}
                      className="text-red-500 hover:text-red-700 transition-colors p-1 mt-2"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Course Outcomes */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="border-l-4 border-slate-700 pl-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                  3. Course Outcomes (COs)
                </h3>
                <button
                  type="button"
                  onClick={addOutcome}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <FaPlus size={10} /> Add Outcome
                </button>
              </div>
              <div className="space-y-3">
                {syllabus.outcomes.map((co, index) => (
                  <div key={index} className="flex gap-3 items-start border border-slate-100 rounded-lg p-2 hover:bg-slate-50/50 transition-colors">
                    <div className="w-20">
                      <span className="text-xs font-bold text-slate-500 block mb-1">Code</span>
                      <input
                        type="text"
                        value={co.code}
                        onChange={(e) => handleOutcomeChange(index, "code", e.target.value)}
                        placeholder="CO1"
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-bold text-slate-500 block mb-1">Outcome Description</span>
                      <SyllabusRichField
                        value={co.description}
                        onChange={(val) => handleOutcomeChange(index, "description", val)}
                        placeholder={`At the end of the course, student will be able to ...`}
                        className="w-full"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOutcome(index)}
                      className="text-red-500 hover:text-red-700 transition-colors p-1 mt-6"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Units Details */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="border-l-4 border-slate-700 pl-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                  4. Unit-wise Content
                </h3>
                <button
                  type="button"
                  onClick={addUnit}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <FaPlus size={10} /> Add Unit
                </button>
              </div>
              <div className="space-y-6">
                {syllabus.units.map((unit, index) => (
                  <div key={index} className="border border-slate-300 rounded-lg p-4 bg-slate-50/30">
                    <div className="mb-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Unit Number</label>
                        <input
                          type="text"
                          value={unit.name}
                          readOnly
                          className="w-full rounded border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 block mb-1">Unit Title</label>
                        <div className="flex items-center gap-2">
                          <SyllabusRichField
                            value={unit.title}
                            onChange={(val) => handleUnitChange(index, "title", val)}
                            placeholder="e.g. Introduction to Algorithms"
                            className="flex-1 font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => removeUnit(index)}
                            className="text-red-500 hover:text-red-700 transition-colors p-2 border border-slate-200 hover:border-red-200 hover:bg-red-50 rounded-lg shadow-sm font-semibold"
                            title={`Remove ${unit.name}`}
                          >
                            <FaTrash size={12} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Mapped COs checkboxes */}
                    <div className="mb-3">
                      <label className="text-xs font-bold text-slate-500 block mb-1">Mapped Course Outcomes</label>
                      <div className="flex flex-wrap gap-2">
                        {syllabus.outcomes.map((co) => (
                          <button
                            key={co.code}
                            type="button"
                            onClick={() => handleUnitCOToggle(index, co.code)}
                            className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                              unit.mappedCOs.includes(co.code)
                                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {co.code}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Unit Content / Topics</label>
                      <SyllabusRichField
                        value={unit.content}
                        onChange={(val) => handleUnitChange(index, "content", val)}
                        placeholder="Detail the chapters, topics, sections and lab contents if any..."
                        className="w-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Textbooks & Reference Books */}
            <div>
              <h3 className="mb-4 border-l-4 border-slate-700 pl-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                5. Books & References
              </h3>

              {/* Textbooks */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase">Textbooks</h4>
                  <button
                    type="button"
                    onClick={addTextbook}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <FaPlus size={10} /> Add Textbook
                  </button>
                </div>
                <div className="space-y-2">
                  {syllabus.textbooks.map((tb, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <span className="text-xs font-bold text-slate-400 w-6 mt-2">{index + 1}.</span>
                      <SyllabusRichField
                        value={tb}
                        onChange={(val) => handleTextbookChange(index, val)}
                        placeholder="Author, 'Book Title', Publisher, Edition, Year"
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeTextbook(index)}
                        className="text-red-500 hover:text-red-700 transition-colors p-1 mt-2"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reference Books */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase">Reference Books</h4>
                  <button
                    type="button"
                    onClick={addReference}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <FaPlus size={10} /> Add Reference Book
                  </button>
                </div>
                <div className="space-y-2">
                  {syllabus.referenceBooks.map((refB, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <span className="text-xs font-bold text-slate-400 w-6 mt-2">{index + 1}.</span>
                      <SyllabusRichField
                        value={refB}
                        onChange={(val) => handleReferenceChange(index, val)}
                        placeholder="Author, 'Book Title', Publisher, Edition, Year"
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeReference(index)}
                        className="text-red-500 hover:text-red-700 transition-colors p-1 mt-2"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clone Syllabus Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-md font-bold text-slate-900 flex items-center gap-2">
                <FaBookOpen className="text-teal-600" size={16} />
                <span>Clone Syllabus from Subject</span>
              </h2>
              <button
                onClick={() => setShowCloneModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg focus:outline-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
              <div className="text-xs text-slate-500">
                Search and select any subject in the system that has a syllabus defined. This will clone its units, objectives, textbooks, reference books, and credits into your current syllabus editor.
              </div>

              {/* Search Bar */}
              <input
                type="text"
                placeholder="Search by code or name (e.g. Physics)..."
                value={cloneSearchQuery}
                onChange={(e) => setCloneSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              />

              {/* Subjects List */}
              <div className="flex-1 border border-slate-200 rounded-lg overflow-y-auto max-h-[300px]">
                {fetchingCloneSubjects ? (
                  <div className="p-8 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                    <FaSpinner className="animate-spin text-teal-600 h-5 w-5" />
                    <span>Loading subjects...</span>
                  </div>
                ) : (
                  (() => {
                    const filtered = cloneSubjectsList.filter((s: any) =>
                      s.name.toLowerCase().includes(cloneSearchQuery.toLowerCase()) ||
                      s.code.toLowerCase().includes(cloneSearchQuery.toLowerCase())
                    );

                    if (filtered.length === 0) {
                      return (
                        <div className="p-8 text-center text-xs text-slate-400">
                          No subjects with saved syllabus found.
                        </div>
                      );
                    }

                    return (
                      <div className="divide-y divide-slate-100">
                        {filtered.map((s: any) => (
                          <div
                            key={s.id}
                            className="p-3 hover:bg-slate-50 flex items-center justify-between transition-colors text-xs"
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-slate-800">{s.name} ({s.code})</span>
                              <span className="text-[10px] font-semibold text-slate-500">
                                {s.department?.name || "All Departments"} • Regulation: {s.regulation?.name || "N/A"} • Year {s.year}, Sem {s.semester}
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={cloningSubjectId !== null}
                              onClick={() => handleCloneSyllabus(s.id)}
                              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold text-[10px] shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              {cloningSubjectId === s.id ? (
                                <FaSpinner className="animate-spin inline mr-1" />
                              ) : null}
                              Clone
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCloneModal(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default function SyllabusConfigPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LogoSpinner fullScreen={false} />
        </div>
      }
    >
      <SyllabusConfigContent />
    </Suspense>
  );
}
