import * as XLSX from "xlsx";

async function main() {
  const filePath = "./public/CD-attainment.xlsx";
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  console.log("Dumping cell formulas for CO-PO Mapping & Attainments:");
  
  // CO-PO Mapping rows: 227 to 232
  // CO-PO Attainment rows: 239 to 244
  // CO-PSO Mapping/Attainment rows: 250 to 256
  
  for (const r of [226, 227, 231, 232, 238, 239, 243, 244, 249, 250, 254, 255]) {
    const cols: string[] = [];
    for (let c = 0; c <= 15; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[cellAddress];
      if (cell) {
        let displayVal = cell.f ? `[FORMULA: =${cell.f}] (val: ${cell.v ?? ""})` : `[VALUE: ${cell.v ?? ""}]`;
        cols.push(`${XLSX.utils.encode_col(c)}${r + 1}: ${displayVal}`);
      }
    }
    if (cols.length > 0) {
      console.log(`\nRow ${r + 1}:`);
      cols.forEach(col => console.log("  ", col));
    }
  }
}

main().catch(console.error);
