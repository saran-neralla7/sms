"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LogoSpinner from "@/components/LogoSpinner";
import { FaBirthdayCake, FaArrowLeft, FaSearch, FaUserGraduate, FaChalkboardTeacher } from "react-icons/fa";
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

export default function BirthdayDirectoryPage() {
  const router = useRouter();
  
  // State variables
  const [viewType, setViewType] = useState<"upcoming" | "month">("upcoming");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [activeTab, setActiveTab] = useState<"faculty" | "student">("faculty");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [birthdaysList, setBirthdaysList] = useState<any[]>([]);
  const [upcomingList, setUpcomingList] = useState<any[]>([]);
  const [thisMonthList, setThisMonthList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch birthdays
  useEffect(() => {
    const fetchBirthdays = async () => {
      setLoading(true);
      try {
        if (viewType === "upcoming") {
          const res = await fetch("/api/admin/birthdays");
          if (res.ok) {
            const data = await res.json();
            setUpcomingList(data.upcoming || []);
            setThisMonthList(data.thisMonth || []);
          }
        } else {
          const res = await fetch(`/api/admin/birthdays?month=${selectedMonth}`);
          if (res.ok) {
            const data = await res.json();
            setBirthdaysList(data.birthdays || []);
          }
        }
      } catch (err) {
        console.error("Failed to load birthdays:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBirthdays();
  }, [viewType, selectedMonth]);

  // Determine current list to filter
  const currentRawList = viewType === "upcoming" ? upcomingList : birthdaysList;

  // Filter list by tab and search query
  const filteredList = currentRawList.filter((item) => {
    const matchesTab = item.type === activeTab;
    const matchesSearch =
      searchQuery.trim() === "" ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.deptCode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
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
              <FaBirthdayCake className="text-pink-500" /> Birthday Directory
            </h1>
            <p className="text-sm text-slate-500">
              Browse and search student and faculty birthdays.
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
                        ? "bg-indigo-50 text-indigo-700 shadow-sm"
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
          // Info banner for Upcoming Birthdays view
          <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm self-start">
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              🎂 Today's Birthdays
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Birthdays occurring today are highlighted in gold and displayed first.
            </p>
            <div className="border-t border-slate-100 pt-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">This Month</span>
              <p className="text-2xl font-extrabold text-indigo-600 mt-1">
                {thisMonthList.length}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Total birthdays in current month</p>
            </div>
          </div>
        )}

        {/* Right Column: Search filter, tabs, and Directory Grid */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Filtering Header Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            {/* Student/Faculty tabs */}
            <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 w-full md:w-auto">
              <button
                onClick={() => setActiveTab("faculty")}
                className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === "faculty"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <FaChalkboardTeacher /> Faculty
              </button>
              <button
                onClick={() => setActiveTab("student")}
                className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === "student"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <FaUserGraduate /> Students
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder={`Search by name, department, or ${activeTab === 'faculty' ? 'designation' : 'roll number'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
              />
              <FaSearch className="absolute left-3 top-2.5 h-3 w-3 text-slate-400" />
            </div>
          </div>

          {/* Directory Grid */}
          <div className="w-full">
            {loading ? (
              <div className="py-24 text-center">
                <LogoSpinner />
                <p className="text-xs text-slate-500 mt-2">Loading directory...</p>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-slate-200 rounded-xl bg-white">
                <p className="text-sm font-medium text-slate-400">
                  No {activeTab} birthdays found matching the filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredList.map((b) => {
                  const isToday =
                    b.daysUntil === 0 ||
                    b.daysUntil === 365 ||
                    (b.birthMonth === new Date().getMonth() + 1 &&
                      b.birthDay === new Date().getDate());

                  const fallbackAvatar =
                    b.type === "faculty"
                      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          b.name
                        )}&background=f1f5f9&color=6366f1`
                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          b.name
                        )}&background=f1f5f9&color=0284c7`;

                  const photoSrc = b.photoUrl ? b.photoUrl : fallbackAvatar;

                  return (
                    <motion.div
                      key={b.id}
                      whileHover={{ y: -4, scale: 1.02 }}
                      className={`relative flex flex-col items-center justify-between rounded-xl border p-5 bg-white shadow-sm select-none transition-all ${
                        isToday
                          ? "border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/10"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {isToday && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm z-10 animate-bounce">
                          Today 🎂
                        </div>
                      )}

                      <div className="relative flex h-16 w-16 items-center justify-center rounded-full overflow-hidden border border-slate-100 bg-slate-50 mb-3 shrink-0">
                        <img
                          src={photoSrc}
                          alt={b.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = fallbackAvatar;
                          }}
                        />
                      </div>

                      <div className="text-center w-full">
                        <p className="font-bold text-sm text-slate-800 line-clamp-1" title={b.name}>
                          {b.name}
                        </p>
                        <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1" title={b.designation}>
                          {b.designation}
                        </p>
                        <p className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full inline-block mt-1">
                          {b.deptCode}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 w-full text-center">
                        <span className="text-xs font-bold text-slate-700">
                          {new Date(b.dob).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {isToday
                            ? "Happy Birthday!"
                            : b.daysUntil === 1
                            ? "Tomorrow"
                            : `In ${b.daysUntil} days`}
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
