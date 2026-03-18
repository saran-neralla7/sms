
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FaUser, FaIdCard, FaBuilding, FaPhone, FaEnvelope, FaBirthdayCake, FaTint, FaMapMarkerAlt } from "react-icons/fa";
import Image from "next/image";
import { formatISTDate } from "@/lib/dateUtils";

export default async function FacultyProfilePage() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user.email) { // Email field often stores username/empCode internally in NextAuth custom provider
        // Ideally use ID lookup
    }

    // We need to fetch faculty by mapping User -> Faculty
    const user = await prisma.user.findUnique({
        where: { id: session?.user?.id },
        include: {
            faculty: {
                include: {
                    department: true
                }
            }
        }
    });

    const faculty = user?.faculty;

    if (!faculty) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p className="text-slate-500">Faculty profile not found.</p>
            </div>
        );
    }

    // Helper to format date
    const formatDate = (date: Date) => {
        return formatISTDate(date);
    };

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-10 text-white">
                        <div className="flex flex-col items-center gap-6 md:flex-row">
                            <div className="relative h-24 w-24 overflow-hidden rounded-full bg-white/20 p-1 ring-4 ring-white/30">
                                <FaUser className="h-full w-full p-2 text-white/90" />
                            </div>
                            <div className="text-center md:text-left">
                                <h1 className="text-3xl font-bold">{faculty.empName}</h1>
                                <p className="mt-1 text-blue-100">{faculty.designation}</p>
                                <div className="mt-4 flex flex-wrap justify-center gap-3 md:justify-start">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                                        <FaBuilding /> {faculty.department.name}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                                        <FaIdCard /> {faculty.empCode}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8 p-8 md:grid-cols-2">
                        <div className="space-y-6">
                            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2">
                                Contact Information
                            </h2>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                        <FaPhone size={14} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase">Mobile</p>
                                        <p className="text-sm font-semibold text-slate-800">{faculty.mobile}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                        <FaEnvelope size={14} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase">Email</p>
                                        <p className="text-sm font-semibold text-slate-800">{faculty.email || "N/A"}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                        <FaMapMarkerAlt size={14} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase">Address</p>
                                        <p className="text-sm font-semibold text-slate-800">{faculty.address || "N/A"}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2">
                                Personal Details
                            </h2>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                                        <FaBirthdayCake size={14} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase">Date of Birth</p>
                                        <p className="text-sm font-semibold text-slate-800">{formatDate(faculty.dob)}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                                        <FaTint size={14} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase">Blood Group</p>
                                        <p className="text-sm font-semibold text-slate-800">{faculty.bloodGroup || "N/A"}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase">Father's Name</p>
                                        <p className="text-sm font-semibold text-slate-800">{faculty.fatherName || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase">Qualification</p>
                                        <p className="text-sm font-semibold text-slate-800">{faculty.qualification || "N/A"}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
