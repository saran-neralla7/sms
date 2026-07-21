const fs = require('fs');

function searchLog(filePath, keyword) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    console.log(`=== Matches for '${keyword}' in ${filePath} ===`);
    lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(keyword.toLowerCase())) {
            console.log(`Line ${idx + 1}: ${line}`);
        }
    });
}

async function main() {
    const errorLogPath = '/home/gvp/.pm2/logs/sms-system-error.log';
    const outLogPath = '/home/gvp/.pm2/logs/sms-system-out.log';

    searchLog(outLogPath, 'BHP');
    searchLog(errorLogPath, 'BHP');

    searchLog(outLogPath, 'dc89b616-0357-4c10-b7bf-335d22c6fc12');
    searchLog(errorLogPath, 'dc89b616-0357-4c10-b7bf-335d22c6fc12');

    searchLog(outLogPath, '8f187bb0-41bb-4793-b815-0a405aec1e83');
    searchLog(errorLogPath, '8f187bb0-41bb-4793-b815-0a405aec1e83');
}

main().catch(console.error);
