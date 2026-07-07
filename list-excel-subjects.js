const XLSX = require('xlsx');

const wb = XLSX.readFile('/home/gvp/student-management-system/department_wise_selection.xlsx');
const ws = wb.Sheets['All Departments'];
const rows = XLSX.utils.sheet_to_json(ws);

const uniqueSubjects = new Map();
rows.forEach(r => {
    const code = r["Subject Code"];
    const name = r["Subject Name"];
    uniqueSubjects.set(code, name);
});

console.log("Unique Subjects in Excel:");
for (const [code, name] of uniqueSubjects.entries()) {
    console.log(`- ${code}: ${name}`);
}
