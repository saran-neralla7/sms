"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaTimes,
  FaPaperPlane,
  FaHeadset,
  FaChevronDown,
  FaChevronUp,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle,
  FaArrowLeft,
  FaPlus,
  FaQuestionCircle,
  FaComments,
  FaSync
} from "react-icons/fa";

interface Message {
  id: string;
  senderName: string;
  senderRole: string;
  message: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  ticketNumber: number;
  title: string;
  category: string;
  priority: string;
  status: string;
  resolutionNotes?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  _count?: { messages: number };
}

const FAQ_ITEMS = [
  {
    q: "How do I submit Mid Exam Draft marks?",
    category: "Mid Exams",
    a: "Navigate to Faculty > Mid Exam > Marks Entry. Enter the marks for each question. To save progress, click 'Save Draft'. Once all marks are verified, click 'Submit Draft' to finalize. Note that once submitted, you cannot edit without Admin approval."
  },
  {
    q: "How are Open Elective batches divided?",
    category: "Electives",
    a: "Open Electives (OE) students are enrolled college-wide. Admin maps them into Batch-1 and Batch-2 assigned to respective faculty. Your registered students will appear under your assigned OE batch."
  },
  {
    q: "Student roll number is not showing in my section",
    category: "Students",
    a: "Check if the student is assigned to another section or flagged under detained/rejoined status. If a newly admitted student is missing, please raise a ticket under 'Student Data' with their Roll Number and Section."
  },
  {
    q: "How to correct attendance posted with an error?",
    category: "Attendance",
    a: "Attendance submitted for a past date can be reviewed under Attendance > History. For date-level lock removal or student presence adjustment, raise a ticket with Date, Period, and Subject."
  }
];

