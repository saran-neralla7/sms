const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'sample-result.ods');
console.log('Loading ODS file from:', filePath);

try {
  const workbook = XLSX.readFile(filePath);
  console.log('Sheet names:', workbook.SheetNames);
  
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  console.log('First 10 rows of data:');
  console.log(data.slice(0, 10));
} catch (error) {
  console.error('Error reading ODS:', error);
}
