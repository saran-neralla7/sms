
"use client";

import { useRouter } from "next/navigation";
import { FaCalendarAlt } from "react-icons/fa";

interface AcademicYear {
    id: string;
    name: string;
    isCurrent: boolean;
}

interface Props {
    years: AcademicYear[];
    currentYearId?: string;
}

export default function AcademicYearSelector({ years, currentYearId }: Props) {
    const router = useRouter();

    // Determine the active value: from prop (cookie/server) or fallback to isCurrent
    const activeYearId = currentYearId || years.find(y => y.isCurrent)?.id || years[0]?.id || "";

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newYearId = e.target.value;
        // set cookie
        document.cookie = `academic-year-id=${newYearId}; path=/; max-age=31536000`; // 1 year
        router.refresh(); // Refresh server components to pick up new cookie
    };

    if (years.length === 0) return null;

    return (
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 border border-slate-200">
            <FaCalendarAlt className="text-slate-500 text-sm" />
            <select
                value={activeYearId}
                onChange={handleChange}
                className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer min-w-[100px]"
                aria-label="Select Academic Year"
            >
                {years.map((year) => (
                    <option key={year.id} value={year.id}>
                        {year.name}
                    </option>
                ))}
            </select>
        </div>
    );
}
