"use client";

import { useEffect, useState } from "react";
import { FaPlus, FaTrash, FaEdit } from "react-icons/fa";
import ConfirmationModal from "@/components/ConfirmationModal";
import Modal from "@/components/Modal";

export default function PeriodsPage() {
    const [periods, setPeriods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [order, setOrder] = useState("");
    const [selectedPeriod, setSelectedPeriod] = useState<any>(null);

    useEffect(() => {
        fetchPeriods();
    }, []);

    const fetchPeriods = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/periods");
            if (res.ok) {
                const data = await res.json();
                setPeriods(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const formatTimeForDisplay = (time24: string) => {
        if (!time24) return "";
        const [hours, minutes] = time24.split(":");
        let h = parseInt(hours);
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12;
        if (h === 0) h = 12;
        return `${h.toString().padStart(2, "0")}:${minutes} ${ampm}`;
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const formattedStart = formatTimeForDisplay(startTime);
            const formattedEnd = formatTimeForDisplay(endTime);

            const res = await fetch("/api/periods", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    startTime: formattedStart,
                    endTime: formattedEnd,
                    order
                })
            });
            if (res.ok) {
                fetchPeriods();
                setIsAddModalOpen(false);
                resetForm();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to create period");
            }
        } catch (error) {
            alert("Error creating period. Please check console.");
            console.error(error);
        }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPeriod) return;
        try {
            const formattedStart = startTime.includes("M") ? startTime : formatTimeForDisplay(startTime);
            const formattedEnd = endTime.includes("M") ? endTime : formatTimeForDisplay(endTime);

            const res = await fetch(`/api/periods/${selectedPeriod.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    startTime: formattedStart,
                    endTime: formattedEnd,
                    order
                })
            });
            if (res.ok) {
                fetchPeriods();
                setIsEditModalOpen(false);
                resetForm();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to update period");
            }
        } catch (error) {
            alert("Error updating period. Please check console.");
            console.error(error);
        }
    };

    const handleDelete = async () => {
        if (!selectedPeriod) return;
        try {
            const res = await fetch(`/api/periods/${selectedPeriod.id}`, { method: "DELETE" });
            if (res.ok) {
                fetchPeriods();
                setIsDeleteModalOpen(false);
                setSelectedPeriod(null);
            } else {
                alert("Failed to delete period");
            }
        } catch (error) {
            alert("Error deleting period");
        }
    };

    // Helper to convert "08:30 AM" back to "08:30" (24h) for the input value
    const convertTo24Hour = (time12: string) => {
        if (!time12) return "";
        if (!time12.includes("M")) return time12; // Already 24h or invalid
        const [time, modifier] = time12.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') {
            hours = '00';
        }
        if (modifier === 'PM') {
            hours = (parseInt(hours, 10) + 12).toString();
        }
        return `${hours.padStart(2, '0')}:${minutes}`;
    };

    const openEditModal = (period: any) => {
        setSelectedPeriod(period);
        setName(period.name);
        setStartTime(convertTo24Hour(period.startTime)); // Convert for input
        setEndTime(convertTo24Hour(period.endTime));     // Convert for input
        setOrder(period.order);
        setIsEditModalOpen(true);
    };



    const resetForm = () => {
        setName("");
        setStartTime("");
        setEndTime("");
        setOrder("");
        setSelectedPeriod(null);
    };



    return (
        <div className="mx-auto max-w-5xl p-6">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Manage Periods</h1>
                    <p className="text-slate-500">Define college timings and periods</p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsAddModalOpen(true); }}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg"
                >
                    <FaPlus /> Add Period
                </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Order</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Period Name</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Time</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
                        ) : periods.length === 0 ? (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No periods found. Add one to get started.</td></tr>
                        ) : (
                            periods.map((period) => (
                                <tr key={period.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{period.order}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{period.name}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500">{period.startTime} - {period.endTime}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => openEditModal(period)} className="rounded p-2 text-blue-600 hover:bg-blue-50 transition-colors">
                                                <FaEdit />
                                            </button>
                                            <button onClick={() => { setSelectedPeriod(period); setIsDeleteModalOpen(true); }} className="rounded p-2 text-red-600 hover:bg-red-50 transition-colors">
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal Content */}
            {(isAddModalOpen || isEditModalOpen) && (
                <Modal isOpen={true} onClose={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} title={isAddModalOpen ? "Add Period" : "Edit Period"}>
                    <form onSubmit={isAddModalOpen ? handleAdd : handleEdit} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Period Name</label>
                            <input
                                type="text"
                                placeholder="e.g. 1st Hour"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">Start Time</label>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">End Time</label>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Order</label>
                            <input
                                type="number"
                                placeholder="e.g. 1"
                                value={order}
                                onChange={(e) => setOrder(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                required
                            />
                            <p className="mt-1 text-xs text-slate-500">Used for sorting the dropdown list.</p>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Save Period</button>
                        </div>
                    </form>
                </Modal>
            )}

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Period"
                message={`Are you sure you want to delete "${selectedPeriod?.name}"?`}
            />
        </div>
    );
}
