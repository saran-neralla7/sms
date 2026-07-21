const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function checkBackup(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const results = {};
    for await (const line of rl) {
        if (line.includes('5241421001') || line.includes('5241421066') || line.includes('5241421071')) {
            if (line.includes('ALLA YASASWI') || line.includes('MULAVEESALA') || line.includes('NAMBURI')) {
                const parts = line.split('\t');
                if (parts.length > 8) {
                    const roll = parts[1];
                    const name = parts[2];
                    const yr = parts[4];
                    const sem = parts[5];
                    const sec = parts[7];
                    results[roll] = { name, yr, sem, sec };
                }
            }
        }
    }
    return results;
}

async function main() {
    const backupDir = path.join(__dirname, '../backups');
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql')).sort();
    
    for (const file of files) {
        const filePath = path.join(backupDir, file);
        const res = await checkBackup(filePath);
        console.log(`Backup: ${file}`);
        console.log(res);
    }
}

main().catch(console.error);
