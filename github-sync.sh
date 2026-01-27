#!/bin/bash

# Simple script to sync changes to GitHub

echo "Starting synchronization..."

# 1. Add all changes
git add .

# 2. Ask for a commit message
echo "Enter a description of your changes:"
read message

# Default message if empty
if [ -z "$message" ]; then
  message="update: routine backup"
fi

# 3. Commit
git commit -m "$message"

# 4. Push
echo "Pushing to GitHub..."
git push origin main

echo "Done! Your code is safely backed up on GitHub."
