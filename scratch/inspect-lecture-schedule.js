const XLSX = require('xlsx');

try {
  const workbook = XLSX.readFile('./Lecture-Schedule.xls');
  console.log("Sheet names:", workbook.SheetNames);
  
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const range = XLSX.utils.decode_range(sheet['!ref']);
  console.log("Sheet range:", sheet['!ref']);
  
  // Print the first 20 rows of the sheet
  for (let r = 0; r <= 20; r++) {
    const rowValues = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[cellAddress];
      rowValues.push(cell ? cell.v : null);
    }
    // Check if row has any non-null values
    if (rowValues.some(v => v !== null)) {
      console.log(`Row ${r}:`, rowValues.map((v, c) => `${XLSX.utils.encode_col(c)}: ${v}`).filter(x => !x.endsWith('null')));
    }
  }
} catch (e) {
  console.error("Error reading workbook:", e);
}
