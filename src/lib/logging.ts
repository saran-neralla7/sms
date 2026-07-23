import { prisma } from "./prisma";

/**
 * Log a user activity to the AuditLog table.
 * @param performedBy - The user ID performing the action
 * @param action - Action type: CREATE, UPDATE, DELETE, LOGIN_SUCCESS, etc.
 * @param entity - The entity/model name (e.g. "TeachingDiary", "CourseFile", "LeaveRequest")
 * @param entityId - A human-readable label for the entity (e.g. "DWDM | Year 3 | Sem 1 | CSE-A")
 * @param details - Any extra detail object stored as JSON
 */
export async function logActivity(
    performedBy: string,
    action: string,
    entity: string,
    entityId: string | null,
    details: any
) {
    try {
        await prisma.auditLog.create({
            data: {
                action,
                entity,
                entityId,
                details: typeof details === "string" ? details : JSON.stringify(details),
                performedBy
            }
        });
    } catch (error) {
        console.error("Audit log error:", error);
    }
}
