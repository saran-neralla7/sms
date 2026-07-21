const fs = require('fs');

function searchEnd(filePath, keyword) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const lastLines = lines.slice(-15000);
    console.log(`\n=== Matches for '${keyword}' in last 15000 lines of ${filePath} ===`);
    let count = 0;
    const matches = [];
    lastLines.forEach((line, idx) => {
        if (line.toLowerCase().includes(keyword.toLowerCase())) {
            matches.push({
                lineNum: lines.length - 15000 + idx + 1,
                content: line
            });
            count++;
        }
    });
    console.log(`Found ${count} matches. Showing last 20:`);
    matches.slice(-20).forEach(m => {
        console.log(`Line ${m.lineNum}: ${m.content}`);
    });
}

async function main() {
    const errorLogPath = '/home/gvp/.pm2/logs/sms-system-error.log';
    const outLogPath = '/home/gvp/.pm2/logs/sms-system-out.log';

    console.log("Searching logs...");
    searchEnd(outLogPath, 'CS2104');
    searchEnd(outLogPath, 'CS2108');
    searchEnd(outLogPath, 'Padma');
    searchEnd(outLogPath, 'BHP');
    searchEnd(outLogPath, 'attendance/check');
    searchEnd(outLogPath, 'Attendance Submission Payload');
    searchEnd(errorLogPath, 'attendance');
    searchEnd(errorLogPath, 'error');
}

main().catch(console.error);
