const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function main() {
    // We will inspect the latest backup from backups directory
    const backupFile = path.join(__dirname, '../backups/backup_2026-07-18_02-00-01.sql');
    if (!fs.existsSync(backupFile)) {
        console.log("Backup file does not exist:", backupFile);
        return;
    }

    console.log("Reading backup file:", backupFile);

    const fileStream = fs.createReadStream(backupFile);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    for await (const line of rl) {
        if (line.includes('5241421066') || line.includes('5241421001') || line.includes('5241421071')) {
            console.log(line);
            count++;
            if (count > 20) {
                break;
            }
        }
    }
}

main().catch(console.error);
