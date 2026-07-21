const fs = require('fs');

function main() {
    const errorLogPath = '/home/gvp/.pm2/logs/sms-system-error.log';
    if (!fs.existsSync(errorLogPath)) {
        console.log("No error log found.");
        return;
    }
    const content = fs.readFileSync(errorLogPath, 'utf8');
    const lines = content.split('\n');
    console.log(`Total lines in error log: ${lines.length}`);
    console.log("=== Last 300 lines of error log ===");
    console.log(lines.slice(-300).join('\n'));
}

main();
