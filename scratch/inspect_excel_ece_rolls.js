const xlsx = require('xlsx');
const path = require('path');

function main() {
    const filePath = path.join(__dirname, '../department_wise.xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets['ECE'];
    if (!sheet) {
        console.log("No ECE sheet found in department_wise.xlsx");
        return;
    }
    const data = xlsx.utils.sheet_to_json(sheet);
    console.log(`Found ${data.length} ECE rows in department_wise.xlsx.`);
    const rolls = data.map(r => String(r['Roll Number'] || r['rollNumber'] || '')).filter(r => r.startsWith('5241421'));
    console.log(`Found ${rolls.length} roll numbers starting with 5241421 in ECE sheet:`);
    console.log(rolls.sort());
}

main();
