#!/bin/bash

# ==========================================
# GVP SMS System - Automated Backup Script
# ==========================================
# This script creates a daily backup of:
# 1. PostgreSQL Database
# 2. Student Photos (public/student-photos)
# 3. Environment Config (.env)
# ==========================================

# Configuration
# Adjust these paths for your Ubuntu Server
APP_DIR="/home/ubuntu/sms-system"
BACKUP_DIR="/home/ubuntu/backups"
DB_NAME="gvp_sms_db"
DB_USER="gvp_user"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
TODAY_DIR="$BACKUP_DIR/$TIMESTAMP"

# Create Backup Directory
mkdir -p "$TODAY_DIR"
echo "[+] Starting Backup at $TIMESTAMP"

# 1. Backup Database
echo "[1/3] Dumping Database..."
if pg_dump -h localhost -U $DB_USER $DB_NAME > "$TODAY_DIR/db_dump.sql"; then
    gzip "$TODAY_DIR/db_dump.sql"
    echo "    -> Database dumped and compressed."
else
    echo "    [ERROR] Database dump failed!"
fi

# 2. Backup Photos
echo "[2/3] Archiving Student Photos..."
if [ -d "$APP_DIR/public/student-photos" ]; then
    tar -czf "$TODAY_DIR/photos_archive.tar.gz" -C "$APP_DIR/public" student-photos
    echo "    -> Photos archived."
else
    echo "    [WARNING] No student-photos folder found at $APP_DIR/public/student-photos"
fi

# 3. Backup Config
echo "[3/3] Backing up Configuration..."
if [ -f "$APP_DIR/.env" ]; then
    cp "$APP_DIR/.env" "$TODAY_DIR/.env.backup"
    echo "    -> .env backed up."
fi

# 4. Create master archive
FINAL_ARCHIVE="$BACKUP_DIR/full_backup_$TIMESTAMP.tar.gz"
tar -czf "$FINAL_ARCHIVE" -C "$BACKUP_DIR" "$TIMESTAMP"
rm -rf "$TODAY_DIR" # Remove temporary folder

echo "[+] Backup Completed Successfully: $FINAL_ARCHIVE"
echo "    Size: $(du -h "$FINAL_ARCHIVE" | cut -f1)"

# 5. Cleanup (Keep last 7 days)
echo "[+] Cleaning up old backups..."
find "$BACKUP_DIR" -name "full_backup_*.tar.gz" -mtime +7 -delete
