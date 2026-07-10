const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'civil.xlsx');
console.log('Loading file from:', filePath);

try {
  const workbook = XLSX.readFile(filePath);
  console.log('Sheet names:', workbook.SheetNames);
  
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Get first 5 rows
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  console.log('First 5 rows:');
  console.log(data.slice(0, 10));
} catch (error) {
  console.error('Error reading excel:', error);
}
