"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LogoSpinner from "@/components/LogoSpinner";
import { FaAward, FaArrowLeft, FaSearch, FaChalkboardTeacher } from "react-icons/fa";
import { motion } from "framer-motion";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export default function WorkAnniversaryDirectoryPage() {
  const router = useRouter();

  // State variables
  const [viewType, setViewType] = useState<"upcoming" | "month">("upcoming");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [searchQuery, setSearchQuery] = useState("");

  const [anniversariesList, setAnniversariesList] = useState<any[]>([]);
  const [upcomingList, setUpcomingList] = useState<any[]>([]);
  const [thisMonthList, setThisMonthList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch anniversaries
  useEffect(() => {
    const fetchAnniversaries = async () => {
      setLoading(true);
      try {
        if (viewType === "upcoming") {
          const res = await fetch("/api/admin/work-anniversaries");
          if (res.ok) {
            const data = await res.json();
            setUpcomingList(data.upcoming || []);
            setThisMonthList(data.thisMonth || []);
          }
        } else {
          const res = await fetch(`/api/admin/work-anniversaries?month=${selectedMonth}`);
          if (res.ok) {
            const data = await res.json();
            setAnniversariesList(data.anniversaries || []);
          }
        }
      } catch (err) {
        console.error("Failed to load work anniversaries:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnniversaries();
  }, [viewType, selectedMonth]);

  // Determine current list to filter
  const currentRawList = viewType === "upcoming" ? upcomingList : anniversariesList;

  // Filter list by search query
  const filteredList = currentRawList.filter((item) => {
    return (
      searchQuery.trim() === "" ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.deptCode.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="mx-auto max-w-7xl pb-12">
      {/* Back Button & Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin")}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <FaArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <FaAward className="text-purple-600" /> Work Anniversary Directory
            </h1>
            <p className="text-sm text-slate-500">
              Celebrate faculty service milestones and joining anniversaries.
            </p>
          </div>
        </div>

        {/* View Switcher Controls */}
        <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 self-start sm:self-auto">
          <button
            onClick={() => setViewType("upcoming")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              viewType === "upcoming"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setViewType("month")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              viewType === "month"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            By Month
          </button>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: Month selector if "By Month" is active */}
        {viewType === "month" ? (
          <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm self-start">
            <h3 className="text-sm font-bold text-slate-800 mb-3 px-1">Select Month</h3>
            <div className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1 pb-2 lg:pb-0">
              {MONTHS.map((m) => {
                const isActive = selectedMonth === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => setSelectedMonth(m.value)}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap lg:whitespace-normal shrink-0 lg:shrink ${
                      isActive
                        ? "bg-purple-50 text-purple-700 shadow-sm font-bold"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Info banner for Upcoming Work Anniversaries view */
          <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm self-start">
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              🏆 Today's Anniversaries
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Work anniversaries occurring today are highlighted in purple and displayed first.
            </p>
            <div className="border-t border-slate-100 pt-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">This Month</span>
              <p className="text-2xl font-extrabold text-purple-600 mt-1">
                {thisMonthList.length}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Faculty anniversaries in current month</p>
            </div>
          </div>
        )}

        {/* Right Column: Search filter & Directory Grid */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Filtering Header Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <FaChalkboardTeacher className="text-purple-600 h-4 w-4" />
              <span>Faculty Work Anniversary Directory</span>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="Search by name, department, or designation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-1.5 text-xs focus:border-purple-500 focus:outline-none"
              />
              <FaSearch className="absolute left-3 top-2.5 h-3 w-3 text-slate-400" />
            </div>
          </div>

          {/* Directory Grid */}
          <div className="w-full">
            {loading ? (
              <div className="py-24 text-center">
                <LogoSpinner />
                <p className="text-xs text-slate-500 mt-2">Loading work anniversaries...</p>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-slate-200 rounded-xl bg-white">
                <p className="text-sm font-medium text-slate-400">
                  No faculty work anniversaries found matching the filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredList.map((a) => {
                  const isToday =
                    a.daysUntil === 0 ||
                    a.daysUntil === 365 ||
                    (a.joinMonth === new Date().getMonth() + 1 &&
                      a.joinDay === new Date().getDate());

                  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    a.name
                  )}&background=f3e8ff&color=7e22ce`;

                  const photoSrc = a.photoUrl ? a.photoUrl : fallbackAvatar;
                  const yearText = a.completedYears === 1 ? "1 Year" : `${a.completedYears} Years`;

                  return (
                    <motion.div
                      key={a.id}
                      whileHover={{ y: -4, scale: 1.02 }}
                      className={`relative flex flex-col items-center justify-between rounded-xl border p-5 bg-white shadow-sm select-none transition-all ${
                        isToday
                          ? "border-purple-400 ring-2 ring-purple-400/20 bg-purple-50/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {isToday && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm z-10 animate-bounce">
                          Today 🎖️
                        </div>
                      )}

                      <div className="relative flex h-16 w-16 items-center justify-center rounded-full overflow-hidden border border-slate-100 bg-slate-50 mb-3 shrink-0">
                        <img
                          src={photoSrc}
                          alt={a.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = fallbackAvatar;
                          }}
                        />
                      </div>

                      <div className="text-center w-full">
                        <p className="font-bold text-sm text-slate-800 line-clamp-1" title={a.name}>
                          {a.name}
                        </p>
                        <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1" title={a.designation}>
                          {a.designation}
                        </p>
                        <div className="flex items-center justify-center gap-1.5 mt-1.5">
                          <p className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                            {a.deptCode}
                          </p>
                          <p className="text-[10px] font-bold text-amber-800 bg-amber-100/70 border border-amber-300 px-2 py-0.5 rounded-full">
                            🌟 {yearText}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 w-full text-center">
                        <span className="text-xs font-bold text-slate-700">
                          Joined: {new Date(a.joinDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {isToday
                            ? "Happy Work Anniversary!"
                            : a.daysUntil === 1
                            ? "Tomorrow"
                            : `In ${a.daysUntil} days`}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
