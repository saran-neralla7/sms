const XLSX = require('xlsx');
const path = require('path');

function main() {
  const filePath = path.join(__dirname, '..', 'civil-3.ods');
  const workbook = XLSX.readFile(filePath);
  
  console.log('Sheet Names:', workbook.SheetNames);
  
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`\nLoaded ${rows.length} rows from sheet "${sheetName}".`);
  if (rows.length > 0) {
    console.log('\nHeaders/Keys from first row:');
    console.log(Object.keys(rows[0]));
    
    console.log('\nFirst 5 rows:');
    console.log(JSON.stringify(rows.slice(0, 5), null, 2));
  }
}

main();
