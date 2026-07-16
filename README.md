# Restaurant POS

A full-stack restaurant point-of-sale and management system.

## Structure

```text
frontend/   React, Vite, TypeScript, Tailwind CSS
backend/    Node.js, Express, TypeScript, Prisma, PostgreSQL
docs/       Consolidated project documentation
scripts/    Backup and restore helper scripts
```

## Documentation

All project documentation is consolidated here:

[docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md)

## Local Login

Development admin:

```text
Email: admin@restaurant.local
Password: Admin@12345
```

Change this before any real deployment.

## Commands

Use `cmd /c npm` on PowerShell if `npm.ps1` is blocked.

Install:

```powershell
cmd /c npm run install:all
```

Build:

```powershell
cmd /c npm run build
```

Start backend:

```powershell
cmd /c npm run start:backend
```

Start frontend:

```powershell
cmd /c npm run dev:frontend
```

Open:

```text
http://localhost:5173/login
```

## Current Status

Verified connected modules:
- Authentication
- Tables CRUD
- Menu item create/update/availability
- Staff create/update/roles/status
- Inventory items/categories/locations/suppliers

Not launch-ready yet:
- Orders workflow
- Kitchen Display System
- Payments and receipts workflow
- Cashier close workflow
- Full inventory movement workflow
- Backup/restore verification
- Hardware testing
- Automated tests

