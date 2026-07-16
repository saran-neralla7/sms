const XLSX = require('xlsx');

try {
    const wb = XLSX.readFile('/home/gvp/student-management-system/dept-wis-list.xlsx');
    const ws = wb.Sheets['All Departments'];
    const rows = XLSX.utils.sheet_to_json(ws);
    
    if (rows.length > 0) {
        const firstRow = rows[0];
        console.log("Keys of first row:", Object.keys(firstRow));
        const keysWithDept = Object.keys(firstRow).filter(k => k.toLowerCase().includes("offering"));
        console.log("Keys containing 'offering':", keysWithDept);
    }
} catch (error) {
    console.error("Error reading file:", error);
}
