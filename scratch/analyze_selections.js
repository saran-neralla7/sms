const XLSX = require('xlsx');
const workbook = XLSX.readFile('./department_wise_selections.xlsx');
console.log("Sheet names:", workbook.SheetNames);
for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log(`\nSheet: ${sheetName}`);
  console.log("Number of rows:", rows.length);
  if (rows.length > 0) {
    console.log("First row keys:", Object.keys(rows[0]));
    console.log("First row example:", rows[0]);
  }
}
