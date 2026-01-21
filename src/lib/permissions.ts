export const ROLES = {
    ADMIN: "ADMIN", // Super Admin
    DIRECTOR: "DIRECTOR",
    PRINCIPAL: "PRINCIPAL",
    HOD: "HOD",
    FACULTY: "FACULTY",
    USER: "USER" // Basic student/viewer
};

export const GLOBAL_ROLES = [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.PRINCIPAL];

export type UserSession = {
    id: string;
    role: string;
    departmentId?: string | null;
};

/**
 * Checks if the user has global administrative privileges.
 */
export function hasGlobalAccess(user: UserSession | undefined): boolean {
    if (!user) return false;
    return GLOBAL_ROLES.includes(user.role);
}

/**
 * Checks if the user has permission to manage a specific department.
 * - Global admins have access to ALL departments.
 * - HODs/Faculty have access ONLY to their assigned department.
 */
export function hasDepartmentAccess(user: UserSession | undefined, targetDepartmentId: string): boolean {
    if (!user) return false;
    if (hasGlobalAccess(user)) return true;

    // HOD or Faculty must belong to the target department
    if (user.role === ROLES.HOD || user.role === ROLES.FACULTY) {
        return user.departmentId === targetDepartmentId;
    }

    return false;
}

/**
 * Checks if the user can manage OTHER users.
 * - Global admins can manage everyone.
 * - HODs can manage Faculty/Students within their restricted scope (logic handled in API usually).
 */
export function canManageUsers(user: UserSession | undefined): boolean {
    if (!user) return false;
    return hasGlobalAccess(user) || user.role === ROLES.HOD;
}
