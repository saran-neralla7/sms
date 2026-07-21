const fs = require('fs');

function main() {
    const errLogPath = '/home/gvp/.pm2/logs/sms-system-error.log';
    if (!fs.existsSync(errLogPath)) {
        console.log("No error log found.");
        return;
    }
    const content = fs.readFileSync(errLogPath, 'utf8');
    const lines = content.split('\n');
    console.log(`Total lines in error log: ${lines.length}`);
    
    // Print lines from the last 2000 lines of the error log that match Prisma or unique constraint
    console.log("=== Errors in last 2000 lines ===");
    const recentLines = lines.slice(-2000);
    let inError = false;
    let errorLines = [];
    
    recentLines.forEach((line, idx) => {
        if (line.includes('Error') || line.includes('Prisma') || line.includes('Failed to')) {
            inError = true;
            errorLines.push(`--- Line ${lines.length - 2000 + idx + 1} ---`);
        }
        if (inError) {
            errorLines.push(line);
            if (errorLines.length > 30) {
                // print and reset to avoid huge output
                console.log(errorLines.join('\n'));
                errorLines = [];
                inError = false;
            }
        }
    });
    if (errorLines.length > 0) {
        console.log(errorLines.join('\n'));
    }
}

main();
