const fs = require('fs');

function main() {
    const outLogPath = '/home/gvp/.pm2/logs/sms-system-out.log';
    if (!fs.existsSync(outLogPath)) {
        console.log("No out log found.");
        return;
    }
    const content = fs.readFileSync(outLogPath, 'utf8');
    const lines = content.split('\n');
    console.log(`Total lines in out log: ${lines.length}`);
    console.log("=== Last 300 lines of out log ===");
    console.log(lines.slice(-300).join('\n'));
}

main();
