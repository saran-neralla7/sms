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
    
    // Look for lines containing BHP's user ID or "BHP"
    const bhpUserId = "c4985b43-92e8-49d4-994d-9febe305491b";
    
    console.log("=== Matching lines in last 30,000 lines ===");
    const recentLines = lines.slice(-30000);
    recentLines.forEach((line, idx) => {
        if (line.includes(bhpUserId) || line.includes("BHP") || line.includes("Bh Padma")) {
            const actualLineNum = lines.length - 30000 + idx + 1;
            console.log(`Line ${actualLineNum}: ${line}`);
        }
    });
}

main();
