const XLSX = require('xlsx');
const workbook = XLSX.readFile('./department_wise_selections.xlsx');
const sheet = workbook.Sheets['All Departments'];
const rows = XLSX.utils.sheet_to_json(sheet);
const categories = new Set();
rows.forEach(r => {
  if (r['Elective Category']) categories.add(r['Elective Category']);
});
console.log("Unique Elective Categories in Excel sheet:", Array.from(categories));
