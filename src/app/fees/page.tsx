"use client";

import { FaArrowLeft, FaRupeeSign } from "react-icons/fa";
import { useRouter } from "next/navigation";

export default function FeesPage() {
    const router = useRouter();

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
            <div className="text-center">
                <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <FaRupeeSign size={48} />
                </div>
                <h1 className="mb-2 text-3xl font-bold text-slate-900">Fee Management</h1>
                <p className="mb-8 text-lg text-slate-500">This module is currently under development.</p>

                <button
                    onClick={() => router.back()}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 hover:text-green-600"
                >
                    <FaArrowLeft /> Go Back
                </button>
            </div>
        </div>
    );
}
