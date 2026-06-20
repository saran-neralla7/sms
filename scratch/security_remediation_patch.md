# Security Remediation Patches (Zero Data Loss)

This file contains the precise replacements to apply to the codebase when the user requests the security fixes to be deployed.

---

## 1. Student Profile IDOR Fix
**File:** `src/app/api/students/[id]/route.ts`

### Target Content:
```typescript
        const isGlobalAdmin = ["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);
        if (!isGlobalAdmin) {
            if (role === "USER" && student.departmentId !== departmentId) {
                // Maybe stricter for students? But requirements say "Students Page" is view only.
                // If Middleware allows navigation to list, they can see this.
                // let's match department constraint.
                if (student.departmentId !== departmentId) {
                    return NextResponse.json({ error: "Access denied" }, { status: 403 });
                }
            } else if (role === "HOD") {
                if (student.departmentId !== departmentId) {
                    return NextResponse.json({ error: "Access denied" }, { status: 403 });
                }
            }
        }
```

### Replacement Content:
```typescript
        const isGlobalAdmin = ["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);
        if (!isGlobalAdmin) {
            if (role === "STUDENT") {
                if (student.rollNumber.toUpperCase() !== session.user.username.toUpperCase()) {
                    return NextResponse.json({ error: "Access denied" }, { status: 403 });
                }
            } else if (role === "USER" && student.departmentId !== departmentId) {
                // Maybe stricter for students? But requirements say "Students Page" is view only.
                // If Middleware allows navigation to list, they can see this.
                // let's match department constraint.
                if (student.departmentId !== departmentId) {
                    return NextResponse.json({ error: "Access denied" }, { status: 403 });
                }
            } else if (role === "HOD") {
                if (student.departmentId !== departmentId) {
                    return NextResponse.json({ error: "Access denied" }, { status: 403 });
                }
            }
        }
```

---

## 2. Mid Exam Marks Grid Authorization Fix
**File:** `src/app/api/mid-exam/marks/route.ts`

### Target Content (GET):
```typescript
// GET marks grid for a paper
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

### Replacement Content (GET):
```typescript
// GET marks grid for a paper
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  const allowedRoles = ["ADMIN", "HOD", "DIRECTOR", "PRINCIPAL", "FACULTY"];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
```

### Target Content (POST):
```typescript
// POST — save/update marks (draft or final)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

### Replacement Content (POST):
```typescript
// POST — save/update marks (draft or final)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  const allowedRoles = ["ADMIN", "HOD", "DIRECTOR", "PRINCIPAL", "FACULTY"];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
```

---

## 3. Mid Exam Paper Creation Authorization Fix
**File:** `src/app/api/mid-exam/papers/route.ts`

### Target Content:
```typescript
// POST — create a new question paper
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

### Replacement Content:
```typescript
// POST — create a new question paper
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  const allowedRoles = ["ADMIN", "HOD", "DIRECTOR", "PRINCIPAL", "FACULTY"];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
```

---

## 4. Circular Upload Security Patch
**File:** `src/app/api/upload-circular/route.ts`

### Target Content:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { mkdir } from "fs/promises";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
```

### Replacement Content:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { mkdir } from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const role = (session.user as any).role;
        const allowedRoles = ["ADMIN", "HOD", "DIRECTOR", "PRINCIPAL", "OFFICE"];
        if (!allowedRoles.includes(role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const originalName = file.name;
        const extension = originalName.substring(originalName.lastIndexOf('.')).toLowerCase();
        const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
        if (!allowedExtensions.includes(extension)) {
            return NextResponse.json({ error: "Invalid file type. Only PDF and images are allowed." }, { status: 400 });
        }
```

---

## 5. Photo Upload Extension Whitelist Fix
**File:** `src/pages/api/upload-photos.ts`

### Target Content:
```typescript
        for (const file of fileArray) {
            try {
                const originalName = file.originalFilename || file.newFilename;
                const rollNumber = path.parse(originalName).name.toUpperCase();
```

### Replacement Content:
```typescript
        for (const file of fileArray) {
            try {
                const originalName = file.originalFilename || file.newFilename;
                const ext = path.extname(originalName).toLowerCase();
                const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
                if (!allowedExtensions.includes(ext)) {
                    results.push({ file: originalName, status: "error", message: "Invalid file type. Only images are allowed." });
                    fs.unlinkSync(file.filepath);
                    failCount++;
                    continue;
                }
                const rollNumber = path.parse(originalName).name.toUpperCase();
```

---

## 6. Faculty Photo Upload Extension Whitelist Fix
**File:** `src/pages/api/upload-faculty-photos.ts`

### Target Content:
```typescript
        for (const file of fileArray) {
            try {
                const originalName = file.originalFilename || file.newFilename;
                const baseName = path.parse(originalName).name.toUpperCase();
```

### Replacement Content:
```typescript
        for (const file of fileArray) {
            try {
                const originalName = file.originalFilename || file.newFilename;
                const ext = path.extname(originalName).toLowerCase();
                const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
                if (!allowedExtensions.includes(ext)) {
                    results.push({ file: originalName, status: "error", message: "Invalid file type. Only images are allowed." });
                    fs.unlinkSync(file.filepath);
                    failCount++;
                    continue;
                }
                const baseName = path.parse(originalName).name.toUpperCase();
```

---

## 7. Dynamic Shell Script Environment Variables Fallback Fix
**File:** `scripts/backup_db.sh`

### Target Content:
```bash
# Extract credentials directly to avoid URL parsing issues with special chars in password
export PGHOST="localhost"
export PGPORT="5432"
export PGUSER="gvp_admin"
export PGPASSWORD="gvpet@2026"
export PGDATABASE="stu_mgmt_db"
```

### Replacement Content:
```bash
# Extract credentials directly to avoid URL parsing issues with special chars in password
export PGHOST=${PGHOST:-"localhost"}
export PGPORT=${PGPORT:-"5432"}
export PGUSER=${PGUSER:-"gvp_admin"}
export PGPASSWORD=${PGPASSWORD:-"gvpet@2026"}
export PGDATABASE=${PGDATABASE:-"stu_mgmt_db"}
```
