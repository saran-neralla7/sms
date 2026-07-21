const fs = require('fs');
const path = require('path');

function readLastNLines(filePath, numLines) {
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return "";
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    return lines.slice(-numLines).join('\n');
}

async function main() {
    const errorLogPath = '/home/gvp/.pm2/logs/sms-system-error.log';
    const outLogPath = '/home/gvp/.pm2/logs/sms-system-out.log';

    console.log("=== LAST 200 LINES OF ERROR LOG ===");
    console.log(readLastNLines(errorLogPath, 200));

    console.log("\n=== LAST 200 LINES OF OUT LOG ===");
    console.log(readLastNLines(outLogPath, 200));
}

main().catch(console.error);
