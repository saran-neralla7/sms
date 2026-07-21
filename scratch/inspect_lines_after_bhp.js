const fs = require('fs');

function main() {
    const outLogPath = '/home/gvp/.pm2/logs/sms-system-out.log';
    const errLogPath = '/home/gvp/.pm2/logs/sms-system-error.log';

    if (fs.existsSync(outLogPath)) {
        const lines = fs.readFileSync(outLogPath, 'utf8').split('\n');
        console.log("=== OUT LOG AFTER LINE 194366 ===");
        console.log(lines.slice(194365, 194365 + 100).join('\n'));
    }

    if (fs.existsSync(errLogPath)) {
        const lines = fs.readFileSync(errLogPath, 'utf8').split('\n');
        console.log("\n=== ERROR LOG END LINES ===");
        console.log(lines.slice(-100).join('\n'));
    }
}

main();
