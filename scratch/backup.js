const { execSync } = require('child_process');
try {
    console.log("Starting DB backup...");
    execSync('pg_dump -U postgres -d stu_mgmt_db -F c -b -v -f /home/gvp/student-management-system/scratch/stu_mgmt_db_pre_oe_paper.dump');
    console.log("Backup created successfully!");
} catch (e) {
    console.error("Backup warning:", e.message);
}
