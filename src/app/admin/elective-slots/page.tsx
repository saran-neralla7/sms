"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { FaTrash, FaPlus } from "react-icons/fa";

export default function ElectiveSlotsPage() {
    const { data: session } = useSession();
    const [slots, setSlots] = useState<any[]>([]);
    const [newSlotName, setNewSlotName] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchSlots();
    }, []);

    const fetchSlots = async () => {
        try {
            const res = await fetch("/api/elective-slots");
            if (res.ok) setSlots(await res.json());
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/elective-slots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newSlotName })
            });

            if (res.ok) {
                setNewSlotName("");
                fetchSlots();
            } else {
                alert("Failed to create slot");
            }
        } catch (error) {
            alert("Error creating slot");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete slot "${name}"?`)) return;
        try {
            const res = await fetch(`/api/elective-slots/${id}`, { method: "DELETE" });
            if (res.ok) {
                fetchSlots();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to delete");
            }
        } catch (error) {
            alert("Error deleting slot");
        }
    };

    if (!session || (session.user as any).role !== "ADMIN") {
        return <div className="p-8 text-center text-red-500">Unauthorized</div>;
    }

    return (
        <div className="mx-auto max-w-4xl p-6">
            <h1 className="mb-6 text-2xl font-bold text-slate-900">Manage Elective Slots</h1>

            {/* Create Form */}
            <form onSubmit={handleCreate} className="mb-8 flex gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <input
                    type="text"
                    placeholder="Slot Name (e.g., PE-1, OE-1)"
                    value={newSlotName}
                    onChange={(e) => setNewSlotName(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-blue-500"
                    required
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                    <FaPlus /> Add Slot
                </button>
            </form>

            {/* List */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700 font-semibold uppercase">
                        <tr>
                            <th className="px-6 py-3">Name</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {slots.length === 0 ? (
                            <tr>
                                <td colSpan={2} className="px-6 py-8 text-center text-slate-500">No slots found. Add one above.</td>
                            </tr>
                        ) : (
                            slots.map((slot) => (
                                <tr key={slot.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-mono font-bold text-slate-800">{slot.name}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(slot.id, slot.name)}
                                            className="rounded p-2 text-red-500 hover:bg-red-50"
                                            title="Delete"
                                        >
                                            <FaTrash />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
