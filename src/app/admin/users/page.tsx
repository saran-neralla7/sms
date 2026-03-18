"use client";

import { useState, useEffect } from "react";
import { User } from "@/types";
import ConfirmationModal from "@/components/ConfirmationModal";
import Modal from "@/components/Modal";
import { useSession } from "next-auth/react";
import { FaEdit, FaTrash, FaUserPlus, FaUserShield, FaUsers, FaSearch, FaFilter, FaFileExport, FaMagic } from "react-icons/fa";
import * as XLSX from "xlsx";

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const { data: session } = useSession();

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkDeleteMode, setIsBulkDeleteMode] = useState(false);

    // Filters and Tabs
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [activeTab, setActiveTab] = useState<"FACULTY" | "STUDENT">("FACULTY");
    const [isGeneratingLogins, setIsGeneratingLogins] = useState(false);

    const [formData, setFormData] = useState({
        username: "",
        password: "",
        role: "USER",
        departmentId: "",
    });

    const isGlobalRole = ["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(formData.role);

    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });

    const [departments, setDepartments] = useState<any[]>([]);

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        fetchDepartments(true);
    }, []);

    // ... (fetchDepartments and fetchUsers same as before) ...
    const fetchDepartments = async (showAll: boolean = true) => {
        try {
            const res = await fetch(`/api/departments${showAll ? '?all=true' : ''}`);
            if (res.ok) {
                const data = await res.json();
                setDepartments(data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/users");
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus({ type: null, message: "" });

        try {
            const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
            const method = editingUser ? "PUT" : "POST";

            const body: any = { ...formData };
            if (editingUser && !body.password) {
                delete body.password;
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                setIsModalOpen(false);
                setEditingUser(null);
                setFormData({ username: "", password: "", role: "USER", departmentId: "" });
                fetchUsers();
                setStatus({ type: "success", message: editingUser ? "User updated successfully" : "User created successfully" });
                setTimeout(() => setStatus({ type: null, message: "" }), 3000);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to save user" });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "An error occurred while saving user" });
        }
    };

    const confirmDelete = (user: User) => {
        setUserToDelete(user);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        setStatus({ type: null, message: "" });
        try {
            const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
            if (res.ok) {
                setUsers(prev => prev.filter(u => u.id !== id));
                setStatus({ type: "success", message: "User deleted successfully" });
                setTimeout(() => setStatus({ type: null, message: "" }), 3000);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to delete user" });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "An error occurred while deleting user" });
        }
    };

    const handleBulkDelete = async () => {
        setStatus({ type: null, message: "" });
        try {
            const idsToDelete = Array.from(selectedIds);
            const res = await fetch(`/api/users`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: idsToDelete }),
            });

            if (res.ok) {
                setUsers(prev => prev.filter(u => !selectedIds.has(u.id)));
                setSelectedIds(new Set());
                setStatus({ type: "success", message: "Users deleted successfully" });
                setTimeout(() => setStatus({ type: null, message: "" }), 3000);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to delete users" });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "An error occurred while deleting users" });
        }
    };

    const handleGenerateStudentLogins = async () => {
        setIsGeneratingLogins(true);
        setStatus({ type: null, message: "" });
        try {
            const res = await fetch("/api/users/bulk-students", { method: "POST" });
            const data = await res.json();
            
            if (res.ok) {
                setStatus({ type: "success", message: data.message });
                fetchUsers();
            } else {
                setStatus({ type: "error", message: data.error || "Failed to generate logins" });
            }
        } catch (error) {
            setStatus({ type: "error", message: "Server error generating logins" });
        } finally {
            setIsGeneratingLogins(false);
            setTimeout(() => setStatus({ type: null, message: "" }), 5000);
        }
    };

    const handleExportStudentLogins = () => {
        const studentUsers = users.filter(u => u.role === "STUDENT");
        const exportData = studentUsers.map(u => ({
            "Roll Number (Username)": u.username,
            "Role": u.role,
            "Department": u.department?.name || "N/A",
            "Account Created Date": new Date(u.createdAt).toLocaleDateString('en-GB')
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Student_Logins");
        XLSX.writeFile(wb, "Student_Logins_Export.xlsx");
    };

    const filteredUsers = users.filter(user => {
        const isStudentRole = user.role === "STUDENT";
        if (activeTab === "FACULTY" && isStudentRole) return false;
        if (activeTab === "STUDENT" && !isStudentRole) return false;

        if (roleFilter !== "ALL" && user.role !== roleFilter) return false;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return user.username.toLowerCase().includes(query) || (user.department?.name && user.department.name.toLowerCase().includes(query));
        }

        return true;
    });

    const toggleSelectAll = () => {
        const selectableFilteredIds = filteredUsers.map(u => u.id).filter(id => id !== session?.user?.id);
        const allSelected = selectableFilteredIds.every(id => selectedIds.has(id)) && selectableFilteredIds.length > 0;

        const newSet = new Set(selectedIds);
        if (allSelected) {
            selectableFilteredIds.forEach(id => newSet.delete(id));
        } else {
            selectableFilteredIds.forEach(id => newSet.add(id));
        }
        setSelectedIds(newSet);
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const openAddModal = () => {
        setEditingUser(null);
        setFormData({ username: "", password: "", role: "USER", departmentId: "" });
        setIsModalOpen(true);
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            password: "",
            role: user.role,
            departmentId: user.departmentId || "",
        });
        setIsModalOpen(true);
    };

    return (
        <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${activeTab === 'STUDENT' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        <FaUsers size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
                        <p className="text-sm text-slate-500">Manage system access for {activeTab === 'STUDENT' ? 'Students' : 'Faculty & Staff'}.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {activeTab === "STUDENT" && (
                        <>
                            <button
                                onClick={handleExportStudentLogins}
                                className="flex items-center gap-2 rounded-lg bg-green-50 text-green-700 px-4 py-2 text-sm font-semibold hover:bg-green-100 transition-colors border border-green-200"
                            >
                                <FaFileExport /> Export Active Logins
                            </button>
                            <button
                                onClick={handleGenerateStudentLogins}
                                disabled={isGeneratingLogins}
                                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                <FaMagic /> {isGeneratingLogins ? "Generating..." : "Auto-Create Missing Logins"}
                            </button>
                        </>
                    )}
                    {selectedIds.size > 0 && (
                        <button
                            onClick={() => {
                                setIsBulkDeleteMode(true);
                                setIsDeleteModalOpen(true);
                            }}
                            className="flex items-center gap-2 rounded-lg bg-red-50 text-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-100 transition-colors border border-red-200"
                        >
                            <FaTrash /> Delete Selected ({selectedIds.size})
                        </button>
                    )}
                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
                    >
                        <FaUserPlus /> Add User
                    </button>
                </div>
            </div>

            {status.message && !isModalOpen && !isDeleteModalOpen && (
                <div className={`mb-4 rounded-md p-4 text-sm font-medium ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                    {status.message}
                </div>
            )}

            {/* Tabs & Filters */}
            <div className="mb-6 space-y-4">
                {/* Tabs */}
                <div className="flex space-x-1 rounded-xl bg-slate-100/50 p-1">
                    <button
                        onClick={() => { setActiveTab("FACULTY"); setRoleFilter("ALL"); setSearchQuery(""); }}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${activeTab === "FACULTY" ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                            }`}
                    >
                        Faculty Logins
                    </button>
                    <button
                        onClick={() => { setActiveTab("STUDENT"); setRoleFilter("ALL"); setSearchQuery(""); }}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${activeTab === "STUDENT" ? "bg-white text-red-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                            }`}
                    >
                        Student Logins
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by username or department..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400"
                        />
                    </div>
                    <div className="relative w-full sm:w-48">
                        <FaFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-8 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                        >
                            <option value="ALL">All Roles</option>
                            {activeTab === "FACULTY" && (
                                <>
                                    <option value="ADMIN">ADMIN</option>
                                    <option value="HOD">HOD</option>
                                    <option value="FACULTY">FACULTY</option>
                                    <option value="SMS_USER">SMS USER</option>
                                </>
                            )}
                            {activeTab === "STUDENT" && (
                                <option value="STUDENT">STUDENT</option>
                            )}
                        </select>
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50">
                                <th className="px-6 py-4 w-4">
                                    <input
                                        type="checkbox"
                                        checked={filteredUsers.length > 0 && filteredUsers.every(u => u.id === session?.user?.id || selectedIds.has(u.id))}
                                        onChange={toggleSelectAll}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Username</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                                        No users found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="group hover:bg-slate-50/80 transition-colors">
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(user.id)}
                                                onChange={() => toggleSelect(user.id)}
                                                disabled={user.id === session?.user?.id}
                                                className={`h-4 w-4 rounded border-slate-300 transition-colors focus:ring-opacity-50 ${activeTab === 'STUDENT' ? 'text-red-600 focus:ring-red-500' : 'text-blue-600 focus:ring-blue-500'} disabled:opacity-50`}
                                            />
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                                            {user.username}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    {user.role === "ADMIN" && <FaUserShield className="text-amber-500" />}
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${user.role === "ADMIN"
                                                        ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20"
                                                        : user.role === "HOD"
                                                            ? "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20"
                                                            : user.role === "SMS_USER"
                                                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                                                                : "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20"
                                                        }`}>
                                                        {user.role}
                                                    </span>
                                                </div>
                                                {user.department && (
                                                    <span className="text-xs text-slate-400">
                                                        {user.department.name}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <button
                                                    onClick={() => openEditModal(user)}
                                                    className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                    title="Edit"
                                                >
                                                    <FaEdit size={16} />
                                                </button>
                                                {user.id !== session?.user?.id && (
                                                    <button
                                                        onClick={() => confirmDelete(user)}
                                                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <FaTrash size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )))
                            }
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingUser ? "Edit User" : "Add User"}
            >
                {/* Form Content Remains Same */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">Username</label>
                        <input
                            placeholder="Enter username"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400"
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">{editingUser ? "New Password (Optional)" : "Password"}</label>
                        <input
                            type="password"
                            placeholder={editingUser ? "Leave blank to keep current" : "Enter password"}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400"
                            required={!editingUser}
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Role</label>
                            <select
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                            >
                                <option value="FACULTY">FACULTY - Attendance & History</option>
                                <option value="HOD">HOD - Dept Admin</option>
                                <option value="ADMIN">ADMIN - Super Admin</option>
                                <option value="SMS_USER">SMS USER - Alerts Only</option>
                                <option value="STUDENT">STUDENT - Student Portal</option>
                            </select>
                        </div>



                        {!isGlobalRole && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Department</label>
                                <select
                                    value={formData.departmentId}
                                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                                    required={!isGlobalRole && formData.role !== "USER"}
                                >
                                    <option value="">Select Department {isGlobalRole ? "(Optional)" : ""}</option>
                                    {departments.map(dept => (
                                        <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex justify-end gap-3 border-t border-slate-100 pt-5">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm"
                        >
                            {editingUser ? "Save Changes" : "Create User"}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={() => {
                    if (isBulkDeleteMode) {
                        handleBulkDelete();
                        setIsBulkDeleteMode(false);
                        setIsDeleteModalOpen(false);
                    } else if (userToDelete) {
                        handleDelete(userToDelete.id, userToDelete.username);
                        setIsDeleteModalOpen(false);
                    }
                }}
                title={isBulkDeleteMode ? "Delete Users" : "Delete User"}
                message={isBulkDeleteMode
                    ? `Are you sure you want to delete ${selectedIds.size} users? This action cannot be undone.`
                    : `Are you sure you want to delete ${userToDelete?.username}?`}
                confirmText="Delete"
                isDangerous={true}
            />
        </div >
    );
}
