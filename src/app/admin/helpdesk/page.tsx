"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FaHeadset,
  FaArrowLeft,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle,
  FaPaperPlane,
  FaSync,
  FaSearch,
  FaFilter,
  FaUserTie,
  FaBuilding,
  FaEnvelope,
  FaPhone,
  FaCheck,
  FaTimes,
  FaCommentDots
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

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
  user: {
    id: string;
    username: string;
    role: string;
    faculty?: {
      id: string;
      empCode: string;
      empName: string;
      designation: string;
      mobile: string;
      email?: string;
      department?: {
        id: string;
        name: string;
        code: string;
      };
    };
  };
  resolvedBy?: {
    id: string;
    username: string;
  };
  messages: Message[];
  _count?: {
    messages: number;
  };
}

export default function AdminHelpdeskPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedDept, setSelectedDept] = useState("ALL");

  // Active Selected Ticket
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [loadingActiveTicket, setLoadingActiveTicket] = useState(false);

  // Admin reply & resolve
  const [adminReply, setAdminReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [resolvingModal, setResolvingModal] = useState(false);
  const [resolutionRemarks, setResolutionRemarks] = useState("");
  const [submittingResolution, setSubmittingResolution] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const user = session?.user as any;
  const isAdmin = user?.role === "ADMIN" || user?.role === "DIRECTOR" || user?.role === "PRINCIPAL";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && !isAdmin) {
      router.push("/dashboard");
    }
  }, [status, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      fetchDepartments();
      fetchTickets();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (selectedTicketId) {
      fetchTicketDetails(selectedTicketId);
    }
  }, [selectedTicketId]);

  useEffect(() => {
    if (activeTicket) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTicket?.messages]);

  const fetchDepartments = async () => {
    try {
      const res = await fetch("/api/departments");
      const json = await res.json();
      if (Array.isArray(json)) {
        setDepartments(json);
      }
    } catch (err) {
      console.error("Failed to load departments:", err);
    }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/helpdesk/tickets");
      const json = await res.json();
      if (json.success) {
        setTickets(json.tickets || []);
        // Automatically select first ticket if none selected
        if (!selectedTicketId && json.tickets && json.tickets.length > 0) {
          setSelectedTicketId(json.tickets[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetails = async (id: string) => {
    try {
      setLoadingActiveTicket(true);
      const res = await fetch(`/api/helpdesk/tickets/${id}`);
      const json = await res.json();
      if (json.success) {
        setActiveTicket(json.ticket);
      }
    } catch (err) {
      console.error("Failed to load ticket details:", err);
    } finally {
      setLoadingActiveTicket(false);
    }
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminReply.trim() || !selectedTicketId) return;

    try {
      setSendingReply(true);
      const res = await fetch(`/api/helpdesk/tickets/${selectedTicketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: adminReply.trim() })
      });
      const json = await res.json();
      if (json.success) {
        setAdminReply("");
        fetchTicketDetails(selectedTicketId);
        fetchTickets();
      }
    } catch (err) {
      console.error("Failed to send admin reply:", err);
    } finally {
      setSendingReply(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string, notes?: string) => {
    if (!selectedTicketId) return;

    try {
      if (newStatus === "RESOLVED") {
        setSubmittingResolution(true);
      }

      const res = await fetch(`/api/helpdesk/tickets/${selectedTicketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          resolutionNotes: notes || ""
        })
      });

      const json = await res.json();
      if (json.success) {
        setResolvingModal(false);
        setResolutionRemarks("");
        fetchTicketDetails(selectedTicketId);
        fetchTickets();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setSubmittingResolution(false);
    }
  };

  if (status === "loading" || loading && tickets.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LogoSpinner fullScreen={false} />
      </div>
    );
  }

  // Filtered tickets
  const filteredTickets = tickets.filter(t => {
    if (selectedStatus !== "ALL" && t.status !== selectedStatus) return false;
    if (selectedCategory !== "ALL" && t.category !== selectedCategory) return false;
    if (selectedDept !== "ALL") {
      const deptId = t.user?.faculty?.department?.id || t.user?.faculty?.department?.code;
      if (deptId !== selectedDept) return false;
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const numMatch = t.ticketNumber.toString().includes(q);
      const titleMatch = t.title.toLowerCase().includes(q);
      const facultyMatch = (t.user?.faculty?.empName || t.user?.username || "").toLowerCase().includes(q);
      return numMatch || titleMatch || facultyMatch;
    }
    return true;
  });

  const totalOpen = tickets.filter(t => t.status === "OPEN").length;
  const totalInProgress = tickets.filter(t => t.status === "IN_PROGRESS").length;
  const totalResolved = tickets.filter(t => t.status === "RESOLVED").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
            <FaCheckCircle className="text-emerald-600 text-xs" /> Resolved
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
            <FaClock className="text-amber-600 text-xs" /> In Progress
          </span>
        );
      case "CLOSED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
            <FaExclamationCircle className="text-rose-600 text-xs" /> Open
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[9px] font-black text-rose-800 uppercase tracking-wider">Urgent</span>;
      case "HIGH":
        return <span className="rounded bg-orange-100 px-1.5 py-0.2 text-[9px] font-black text-orange-800 uppercase tracking-wider">High</span>;
      case "LOW":
        return <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-black text-slate-600 uppercase tracking-wider">Low</span>;
      default:
        return <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[9px] font-black text-blue-800 uppercase tracking-wider">Medium</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16">
      {/* Header Bar */}
      <header className="border-b border-slate-200 bg-white shadow-2xs">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
                title="Back to Admin Dashboard"
              >
                <FaArrowLeft size={14} />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                    GVP Sahayak &bull; Helpdesk Console
                  </h1>
                  <span className="rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                    Admin Desk
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Resolve faculty queries, unlock draft marks, handle elective/timetable requests with live two-way chat.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchTickets}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
              >
                <FaSync className={loading ? "animate-spin text-indigo-600" : ""} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Queries</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <FaHeadset />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{tickets.length}</p>
          </div>

          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/30 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Open (Unattended)</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-600 font-bold">
                <FaExclamationCircle />
              </div>
            </div>
            <p className="text-2xl font-black text-rose-800 mt-2">{totalOpen}</p>
          </div>

          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/30 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">In Progress</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600 font-bold">
                <FaClock />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-800 mt-2">{totalInProgress}</p>
          </div>

          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Resolved</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 font-bold">
                <FaCheckCircle />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-800 mt-2">{totalResolved}</p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs mb-6">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
            {/* Search */}
            <div className="relative">
              <FaSearch className="absolute left-3.5 top-3 text-slate-400 text-xs" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket #, title, faculty..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
              >
                <option value="ALL">All Statuses ({tickets.length})</option>
                <option value="OPEN">Open Only ({totalOpen})</option>
                <option value="IN_PROGRESS">In Progress ({totalInProgress})</option>
                <option value="RESOLVED">Resolved ({totalResolved})</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
              >
                <option value="ALL">All Categories</option>
                <option value="MID_EXAMS">Mid Exams Marks</option>
                <option value="ATTENDANCE">Attendance</option>
                <option value="ELECTIVES">Open / Electives</option>
                <option value="TIMETABLE">Timetable</option>
                <option value="STUDENT_DATA">Student Data</option>
                <option value="LEAVES">Leaves / Permissions</option>
                <option value="GENERAL">General / System</option>
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Two-Column Interactive Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Tickets List (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden flex flex-col h-[700px]">
            <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Queries Feed ({filteredTickets.length})
              </span>
              <span className="text-[11px] font-semibold text-slate-500">Sorted by priority & recency</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200">
              {filteredTickets.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  <FaCommentDots className="mx-auto text-3xl text-slate-300 mb-2" />
                  No queries matching selected filters.
                </div>
              ) : (
                filteredTickets.map((t) => {
                  const isSelected = t.id === selectedTicketId;
                  const facName = t.user?.faculty?.empName || t.user?.username || "Faculty";
                  const deptCode = t.user?.faculty?.department?.code || "";

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className={`rounded-xl p-3.5 transition cursor-pointer border ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-50/30 shadow-xs"
                          : "border-transparent hover:border-slate-200 hover:bg-slate-50/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono font-bold text-slate-400">#{t.ticketNumber}</span>
                          <span className="rounded bg-slate-100 text-slate-700 px-1.5 py-0.2 text-[9px] font-bold">
                            {t.category}
                          </span>
                          {getPriorityBadge(t.priority)}
                        </div>
                        {getStatusBadge(t.status)}
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 mt-1.5 leading-snug line-clamp-2">
                        {t.title}
                      </h4>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-700 truncate">
                          <FaUserTie className="text-slate-400 text-[10px] shrink-0" />
                          <span className="truncate">{facName}</span>
                          {deptCode && (
                            <span className="rounded bg-slate-200/70 text-slate-600 px-1 text-[9px] font-bold">
                              {deptCode}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(t.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: Conversation Thread & Resolution Pane (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden flex flex-col h-[700px]">
            {loadingActiveTicket ? (
              <div className="flex flex-1 items-center justify-center">
                <LogoSpinner fullScreen={false} />
              </div>
            ) : !activeTicket ? (
              <div className="flex flex-1 flex-col items-center justify-center text-slate-400 p-8 text-center">
                <FaHeadset className="text-4xl text-slate-200 mb-3" />
                <h3 className="text-sm font-bold text-slate-700">Select a Query</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Choose a ticket from the left list to review the query details, chat directly with the faculty, and resolve the issue.
                </p>
              </div>
            ) : (
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Active Ticket Header & Faculty Profile */}
                <div className="border-b border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-400">#{activeTicket.ticketNumber}</span>
                        <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
                          {activeTicket.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          Category: {activeTicket.category}
                        </span>
                        {getPriorityBadge(activeTicket.priority)}
                        {getStatusBadge(activeTicket.status)}
                      </div>
                    </div>

                    {/* Admin Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {activeTicket.status !== "RESOLVED" ? (
                        <>
                          {activeTicket.status === "OPEN" && (
                            <button
                              onClick={() => handleUpdateStatus("IN_PROGRESS")}
                              className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition shadow-2xs"
                            >
                              Mark In Progress
                            </button>
                          )}
                          <button
                            onClick={() => setResolvingModal(true)}
                            className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-2xs flex items-center gap-1.5"
                          >
                            <FaCheckCircle size={11} /> Resolve Query
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus("IN_PROGRESS")}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-2xs"
                        >
                          Reopen Query
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Faculty Details Card */}
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-2.5 text-xs flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-bold">
                        <FaUserTie size={12} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 leading-tight">
                          {activeTicket.user?.faculty?.empName || activeTicket.user?.username}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {activeTicket.user?.faculty?.designation || "Faculty"} &bull; {activeTicket.user?.faculty?.department?.name || "General"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-600">
                      {activeTicket.user?.faculty?.mobile && (
                        <a
                          href={`tel:${activeTicket.user.faculty.mobile}`}
                          className="flex items-center gap-1 text-slate-600 hover:text-indigo-600"
                        >
                          <FaPhone size={10} className="text-slate-400" />
                          <span>{activeTicket.user.faculty.mobile}</span>
                        </a>
                      )}
                      {activeTicket.user?.faculty?.email && (
                        <a
                          href={`mailto:${activeTicket.user.faculty.email}`}
                          className="flex items-center gap-1 text-slate-600 hover:text-indigo-600"
                        >
                          <FaEnvelope size={10} className="text-slate-400" />
                          <span>{activeTicket.user.faculty.email}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Resolution Banner if Resolved */}
                {activeTicket.status === "RESOLVED" && (
                  <div className="mx-4 mt-3 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-900 shadow-2xs">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-xs mb-1">
                      <FaCheckCircle className="text-emerald-600" /> Marked as Resolved by {activeTicket.resolvedBy?.username || "Administrator"}
                    </div>
                    {activeTicket.resolutionNotes ? (
                      <p className="text-[11px] text-emerald-900/90 leading-relaxed font-medium">
                        {activeTicket.resolutionNotes}
                      </p>
                    ) : (
                      <p className="text-[11px] text-emerald-700 italic">No custom remarks entered.</p>
                    )}
                  </div>
                )}

                {/* Conversation Thread */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-200">
                  {activeTicket.messages.map((msg, i) => {
                    const isAdminMsg = msg.senderRole === "ADMIN" || msg.senderRole === "DIRECTOR";
                    return (
                      <div
                        key={msg.id || i}
                        className={`flex flex-col ${isAdminMsg ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                          <span className="font-semibold text-slate-700">{msg.senderName}</span>
                          <span
                            className={`rounded px-1 text-[9px] font-bold ${
                              isAdminMsg ? "bg-indigo-100 text-indigo-800" : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {msg.senderRole}
                          </span>
                          <span>&bull;</span>
                          <span>
                            {new Date(msg.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-2xs ${
                            isAdminMsg
                              ? "bg-indigo-600 text-white rounded-tr-none"
                              : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Admin Reply Input */}
                <form onSubmit={handleSendAdminReply} className="border-t border-slate-200 bg-white p-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={adminReply}
                    onChange={(e) => setAdminReply(e.target.value)}
                    placeholder="Type an admin reply to the faculty..."
                    disabled={sendingReply}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !adminReply.trim()}
                    className="flex h-10 px-4 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold transition hover:bg-indigo-700 disabled:opacity-40 shadow-xs"
                  >
                    {sendingReply ? <FaSync className="animate-spin" /> : <FaPaperPlane size={11} />}
                    <span>Reply</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Resolution Modal Popup */}
      {resolvingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold">
                  <FaCheckCircle />
                </div>
                <h3 className="text-base font-bold text-slate-900">Resolve Query</h3>
              </div>
              <button
                onClick={() => setResolvingModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 transition"
              >
                <FaTimes size={14} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-600">
                You are marking ticket <span className="font-bold text-slate-900">#{activeTicket?.ticketNumber}</span> as resolved. Provide remarks so the faculty knows what action was taken.
              </p>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Resolution Remarks / Instructions to Faculty
                </label>
                <textarea
                  rows={3}
                  value={resolutionRemarks}
                  onChange={(e) => setResolutionRemarks(e.target.value)}
                  placeholder="e.g. Unlocked Mid-1 draft marks for CSE-B BEE subject. Please update and click Submit Draft."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500 focus:bg-white resize-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingModal(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingResolution}
                  onClick={() => handleUpdateStatus("RESOLVED", resolutionRemarks)}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-xs flex items-center gap-1.5"
                >
                  {submittingResolution ? <FaSync className="animate-spin" /> : <FaCheck size={11} />}
                  <span>Confirm Resolution</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
