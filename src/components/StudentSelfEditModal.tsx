"use client";

import { useState, useRef } from "react";
import Modal from "./Modal";
import { FaCamera, FaLock, FaSave, FaUser, FaCheck, FaExclamationCircle } from "react-icons/fa";
import Image from "next/image";

interface StudentSelfEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: any;
    onSuccess: () => void;
}

export default function StudentSelfEditModal({
    isOpen,
    onClose,
    student,
    onSuccess
}: StudentSelfEditModalProps) {
    const editPermissions = student?.editPermissions || { allowProfileEdit: false, allowPhotoEdit: false };
    const allowProfile = !!editPermissions.allowProfileEdit;
    const allowPhoto = !!editPermissions.allowPhotoEdit;

    // Form state for editable profile fields
    const [formData, setFormData] = useState({
        studentContactNumber: student?.studentContactNumber || "",
        emailId: student?.emailId || "",
        fatherName: student?.fatherName || "",
        motherName: student?.motherName || "",
        dateOfBirth: student?.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split("T")[0] : "",
        gender: student?.gender || "",
        caste: student?.caste || "",
        casteName: student?.casteName || "",
        aadharNumber: student?.aadharNumber || "",
        abcId: student?.abcId || "",
        address: student?.address || ""
    });

    const [photoPreview, setPhotoPreview] = useState<string | null>(student?.photoUrl || null);
    const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);

    const [savingDetails, setSavingDetails] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | null; text: string }>({
        type: null,
        text: ""
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            setStatusMessage({ type: "error", text: "Photo file size exceeds 2MB limit." });
            return;
        }

        setSelectedPhotoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPhotoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        setStatusMessage({ type: null, text: "" });
    };

    const handleUploadPhoto = async () => {
        if (!selectedPhotoFile) return;
        setUploadingPhoto(true);
        setStatusMessage({ type: null, text: "" });

        try {
            const data = new FormData();
            data.append("photo", selectedPhotoFile);

            const res = await fetch("/api/student/profile", {
                method: "PUT",
                body: data
            });

            const result = await res.json();
            if (res.ok) {
                setStatusMessage({ type: "success", text: "Photo uploaded successfully! Renamed to your Roll Number." });
                setSelectedPhotoFile(null);
                onSuccess();
            } else {
                setStatusMessage({ type: "error", text: result.error || "Failed to upload photo" });
            }
        } catch (err: any) {
            console.error(err);
            setStatusMessage({ type: "error", text: "Failed to upload photo due to network error." });
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleSaveDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingDetails(true);
        setStatusMessage({ type: null, text: "" });

        try {
            const res = await fetch("/api/student/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            const result = await res.json();
            if (res.ok) {
                setStatusMessage({ type: "success", text: "Profile details updated successfully!" });
                onSuccess();
            } else {
                setStatusMessage({ type: "error", text: result.error || "Failed to update profile details" });
            }
        } catch (err: any) {
            console.error(err);
            setStatusMessage({ type: "error", text: "Failed to update profile due to network error." });
        } finally {
            setSavingDetails(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Update My Profile" maxWidth="max-w-3xl">
            <div className="space-y-6">
                {statusMessage.text && (
                    <div
                        className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium border ${
                            statusMessage.type === "success"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-red-50 text-red-800 border-red-200"
                        }`}
                    >
                        {statusMessage.type === "success" ? <FaCheck /> : <FaExclamationCircle />}
                        <span>{statusMessage.text}</span>
                    </div>
                )}

                {/* Photo Upload Section */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-2 border-white shadow bg-slate-100">
                            {photoPreview ? (
                                <Image src={photoPreview} alt={student.name} fill className="object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-slate-300">
                                    <FaUser size={40} />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 text-center sm:text-left space-y-2">
                            <h4 className="text-sm font-bold text-slate-900">Student Profile Photo</h4>
                            <p className="text-xs text-slate-500">
                                Photos are automatically saved and renamed to your Roll Number (
                                <span className="font-mono font-semibold text-slate-700">{student.rollNumber}.jpg</span>).
                                Supported: JPG, PNG, WebP (Max 2MB).
                            </p>

                            {allowPhoto ? (
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept="image/jpeg,image/png,image/webp"
                                        className="hidden"
                                        onChange={handlePhotoSelect}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                    >
                                        <FaCamera className="text-red-500" />
                                        Choose New Photo
                                    </button>

                                    {selectedPhotoFile && (
                                        <button
                                            type="button"
                                            onClick={handleUploadPhoto}
                                            disabled={uploadingPhoto}
                                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-red-600 text-xs font-bold text-white shadow hover:bg-red-700 disabled:opacity-50"
                                        >
                                            {uploadingPhoto ? "Uploading..." : "Save Photo"}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
                                    <FaLock size={11} /> Photo upload locked by administration
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Read-Only Locked Fields Banner */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                        <FaLock className="text-slate-400" /> Locked Institutional Records (Read-Only)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                            <span className="text-slate-400 block font-medium">Roll Number</span>
                            <span className="font-mono font-bold text-slate-800">{student.rollNumber}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block font-medium">Full Name</span>
                            <span className="font-semibold text-slate-800">{student.name}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block font-medium">Department</span>
                            <span className="font-semibold text-slate-800">
                                {typeof student.department === "object" ? student.department?.name : student.department || "-"}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-400 block font-medium">Class / Section</span>
                            <span className="font-semibold text-slate-800">
                                Year {student.year}-{student.semester} (Sec {typeof student.section === "object" ? student.section?.name : student.section})
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-400 block font-medium">Regulation</span>
                            <span className="font-semibold text-slate-800">
                                {typeof student.regulation === "object" ? student.regulation?.name : student.regulation || "R22"}
                            </span>
                        </div>
                        <div className="p-2 rounded bg-red-50/70 border border-red-100">
                            <span className="text-red-700 block font-bold flex items-center gap-1">
                                <FaLock size={10} /> Parent Mobile
                            </span>
                            <span className="font-mono font-bold text-red-900">{student.mobile || "Not Recorded"}</span>
                        </div>
                    </div>
                </div>

                {/* Editable Profile Fields */}
                {allowProfile ? (
                    <form onSubmit={handleSaveDetails} className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                            Editable Personal & Contact Details
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">My Mobile (Student)</label>
                                <input
                                    type="text"
                                    value={formData.studentContactNumber}
                                    onChange={(e) => setFormData({ ...formData, studentContactNumber: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                                    placeholder="e.g. 9876543210"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Email ID</label>
                                <input
                                    type="email"
                                    value={formData.emailId}
                                    onChange={(e) => setFormData({ ...formData, emailId: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                                    placeholder="student@example.com"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Father's Name</label>
                                <input
                                    type="text"
                                    value={formData.fatherName}
                                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Mother's Name</label>
                                <input
                                    type="text"
                                    value={formData.motherName}
                                    onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                                <input
                                    type="date"
                                    value={formData.dateOfBirth}
                                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                                <select
                                    value={formData.gender}
                                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                                >
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Aadhar Number</label>
                                <input
                                    type="text"
                                    value={formData.aadharNumber}
                                    onChange={(e) => setFormData({ ...formData, aadharNumber: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                                    placeholder="12 digit Aadhar"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">ABC ID (Academic Bank of Credits)</label>
                                <input
                                    type="text"
                                    value={formData.abcId}
                                    onChange={(e) => setFormData({ ...formData, abcId: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Caste Category</label>
                                <input
                                    type="text"
                                    value={formData.caste}
                                    onChange={(e) => setFormData({ ...formData, caste: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                                    placeholder="e.g. OC, BC-A, SC, ST"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Caste Sub-Caste Name</label>
                                <input
                                    type="text"
                                    value={formData.casteName}
                                    onChange={(e) => setFormData({ ...formData, casteName: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address</label>
                                <textarea
                                    rows={2}
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                                    placeholder="Door No, Street, Village/City, Mandal, District, PIN"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={savingDetails}
                                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow disabled:opacity-50"
                            >
                                <FaSave />
                                {savingDetails ? "Saving..." : "Save Profile Details"}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-center gap-2">
                        <FaLock />
                        <span>Profile details editing is currently locked by the administrator.</span>
                    </div>
                )}
            </div>
        </Modal>
    );
}
