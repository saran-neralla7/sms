const fs = require('fs');

function main() {
    const outLogPath = '/home/gvp/.pm2/logs/sms-system-out.log';
    if (!fs.existsSync(outLogPath)) {
        console.log("No out log found.");
        return;
    }
    const content = fs.readFileSync(outLogPath, 'utf8');
    const lines = content.split('\n');
    console.log(`Total lines: ${lines.length}`);
    
    const recentLines = lines.slice(-25000);
    recentLines.forEach((line, idx) => {
        if (line.includes('Attendance Submission Payload:')) {
            const actualLineNum = lines.length - 25000 + idx + 1;
            console.log(`\n--- Payload at line ${actualLineNum} ---`);
            // Print the next 15 lines
            for (let j = 0; j < 15; j++) {
                if (actualLineNum + j <= lines.length) {
                    console.log(lines[actualLineNum + j - 1]);
                }
            }
        }
    });
}

main();
