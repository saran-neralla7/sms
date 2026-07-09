import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";

// ──────────────────────────────────────────────────────────────
// GET /api/course-files/export
// Generates multi-sheet Excel workbook for an entire batch
// Params: same as /rollup GET  (academicYearId, departmentId, year, semester, sectionId)
// ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sp   = req.nextUrl.searchParams;
    const base = new URL(req.url).origin;

    // Re-use the rollup endpoint to get all computed data
    const rollupUrl = `${base}/api/course-files/rollup?${sp.toString()}`;
    const rollupRes = await fetch(rollupUrl, {
      headers: { cookie: req.headers.get("cookie") || "" },
    });
    if (!rollupRes.ok) {
      const err = await rollupRes.json().catch(() => ({ error: "Rollup fetch failed" }));
      return NextResponse.json(err, { status: rollupRes.status });
    }
    const rollupData = await rollupRes.json();

    const { subjects = [], programSurvey, meta } = rollupData as any;

    const PO_LIST  = ["PO1","PO2","PO3","PO4","PO5","PO6","PO7","PO8","PO9","PO10","PO11","PO12"];
    const PSO_LIST = ["PSO1","PSO2","PSO3"];

    const poRatings  = (programSurvey?.poRatings  as Record<string, number>) ?? {};
    const psoRatings = (programSurvey?.psoRatings as Record<string, number>) ?? {};

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Batch Attainment Summary ──────────────────────
    {
      const headers = [
        "S.No", "Course",
        ...PO_LIST, ...PSO_LIST,
      ];
      const rows: any[][] = [headers];

      const allKeys = [...PO_LIST, ...PSO_LIST];

      // Batch average mapping weight for a PO/PSO
      const getBatchAvgMapping = (key: string) => {
        if (!subjects.length) return 0;
        const isPSO = key.startsWith("PSO");
        const vals = subjects
          .map((s: any) => {
            const mappingMap = isPSO ? s.avgMappingPSO : s.avgMappingPO;
            return mappingMap?.[key] ?? null;
          })
          .filter((v: any) => v !== null) as number[];
        return vals.length ? +(vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(2) : 0;
      };

      // Batch average direct attainment for a PO/PSO
      const getBatchAvgDirect = (key: string) => {
        if (!subjects.length) return 0;
        const isPSO = key.startsWith("PSO");
        const vals = subjects
          .map((s: any) => {
            const directMap = isPSO ? s.psoAttainments : s.poAttainments;
            return directMap?.[key] ?? null;
          })
          .filter((v: any) => v !== null) as number[];
        return vals.length ? +(vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(2) : 0;
      };

      // Calculated batch summary metrics
      const getBatchSummaryMetrics = (key: string) => {
        const isPSO = key.startsWith("PSO");
        const mapping = getBatchAvgMapping(key);
        const direct = getBatchAvgDirect(key);
        const survey = isPSO ? (psoRatings[key] ?? 0) : (poRatings[key] ?? 0);

        const direct80 = +(direct * 0.8).toFixed(2);
        const survey20 = +(survey * 0.2).toFixed(2);
        const achieved = +(direct80 + survey20).toFixed(2);
        const target = +(mapping * 0.85).toFixed(2);
        const attained = +(mapping - achieved).toFixed(2);
        const gap = mapping > 0 ? +((attained / mapping) * 100).toFixed(1) : 0;

        return { mapping, direct, direct80, survey, survey20, achieved, target, attained, gap };
      };

      // Populate flat subject rows
      for (let idx = 0; idx < subjects.length; idx++) {
        const sub = subjects[idx];
        const directPO = sub.poAttainments ?? {};
        const directPSO = sub.psoAttainments ?? {};

        const row = [
          idx + 1,
          sub.subjectCode,
          ...PO_LIST.map((po) => (directPO[po] != null ? +directPO[po].toFixed(2) : "")),
          ...PSO_LIST.map((pso) => (directPSO[pso] != null ? +directPSO[pso].toFixed(2) : "")),
        ];
        rows.push(row);
      }

      // Add empty separator row
      rows.push([]);

      // 1. Mapping
      rows.push([
        "", "Mapping (Average Weight)",
        ...allKeys.map((k) => getBatchAvgMapping(k) || ""),
      ]);

      // 2. Direct Attainment
      rows.push([
        "", "Attainment (Direct)",
        ...allKeys.map((k) => getBatchAvgDirect(k) || ""),
      ]);

      // 3. Actual Gap without indirect %
      rows.push([
        "", "Actual Gap (Without Survey) %",
        ...allKeys.map((k) => {
          const m = getBatchAvgMapping(k);
          const d = getBatchAvgDirect(k);
          return (m && m > 0 && d !== null) ? `${((m - d) / m * 100).toFixed(1)}%` : "";
        }),
      ]);

      // 4. 80% of Direct
      rows.push([
        "", "80% of Direct Attainment",
        ...allKeys.map((k) => {
          const d = getBatchAvgDirect(k);
          return d !== null ? +(d * 0.8).toFixed(2) : "";
        }),
      ]);

      // 5. Survey rating
      rows.push([
        "", "Survey Rating (Indirect)",
        ...allKeys.map((k) => {
          const isPSO = k.startsWith("PSO");
          const v = isPSO ? psoRatings[k] : poRatings[k];
          return v > 0 ? +v : "";
        }),
      ]);

      // 6. 20% of Survey
      rows.push([
        "", "20% of Survey Rating",
        ...allKeys.map((k) => {
          const isPSO = k.startsWith("PSO");
          const v = isPSO ? psoRatings[k] : poRatings[k];
          return v > 0 ? +(v * 0.2).toFixed(2) : "0.00";
        }),
      ]);

      // 7. Achieved
      rows.push([
        "", "Achieved Attainment",
        ...allKeys.map((k) => getBatchSummaryMetrics(k).achieved),
      ]);

      // 8. Attained
      rows.push([
        "", "Attained (Diff: Map - Achieved)",
        ...allKeys.map((k) => getBatchSummaryMetrics(k).attained),
      ]);

      // 9. Target
      rows.push([
        "", "Target (85% of Mapping)",
        ...allKeys.map((k) => getBatchSummaryMetrics(k).target),
      ]);

      // 10. Gap %
      rows.push([
        "", "Gap %",
        ...allKeys.map((k) => `${getBatchSummaryMetrics(k).gap}%`),
      ]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [
        { wch: 6 }, { wch: 30 },
        ...Array(PO_LIST.length + PSO_LIST.length).fill({ wch: 10 }),
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Attainments Summary");
    }

    // ── Sheet 2+: Individual subject sheets ────────────────────
    for (const sub of subjects) {
      const coResults   = sub.coResults ?? [];
      const decimalPlaces = sub.decimalPlaces ?? 2;
      const PO_LIST_ALL = ["PO1","PO2","PO3","PO4","PO5","PO6","PO7","PO8","PO9","PO10","PO11","PO12"];
      const PSO_LIST_ALL = ["PSO1","PSO2","PSO3"];

      const rows: any[][] = [];
      rows.push([`Subject: ${sub.subjectCode} – ${sub.subjectName}`]);
      rows.push([`Faculty: ${sub.facultyName}`]);
      rows.push([`Benchmark: ${sub.benchmarkPct}%`]);
      rows.push([]);

      // CO Attainment section
      rows.push(["CO", "Combined Pass %", "Internal Score", "Internal Level", "Uni Pass %", "Uni Level", "Final Attainment"]);
      for (const cr of coResults) {
        rows.push([
          cr.co,
          +(cr.combinedPassPct ?? 0).toFixed(1),
          +(cr.internalScore   ?? 0).toFixed(1),
          cr.internalLevel,
          cr.universityPassPct != null ? +(cr.universityPassPct).toFixed(1) : "—",
          cr.universityLevel   != null ? cr.universityLevel : "—",
          +(cr.finalAttainment ?? 0).toFixed(decimalPlaces),
        ]);
      }
      rows.push([]);

      // CO-PO mapping table
      rows.push(["CO-PO Mapping", ...PO_LIST_ALL]);
      const coPoMappings  = sub.coPoMappings  ?? [];
      const coPsoMappings = sub.coPsoMappings ?? [];

      for (const cr of coResults) {
        rows.push([
          cr.co,
          ...PO_LIST_ALL.map((po) => {
            const m = coPoMappings.find((x: any) => x.co === cr.co && x.po === po);
            return m?.weight ?? "";
          }),
        ]);
      }
      // PO Attainment row
      rows.push(["PO Attainment", ...PO_LIST_ALL.map((po) => sub.poAttainments?.[po] != null ? +sub.poAttainments[po].toFixed(decimalPlaces) : "")]);
      rows.push([]);

      // CO-PSO mapping table
      rows.push(["CO-PSO Mapping", ...PSO_LIST_ALL]);
      for (const cr of coResults) {
        rows.push([
          cr.co,
          ...PSO_LIST_ALL.map((pso) => {
            const m = coPsoMappings.find((x: any) => x.co === cr.co && x.pso === pso);
            return m?.weight ?? "";
          }),
        ]);
      }
      rows.push(["PSO Attainment", ...PSO_LIST_ALL.map((pso) => sub.psoAttainments?.[pso] != null ? +sub.psoAttainments[pso].toFixed(decimalPlaces) : "")]);
      rows.push([]);

      // Achieved vs Target per PO
      rows.push(["", ...PO_LIST_ALL, ...PSO_LIST_ALL]);
      rows.push([
        "Direct Attainment",
        ...PO_LIST_ALL.map((po) => sub.poAttainments?.[po] != null ? +sub.poAttainments[po].toFixed(decimalPlaces) : ""),
        ...PSO_LIST_ALL.map((pso) => sub.psoAttainments?.[pso] != null ? +sub.psoAttainments[pso].toFixed(decimalPlaces) : ""),
      ]);
      rows.push([
        "Indirect (Survey)",
        ...PO_LIST_ALL.map((po) => poRatings[po] ?? ""),
        ...PSO_LIST_ALL.map((pso) => psoRatings[pso] ?? ""),
      ]);
      rows.push([
        "Achieved (80/20)",
        ...PO_LIST_ALL.map((po) => {
          const d = sub.poAttainments?.[po]; const s = poRatings[po];
          return d != null ? +(0.8 * d + 0.2 * (s ?? 0)).toFixed(decimalPlaces) : "";
        }),
        ...PSO_LIST_ALL.map((pso) => {
          const d = sub.psoAttainments?.[pso]; const s = psoRatings[pso];
          return d != null ? +(0.8 * d + 0.2 * (s ?? 0)).toFixed(decimalPlaces) : "";
        }),
      ]);
      rows.push([
        "Target (Avg Map × 0.85)",
        ...PO_LIST_ALL.map((po) => sub.avgMappingPO?.[po] != null ? +(sub.avgMappingPO[po] * 0.85).toFixed(decimalPlaces) : ""),
        ...PSO_LIST_ALL.map((pso) => sub.avgMappingPSO?.[pso] != null ? +(sub.avgMappingPSO[pso] * 0.85).toFixed(decimalPlaces) : ""),
      ]);
      rows.push([
        "Gap %",
        ...PO_LIST_ALL.map((po) => {
          const t = sub.avgMappingPO?.[po] != null ? sub.avgMappingPO[po] * 0.85 : null;
          const d = sub.poAttainments?.[po];
          const s = poRatings[po];
          if (t == null || d == null || t === 0) return "";
          const a = 0.8 * d + 0.2 * (s ?? 0);
          return +(((t - a) / t) * 100).toFixed(1);
        }),
        ...PSO_LIST_ALL.map((pso) => {
          const t = sub.avgMappingPSO?.[pso] != null ? sub.avgMappingPSO[pso] * 0.85 : null;
          const d = sub.psoAttainments?.[pso];
          const s = psoRatings[pso];
          if (t == null || d == null || t === 0) return "";
          const a = 0.8 * d + 0.2 * (s ?? 0);
          return +(((t - a) / t) * 100).toFixed(1);
        }),
      ]);

      const sheetName = (sub.subjectCode || sub.subjectName || "Subject").substring(0, 31);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 22 }, ...Array(PO_LIST_ALL.length + PSO_LIST_ALL.length).fill({ wch: 8 })];
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    // ── Sheet: PO Survey Ratings ───────────────────────────────
    {
      const rows: any[][] = [
        ["Exit Survey Ratings (Indirect Attainment)"],
        [],
        ["PO/PSO", "Survey Rating (1–3)"],
        ...PO_LIST.map((po) => [po, poRatings[po] ?? ""]),
        ...PSO_LIST.map((pso) => [pso, psoRatings[pso] ?? ""]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 8 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws, "Survey Ratings");
    }

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `batch_attainment_${meta?.year ?? ""}yr_sem${meta?.semester ?? ""}.xlsx`;

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("GET /api/course-files/export error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate export" }, { status: 500 });
  }
}
