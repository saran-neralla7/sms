const fs = require('fs');
const path = require('path');

function main() {
    const dumpPath = path.join(__dirname, '../db_backup_pre_faculty_migration.dump');
    if (!fs.existsSync(dumpPath)) {
        console.log("Dump not found.");
        return;
    }
    const content = fs.readFileSync(dumpPath, 'utf8');
    console.log("Dump content read. Size:", content.length);
    // Find all occurrences of student roll numbers
    const rolls = ['5241421001', '5241421066', '5241421071'];
    rolls.forEach(r => {
        const idx = content.indexOf(r);
        if (idx !== -1) {
            console.log(`Found ${r} at index ${idx}. Context:`);
            console.log(content.substring(Math.max(0, idx - 100), Math.min(content.length, idx + 200)));
        } else {
            console.log(`Roll ${r} not found.`);
        }
    });
}

main();
