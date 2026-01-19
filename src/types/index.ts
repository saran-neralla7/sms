export interface Department {
    id: string;
    name: string;
    code: string;
}

export interface Section {
    id: string;
    name: string;
}

export interface Student {
    id: string;
    rollNumber: string;
    name: string;
    mobile: string;
    year: string;
    semester: string;

    sectionId: string;
    section?: Section; // Relation

    departmentId: string;
    department?: Department; // Relation
    photoUrl?: string; // Optional URL
}

export interface User {
    id: string;
    username: string;
    role: string;
    departmentId?: string | null;
    department?: Department;
}

export interface AttendanceHistory {
    id: string;
    date: string;
    year: string;
    semester: string;

    sectionId: string;
    section?: Section;

    departmentId: string;
    department?: Department;

    status: string;
    fileName: string;
    details?: string;
    user: {
        username: string;
    };
}
