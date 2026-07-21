const XLSX = require('xlsx');
const fs = require('fs');

const files = ['department_wise_selection.xlsx', 'dept-wis-list.xlsx'];

files.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`\n=== Inspecting File: ${file} ===`);
        const wb = XLSX.readFile(file);
        console.log("Sheet names:", wb.SheetNames);
        wb.SheetNames.forEach(sheetName => {
            const ws = wb.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(ws);
            console.log(`Sheet '${sheetName}' has ${rows.length} rows.`);
            if (rows.length > 0) {
                console.log("Sample row keys:", Object.keys(rows[0]));
                console.log("Sample row:", rows[0]);
            }
        });
    } else {
        console.log(`File not found: ${file}`);
    }
});
