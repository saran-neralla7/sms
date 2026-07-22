import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
    const client = new PrismaClient();

    client.$use(async (params, next) => {
        // Execute the query first
        const result = await next(params);

        // Check if this is a write mutation on a model other than AuditLog
        const writeActions = ['create', 'update', 'delete', 'createMany', 'updateMany', 'deleteMany', 'upsert'];
        if (params.model && params.model !== 'AuditLog' && writeActions.includes(params.action)) {
            try {
                // Dynamically import to avoid circular dependency
                const { getServerSession } = await import('next-auth');
                const { authOptions } = await import('@/lib/auth');
                const session = await getServerSession(authOptions);
                const user = session?.user as any;

                if (user) {
                    let actionType = 'UPDATE';
                    if (params.action.includes('create')) {
                        actionType = 'CREATE';
                    } else if (params.action.includes('delete')) {
                        actionType = 'DELETE';
                    }

                    // Extract entityId if possible
                    let entityId = null;
                    if (result) {
                        if (Array.isArray(result)) {
                            if (result.length > 0 && result[0].id) {
                                entityId = result.map((r: any) => r.id).join(', ');
                            }
                        } else if (result.id) {
                            entityId = String(result.id);
                        }
                    }
                    if (!entityId && params.args?.where?.id) {
                        entityId = String(params.args.where.id);
                    }

                    // Format details safely
                    let detailsObj = params.args;
                    // If it is a password change or user creation, sanitize/remove sensitive fields
                    if (params.model === 'User' && detailsObj?.data) {
                        detailsObj = {
                            ...detailsObj,
                            data: {
                                ...detailsObj.data,
                                password: detailsObj.data.password ? '[REDACTED]' : undefined
                            }
                        };
                    }

                    // Create audit log record
                    await client.auditLog.create({
                        data: {
                            action: actionType,
                            entity: params.model,
                            entityId: entityId ? String(entityId).substring(0, 100) : null,
                            details: JSON.stringify(detailsObj),
                            performedBy: user.id || 'SYSTEM'
                        }
                    });
                }
            } catch (error) {
                // Silently catch errors to avoid interrupting the main database operation
                console.error("Auto audit log error:", error);
            }
        }

        return result;
    });

    return client;
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
