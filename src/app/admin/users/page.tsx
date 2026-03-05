"use client";

import { useState, useEffect } from "react";
import { User } from "@/types";
import ConfirmationModal from "@/components/ConfirmationModal";
import Modal from "@/components/Modal";
import { useSession } from "next-auth/react";
import { FaEdit, FaTrash, FaUserPlus, FaUserShield, FaUsers } from "react-icons/fa";

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

    const toggleSelectAll = () => {
        if (selectedIds.size === users.length) {
            setSelectedIds(new Set());
        } else {
            const allIds = new Set(users.map(u => u.id));
            if (session?.user?.id) allIds.delete(session.user.id); // Exclude self
            setSelectedIds(allIds);
        }
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                        <FaUsers size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
                        <p className="text-sm text-slate-500">Manage system access and roles.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
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

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50">
                                <th className="px-6 py-4 w-4">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size > 0 && selectedIds.size === users.filter(u => u.id !== session?.user?.id).length}
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
                            {users.map((user) => (
                                <tr key={user.id} className="group hover:bg-slate-50/80 transition-colors">
                                    <td className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(user.id)}
                                            onChange={() => toggleSelect(user.id)}
                                            disabled={user.id === session?.user?.id}
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
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
                            ))}
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
