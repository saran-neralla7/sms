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
    regulationId?: string;
    regulation?: string | any;
    batchId?: string | null;
    batch?: { id: string; name: string };
    isDetained?: boolean;
    isLateralEntry?: boolean;
    originalBatchId?: string | null;
    originalBatch?: { id: string; name: string };
    labBatchId?: string | null;
    labBatch?: { id: string; name: string };

    // Extended
    hallTicketNumber?: string;
    eamcetRank?: string;
    dateOfBirth?: string; // ISO String from Date
    dateOfReporting?: string;
    gender?: string;
    caste?: string;
    casteName?: string;
    category?: string;
    admissionType?: string;
    fatherName?: string;
    motherName?: string;
    address?: string;
    studentContactNumber?: string;
    emailId?: string;
    aadharNumber?: string;
    abcId?: string;
    reimbursement?: boolean;
    certificatesSubmitted?: boolean;
    domainMailId?: string;
    subjects?: any[];
}

export interface Subject {
    id: string;
    name: string;
    code: string;
    year: string;
    semester: string;
    type: string;
    isElective: boolean;
    shortName?: string | null;
    electiveSlot?: string | null;
    regulation?: string;
    departmentId: string;
    department?: Department;
}

export interface User {
    id: string;
    username: string;
    role: string;
    departmentId?: string | null;
    department?: Department;
    createdAt: Date;
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
    subject?: Subject;
    period?: Period;
}

export interface Period {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
}

export interface Faculty {
    id: string;
    empCode: string;
    empName: string;
    shortName: string | null;
    dob: string; // ISO
    gender: string;
    joinDate: string; // ISO
    resignDate: string | null;
    departmentId: string;
    department?: Department; // Relation
    designation: string;
    mobile: string;
    email: string | null;
    bloodGroup: string | null;
    basicSalary: number | null;
    fatherName: string | null;
    motherName: string | null;
    address: string | null;
    qualification: string | null;
    aadharNo: string | null;
    panNo: string | null;
    user?: User | null;
}
