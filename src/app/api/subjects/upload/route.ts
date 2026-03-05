import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "buffer" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
            return NextResponse.json({ error: "Excel file is empty" }, { status: 400 });
        }

        const report = {
            total: data.length,
            success: 0,
            errors: [] as string[]
        };

        // Pre-fetch commonly used lookups to minimize DB calls
        const departments = await prisma.department.findMany();
        const regulations = await prisma.regulation.findMany();
        const slots = await prisma.electiveSlot.findMany();

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2; // +1 for 0-index, +1 for header

            try {
                // Validate required fields
                if (!row.Code || !row.Name || !row.Department) {
                    throw new Error("Missing required fields (Code, Name, or Department)");
                }

                // 1. Resolve Department
                const dept = departments.find(d =>
                    d.name.toLowerCase() === (row.Department || "").toLowerCase() ||
                    d.code.toLowerCase() === (row.Department || "").toLowerCase()
                );
                if (!dept) throw new Error(`Department '${row.Department}' not found`);

                // 2. Resolve Regulation
                let regulationId = null;
                const regName = row.Regulation || "R22";
                let reg = regulations.find(r => r.name === regName);
                if (!reg) {
                    // Create if not exists
                    reg = await prisma.regulation.create({ data: { name: regName } });
                    regulations.push(reg); // Update local cache
                }
                regulationId = reg.id;

                // 3. Resolve Elective Slot
                let electiveSlotId = null;
                if (row["Elective Slot"]) {
                    const slotName = row["Elective Slot"];
                    let slot = slots.find(s => s.name === slotName);
                    if (!slot) {
                        slot = await prisma.electiveSlot.create({ data: { name: slotName } });
                        slots.push(slot); // Update local cache
                    }
                    electiveSlotId = slot.id;
                }

                // 4. Determine Type
                let type = (row.Type || "THEORY").toUpperCase();
                // Ensure valid enum/string matches
                const validTypes = ["THEORY", "LAB", "PROFESSIONAL_ELECTIVE", "OPEN_ELECTIVE", "PROJECT", "SEMINAR"];
                if (!validTypes.includes(type)) type = "THEORY";

                const isElective = type.includes("ELECTIVE") || !!electiveSlotId;

                // 5. Proceed to Check and Update/Create


                // Re-write to pure findFirst/create/update logic because schema lacks unique constraint on [code, departmentId, regulationId]
                const existing = await prisma.subject.findFirst({
                    where: {
                        code: String(row.Code),
                        departmentId: dept.id,
                        regulationId: regulationId
                    }
                });

                if (existing) {
                    await prisma.subject.update({
                        where: { id: existing.id },
                        data: {
                            name: row.Name,
                            shortName: row["Short Name"] || null,
                            year: String(row.Year || "1"),
                            semester: String(row.Semester || "1"),
                            type,
                            isElective,
                            electiveSlotId
                        }
                    });
                } else {
                    await prisma.subject.create({
                        data: {
                            code: String(row.Code),
                            name: row.Name,
                            shortName: row["Short Name"] || null,
                            departmentId: dept.id,
                            regulationId,
                            year: String(row.Year || "1"),
                            semester: String(row.Semester || "1"),
                            type,
                            isElective,
                            electiveSlotId
                        }
                    });
                }

                report.success++;

            } catch (err: any) {
                report.errors.push(`Row ${rowNum} (${row.Code || 'Unknown'}): ${err.message}`);
            }
        }

        return NextResponse.json({
            message: `Processed ${data.length} records`,
            report
        });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Failed to process file" }, { status: 500 });
    }
}
