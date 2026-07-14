import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "src/data/elective-batches.json");

// Ensure the directory and file exist
function ensureFile() {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({}), "utf8");
    }
}

export function getElectiveBatches(): Record<string, string> {
    ensureFile();
    try {
        const content = fs.readFileSync(filePath, "utf8");
        return JSON.parse(content);
    } catch (e) {
        console.error("Error reading elective batches file:", e);
        return {};
    }
}

export function saveElectiveBatches(batches: Record<string, string>) {
    ensureFile();
    try {
        fs.writeFileSync(filePath, JSON.stringify(batches, null, 2), "utf8");
    } catch (e) {
        console.error("Error writing elective batches file:", e);
    }
}

export function getBatchForStudentSubject(studentId: string, subjectId: string): string | null {
    const batches = getElectiveBatches();
    return batches[`${studentId}_${subjectId}`] || null;
}

export function setBatchForStudentSubject(studentId: string, subjectId: string, batchName: string | null) {
    const batches = getElectiveBatches();
    const key = `${studentId}_${subjectId}`;
    if (batchName) {
        batches[key] = batchName;
    } else {
        delete batches[key];
    }
    saveElectiveBatches(batches);
}
