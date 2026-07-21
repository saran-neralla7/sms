const xlsx = require('xlsx');
const path = require('path');

function main() {
    const filePath = path.join(__dirname, '../dept-wis-list.xlsx');
    const workbook = xlsx.readFile(filePath);
    
    console.log("Sheet names in dept-wis-list.xlsx:");
    console.log(workbook.SheetNames);
    
    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);
        console.log(`Sheet: ${sheetName}, Row count: ${data.length}`);
        if (data.length > 0) {
            console.log("Headers/Sample row:", Object.keys(data[0]), JSON.stringify(data[0]));
        }
    });
}

main();
