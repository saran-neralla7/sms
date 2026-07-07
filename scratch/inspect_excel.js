const XLSX = require('xlsx');

function main() {
    const filename = 'department_wise_selection.xlsx';
    console.log(`Reading workbook ${filename}...`);
    const wb = XLSX.readFile(filename);
    console.log("Sheet names in workbook:", wb.SheetNames);

    wb.SheetNames.forEach(sheetName => {
        console.log(`\nSheet: ${sheetName}`);
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws);
        console.log(`Total data rows in sheet ${sheetName}: ${data.length}`);

        const categories = {};
        data.forEach(row => {
            const cat = row["Elective Category"] || row["Category"] || "UNKNOWN";
            categories[cat] = (categories[cat] || 0) + 1;
        });

        console.log("Grouped by category:");
        console.dir(categories);
    });
}

main();
