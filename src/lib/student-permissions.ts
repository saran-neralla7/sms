import fs from "fs/promises";
import path from "path";

export interface StudentEditRule {
    allowProfileEdit?: boolean;
    allowPhotoEdit?: boolean;
    grantedAt?: string;
    updatedAt?: string;
}

export interface StudentEditPermissionsConfig {
    globalProfileEdit: boolean;
    globalPhotoEdit: boolean;
    allowedStudentRolls: string[];
    rules: Record<string, StudentEditRule>;
}

const getSettingsPath = () => path.join(process.cwd(), "system_settings.json");

export async function getStudentEditConfig(): Promise<StudentEditPermissionsConfig> {
    try {
        const filePath = getSettingsPath();
        const content = await fs.readFile(filePath, "utf-8");
        const json = JSON.parse(content);
        const perms = json.studentEditPermissions || {};
        return {
            globalProfileEdit: !!perms.globalProfileEdit,
            globalPhotoEdit: !!perms.globalPhotoEdit,
            allowedStudentRolls: Array.isArray(perms.allowedStudentRolls) ? perms.allowedStudentRolls : [],
            rules: perms.rules && typeof perms.rules === "object" ? perms.rules : {}
        };
    } catch (e: any) {
        return {
            globalProfileEdit: false,
            globalPhotoEdit: false,
            allowedStudentRolls: [],
            rules: {}
        };
    }
}

export async function getStudentEffectivePermissions(rollNumber: string): Promise<{ allowProfileEdit: boolean; allowPhotoEdit: boolean }> {
    const config = await getStudentEditConfig();
    const upperRoll = (rollNumber || "").trim().toUpperCase();

    // Specific student rule overrides if present
    const rule = config.rules[upperRoll] || config.rules[rollNumber];
    if (rule) {
        return {
            allowProfileEdit: rule.allowProfileEdit !== undefined ? !!rule.allowProfileEdit : config.globalProfileEdit,
            allowPhotoEdit: rule.allowPhotoEdit !== undefined ? !!rule.allowPhotoEdit : config.globalPhotoEdit
        };
    }

    // Fall back to allowedStudentRolls list check
    const isInList = config.allowedStudentRolls.some(r => r.toUpperCase() === upperRoll);
    if (isInList) {
        return {
            allowProfileEdit: true,
            allowPhotoEdit: true
        };
    }

    // Default to global settings
    return {
        allowProfileEdit: !!config.globalProfileEdit,
        allowPhotoEdit: !!config.globalPhotoEdit
    };
}

export async function updateStudentEditPermissions(update: {
    globalProfileEdit?: boolean;
    globalPhotoEdit?: boolean;
    rolls?: string[];
    allowProfileEdit?: boolean;
    allowPhotoEdit?: boolean;
    action?: "set" | "remove";
}) {
    const filePath = getSettingsPath();
    let currentSettings: any = {};
    try {
        const content = await fs.readFile(filePath, "utf-8");
        currentSettings = JSON.parse(content);
    } catch {
        currentSettings = {};
    }

    if (!currentSettings.studentEditPermissions) {
        currentSettings.studentEditPermissions = {
            globalProfileEdit: false,
            globalPhotoEdit: false,
            allowedStudentRolls: [],
            rules: {}
        };
    }

    const perms = currentSettings.studentEditPermissions;
    if (!perms.rules) perms.rules = {};
    if (!Array.isArray(perms.allowedStudentRolls)) perms.allowedStudentRolls = [];

    if (update.globalProfileEdit !== undefined) {
        perms.globalProfileEdit = !!update.globalProfileEdit;
    }
    if (update.globalPhotoEdit !== undefined) {
        perms.globalPhotoEdit = !!update.globalPhotoEdit;
    }

    if (update.rolls && update.rolls.length > 0) {
        const now = new Date().toISOString();
        for (const rawRoll of update.rolls) {
            const roll = rawRoll.trim().toUpperCase();
            if (!roll) continue;

            if (update.action === "remove") {
                delete perms.rules[roll];
                delete perms.rules[rawRoll];
                perms.allowedStudentRolls = perms.allowedStudentRolls.filter((r: string) => r.toUpperCase() !== roll);
            } else {
                // Set / Update
                const existing = perms.rules[roll] || perms.rules[rawRoll] || {};
                perms.rules[roll] = {
                    allowProfileEdit: update.allowProfileEdit !== undefined ? !!update.allowProfileEdit : (existing.allowProfileEdit ?? true),
                    allowPhotoEdit: update.allowPhotoEdit !== undefined ? !!update.allowPhotoEdit : (existing.allowPhotoEdit ?? true),
                    updatedAt: now,
                    grantedAt: existing.grantedAt || now
                };

                if (!perms.allowedStudentRolls.includes(roll)) {
                    perms.allowedStudentRolls.push(roll);
                }
            }
        }
    }

    await fs.writeFile(filePath, JSON.stringify(currentSettings, null, 2), "utf-8");
    return perms;
}
