import { prisma } from "./prisma";

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