export default function GvpSahayakWidget() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"FAQS" | "TICKETS" | "NEW">("FAQS");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  // Tickets state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [loadingActiveTicket, setLoadingActiveTicket] = useState(false);

  // New ticket form
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("MID_EXAMS");
  const [newPriority, setNewPriority] = useState("MEDIUM");
  const [newMessage, setNewMessage] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Chat message input
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Only show for Faculty & HOD
  const isFacultyOrHod = user?.role === "FACULTY" || user?.role === "HOD";

  useEffect(() => {
    if (isFacultyOrHod && isOpen) {
      fetchTickets();
    }
  }, [isFacultyOrHod, isOpen]);

  useEffect(() => {
    if (activeTicket) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTicket?.messages]);

  if (!isFacultyOrHod) return null;

  const fetchTickets = async () => {
    try {
      setLoadingTickets(true);
      const res = await fetch("/api/helpdesk/tickets");
      const json = await res.json();
      if (json.success) {
        setTickets(json.tickets || []);
      }
    } catch (err) {
      console.error("Failed to load tickets:", err);
    } finally {
      setLoadingTickets(false);
    }
  };

  const openTicketDetail = async (ticketId: string) => {
    try {
      setLoadingActiveTicket(true);
      const res = await fetch(`/api/helpdesk/tickets/${ticketId}`);
      const json = await res.json();
      if (json.success) {
        setActiveTicket(json.ticket);
      }
    } catch (err) {
      console.error("Failed to load ticket detail:", err);
    } finally {
      setLoadingActiveTicket(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newMessage.trim()) {
      setSubmitError("Please fill in both the title and query details.");
      return;
    }

    try {
      setSubmittingTicket(true);
      setSubmitError("");

      const res = await fetch("/api/helpdesk/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          category: newCategory,
          priority: newPriority,
          message: newMessage
        })
      });

      const json = await res.json();
      if (json.success) {
        setNewTitle("");
        setNewMessage("");
        setNewCategory("MID_EXAMS");
        setNewPriority("MEDIUM");
        await fetchTickets();
        // Open the newly created ticket directly
        if (json.ticket) {
          openTicketDetail(json.ticket.id);
        } else {
          setActiveTab("TICKETS");
        }
      } else {
        setSubmitError(json.error || "Failed to create ticket.");
      }
    } catch (err: any) {
      setSubmitError(err.message || "An error occurred.");
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !activeTicket) return;

    try {
      setSendingReply(true);
      const res = await fetch(`/api/helpdesk/tickets/${activeTicket.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyMessage })
      });

      const json = await res.json();
      if (json.success) {
        setReplyMessage("");
        // Refresh ticket details
        openTicketDetail(activeTicket.id);
        fetchTickets();
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSendingReply(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            <FaCheckCircle className="text-emerald-600 text-[10px]" /> Resolved
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
            <FaClock className="text-amber-600 text-[10px]" /> In Progress
          </span>
        );
      case "CLOSED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
            <FaExclamationCircle className="text-rose-600 text-[10px]" /> Open
          </span>
        );
    }
  };

  const openTicketsCount = tickets.filter(t => t.status === "OPEN" || t.status === "IN_PROGRESS").length;

  return (
    <>
      {/* Floating Trigger Button (Bottom-Right) */}
      <div className="fixed bottom-5 right-5 z-40">
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="group flex items-center gap-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3 text-white shadow-xl hover:shadow-2xl transition-all duration-200 border-2 border-white/80"
          aria-label="Open GVP Sahayak"
        >
          <div className="relative flex items-center justify-center">
            <FaHeadset className="text-lg text-white" />
            {openTicketsCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-extrabold text-slate-950 ring-2 ring-white">
                {openTicketsCount}
              </span>
            )}
          </div>
          <span className="font-bold text-sm tracking-wide">GVP Sahayak</span>
        </motion.button>
      </div>

      {/* Floating Chat Modal / Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-20 right-4 sm:right-6 z-50 w-[94vw] max-w-md sm:w-[410px] h-[610px] max-h-[82vh] rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 p-4 text-white flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-xs text-white">
                  <FaHeadset className="text-lg" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm tracking-tight text-white leading-tight">GVP Sahayak</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.2 text-[9px] font-bold text-emerald-200 border border-emerald-300/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-100 font-medium leading-tight">Faculty Helpdesk & Query Assistant</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition"
                title="Close"
              >
                <FaTimes size={15} />
              </button>
            </div>

            {/* If an active ticket is selected, display the Chat Thread */}
            {activeTicket ? (
              <div className="flex flex-col flex-1 overflow-hidden bg-slate-50/60">
                {/* Active Ticket Header */}
                <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-2xs">
                  <button
                    onClick={() => setActiveTicket(null)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition"
                  >
                    <FaArrowLeft className="text-[11px]" /> Back
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 font-mono">#{activeTicket.ticketNumber}</span>
                    {getStatusBadge(activeTicket.status)}
                  </div>
                </div>

                {/* Ticket Title Banner */}
                <div className="bg-indigo-50/40 border-b border-indigo-100/60 px-4 py-2 text-xs">
                  <p className="font-bold text-slate-900 leading-snug line-clamp-1">{activeTicket.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Category: <span className="font-semibold text-indigo-700">{activeTicket.category}</span></p>
                </div>

                {/* Resolution Banner if Resolved */}
                {activeTicket.status === "RESOLVED" && (
                  <div className="m-3 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-900 shadow-2xs">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-[11px] mb-1">
                      <FaCheckCircle className="text-emerald-600" /> Resolved by Administrator
                    </div>
                    {activeTicket.resolutionNotes ? (
                      <p className="text-[11px] text-emerald-800/90 font-medium leading-relaxed">{activeTicket.resolutionNotes}</p>
                    ) : (
                      <p className="text-[11px] text-emerald-700 italic">This query has been marked as resolved.</p>
                    )}
                  </div>
                )}

                {/* Message Bubbles Thread */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-200">
                  {loadingActiveTicket ? (
                    <div className="flex h-32 items-center justify-center text-xs text-slate-400">
                      <FaSync className="animate-spin mr-2" /> Loading conversation...
                    </div>
                  ) : activeTicket.messages && activeTicket.messages.length > 0 ? (
                    activeTicket.messages.map((msg, i) => {
                      const isMe = msg.senderRole === "FACULTY" || msg.senderRole === "HOD";
                      return (
                        <div
                          key={msg.id || i}
                          className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                        >
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1 px-1">
                            <span className="font-semibold text-slate-600">{msg.senderName}</span>
                            {!isMe && (
                              <span className="rounded bg-indigo-100 text-indigo-800 font-bold px-1 text-[9px]">Admin</span>
                            )}
                            <span>&bull;</span>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <div
                            className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-2xs ${
                              isMe
                                ? "bg-indigo-600 text-white rounded-tr-none"
                                : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.message}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center text-xs text-slate-400 italic py-6">No messages yet.</div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Reply Form */}
                <form onSubmit={handleSendReply} className="border-t border-slate-200 bg-white p-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your reply to Admin..."
                    disabled={sendingReply}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !replyMessage.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40 shadow-xs"
                    title="Send Reply"
                  >
                    <FaPaperPlane size={12} />
                  </button>
                </form>
              </div>
            ) : (
              // Main Tab Navigation & Views
              <>
                {/* Tab Navigation */}
                <div className="flex border-b border-slate-200 bg-slate-50/70 p-1.5 gap-1 text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab("FAQS")}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
                      activeTab === "FAQS"
                        ? "bg-white text-indigo-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <FaQuestionCircle className="text-xs" /> Assistant
                  </button>
                  <button
                    onClick={() => setActiveTab("TICKETS")}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
                      activeTab === "TICKETS"
                        ? "bg-white text-indigo-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <FaComments className="text-xs" /> My Queries
                    {tickets.length > 0 && (
                      <span className="rounded-full bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 font-bold">
                        {tickets.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab("NEW")}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
                      activeTab === "NEW"
                        ? "bg-indigo-600 text-white shadow-xs font-bold"
                        : "text-indigo-600 hover:bg-indigo-50"
                    }`}
                  >
                    <FaPlus className="text-[10px]" /> Raise Query
                  </button>
                </div>

                {/* Tab 1: Assistant & FAQs */}
                {activeTab === "FAQS" && (
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-200">
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
                      <p className="text-xs font-bold text-slate-900">
                        Namaste, {user?.name || user?.username || "Faculty"}!
                      </p>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        I am your GVP Sahayak assistant. Check quick guides below or raise a ticket directly to the Administrative office for instant resolution.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Common FAQs & Guides</h4>
                      <div className="space-y-2">
                        {FAQ_ITEMS.map((faq, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs transition hover:border-slate-300"
                          >
                            <button
                              onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                              className="w-full p-3 text-left flex items-start justify-between gap-2"
                            >
                              <div className="flex items-start gap-2">
                                <span className="rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 shrink-0 mt-0.5">
                                  {faq.category}
                                </span>
                                <span className="text-xs font-bold text-slate-800 leading-snug">{faq.q}</span>
                              </div>
                              <span className="text-slate-400 mt-1">
                                {expandedFaq === idx ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                              </span>
                            </button>
                            {expandedFaq === idx && (
                              <div className="border-t border-slate-100 bg-slate-50/50 p-3 text-[11px] text-slate-600 leading-relaxed">
                                {faq.a}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => setActiveTab("NEW")}
                        className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 p-3 text-white text-xs font-bold shadow-xs hover:from-indigo-700 hover:to-blue-700 transition flex items-center justify-center gap-2"
                      >
                        <FaPaperPlane size={11} /> Need Admin Help? Raise a Query →
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab 2: My Queries & Ticket History */}
                {activeTab === "TICKETS" && (
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-200">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-slate-700">My Queries ({tickets.length})</span>
                      <button
                        onClick={fetchTickets}
                        className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold"
                      >
                        <FaSync className={`text-[10px] ${loadingTickets ? "animate-spin" : ""}`} /> Refresh
                      </button>
                    </div>

                    {loadingTickets ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        <FaSync className="animate-spin inline mr-2 text-indigo-600" /> Loading your queries...
                      </div>
                    ) : tickets.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                        <FaComments className="mx-auto text-2xl text-slate-300 mb-2" />
                        <p className="text-xs font-bold text-slate-700">No queries raised yet</p>
                        <p className="text-[11px] text-slate-400 mt-1">Click below to submit your first academic or technical query.</p>
                        <button
                          onClick={() => setActiveTab("NEW")}
                          className="mt-4 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-2xs"
                        >
                          + New Query
                        </button>
                      </div>
                    ) : (
                      tickets.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => openTicketDetail(t.id)}
                          className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-slate-400 font-mono">#{t.ticketNumber}</span>
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                                  {t.category}
                                </span>
                              </div>
                              <h5 className="text-xs font-bold text-slate-900 mt-1 leading-snug line-clamp-1">
                                {t.title}
                              </h5>
                            </div>
                            {getStatusBadge(t.status)}
                          </div>

                          {t.resolutionNotes && t.status === "RESOLVED" && (
                            <p className="mt-2 text-[11px] text-emerald-800 bg-emerald-50 rounded-lg p-1.5 font-medium line-clamp-1 border border-emerald-100">
                              ✅ {t.resolutionNotes}
                            </p>
                          )}

                          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-1.5">
                            <span>{new Date(t.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                            <span className="font-semibold text-indigo-600 hover:underline">View Chat →</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab 3: Raise New Query */}
                {activeTab === "NEW" && (
                  <form onSubmit={handleCreateTicket} className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Raise a Support Query to Admin</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Admin will review and resolve with live chat updates.</p>
                    </div>

                    {submitError && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                        {submitError}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Category</label>
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                        >
                          <option value="MID_EXAMS">Mid Exams Marks</option>
                          <option value="ATTENDANCE">Attendance</option>
                          <option value="ELECTIVES">Open / Electives</option>
                          <option value="TIMETABLE">Timetable</option>
                          <option value="STUDENT_DATA">Student Data</option>
                          <option value="LEAVES">Leaves / Permissions</option>
                          <option value="GENERAL">General / System</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Priority</label>
                        <select
                          value={newPriority}
                          onChange={(e) => setNewPriority(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                        >
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                          <option value="URGENT">Urgent</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Subject / Summary</label>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Please unlock draft marks for CSE-B BEE"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Details / Explanation</label>
                      <textarea
                        rows={4}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Describe the issue clearly (include Subject, Section, Roll Numbers if relevant)..."
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 resize-none"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingTicket}
                      className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
                    >
                      {submittingTicket ? <FaSync className="animate-spin" /> : <FaPaperPlane size={11} />}
                      {submittingTicket ? "Submitting..." : "Submit to Administrator"}
                    </button>
                  </form>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
