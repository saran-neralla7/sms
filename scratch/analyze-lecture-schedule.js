const XLSX = require("xlsx");

function main() {
  const workbook = XLSX.readFile("./Lecture-Schedule.xls");
  console.log("Sheet names:", workbook.SheetNames);
  for (const sheetName of workbook.SheetNames) {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    // Dump first 30 rows
    const range = XLSX.utils.decode_range(sheet['!ref']);
    console.log("Ref:", sheet['!ref']);
    for (let r = 0; r <= Math.min(range.e.r, 45); r++) {
      const rowVals = [];
      for (let c = 0; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        rowVals.push(cell ? cell.v : null);
      }
      if (rowVals.some(v => v !== null)) {
        console.log(`Row ${r}:`, rowVals);
      }
    }
  }
}

main();
