# Restaurant POS Project Documentation

Last updated: 2026-07-16

## 1. Project Overview

Restaurant POS is a full-stack restaurant management system with a React frontend and Node.js backend. The repository is not a scaffold; it contains an existing application with working authentication and several connected CRUD modules.

## 2. Repository Structure

```text
Restaurant POS/
  frontend/        React, Vite, TypeScript, Tailwind CSS
  backend/         Node.js, Express, TypeScript, Prisma, Socket.IO
  scripts/         Backup/restore helper scripts
  docs/            This documentation file
  package.json     Root scripts
  docker-compose.yml
  README.md
```

## 3. Technology Stack

Frontend:
- React
- Vite
- TypeScript
- Tailwind CSS
- React Router
- Axios
- Lucide React

Backend:
- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Socket.IO
- Zod
- Cookie-based JWT authentication

## 4. Verified Local Status

Verified:
- Backend is Node.js based.
- Authentication is wired to the frontend.
- Admin login works locally.
- Starter restaurant data exists.
- Tables CRUD is connected and backend verified.
- Menu item create/update is connected and backend verified.
- Staff create/update/status is connected and backend verified.
- Inventory category/location/supplier/item create and item update are connected and backend verified.
- Full production build passes.

Not verified as production-ready:
- Complete restaurant-day workflow.
- Backup restore into an isolated database.
- Hardware printing.
- Staff UAT.
- Full automated test suite.

Launch status: NOT READY.

## 5. Local Credentials

Development admin:

```text
Email: admin@restaurant.local
Password: Admin@12345
```

Change this password before any real deployment.

## 6. Common Commands

Use `cmd /c npm` in PowerShell if `npm.ps1` is blocked.

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

Prisma:

```powershell
cmd /c npm --prefix backend run db:validate
cmd /c npm --prefix backend run db:generate
cmd /c npm --prefix backend run db:status
cmd /c npm --prefix backend run db:seed
```

Health checks:

```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/health/live
Invoke-RestMethod -Uri http://localhost:5000/api/health/ready
```

## 7. Connected Modules

| Module | Current state |
|---|---|
| Authentication | Connected to backend login/session APIs |
| Tables | CRUD connected; safe delete blocks tables with history |
| Menu | Menu item create/update/availability connected |
| Staff | Create/update/roles/status connected |
| Inventory | Items/categories/locations/suppliers connected |
| Setup checklist | Connected |
| QR Codes | API calls present; needs manual workflow testing |
| Payments | Partial; needs workflow verification |
| Receipts | Partial; needs workflow verification |
| Cashier Sessions | Partial; needs workflow verification |
| Reports | UI exists; endpoint/export verification still needed |

## 8. Known Limitations

- Orders page is not a complete waiter workflow yet.
- Kitchen route currently does not provide real KDS tickets.
- Inventory receipts, opening balances, adjustments, wastage, and stock counts need complete UI/workflow verification.
- Payments need duplicate prevention and full cashier flow verification.
- Receipts need snapshot/reprint/print verification.
- Cashier sessions need complete open/close/variance testing.
- Shifts, attendance, and handovers are partial.
- Public ordering and QR table ordering need full workflow verification.
- No complete automated test suite exists.
- Hardware has not been tested.

## 9. Completion Plan

Priority 1:
- Finish waiter order creation.
- Send submitted items to kitchen exactly once.
- Implement real Kitchen Display tickets and status actions.
- Connect payment request, payment processing, receipt generation, order close, and table release.

Priority 2:
- Complete stock opening balances.
- Complete stock receipts and posting.
- Verify immutable stock movements for receipts, wastage, adjustments, and order consumption.
- Add inventory integrity tests.

Priority 3:
- Complete cashier session workflow.
- Verify cash expected amount, refunds, expenses, safe drops, closing count, and variance.

Priority 4:
- Complete reporting verification.
- Add CSV/XLSX/PDF tests where exports exist.
- Remove or clearly label non-audited reports.

Priority 5:
- Add automated tests for auth, authorization, restaurant isolation, tables, menu, staff, inventory, orders, kitchen, payments, receipts, and cashier sessions.

Priority 6:
- Run backup and restore into an isolated database.
- Test production env configuration.
- Test real printers/cash drawer/scanners.
- Run staff UAT.

## 10. Backup And Restore

Scripts exist in `scripts/`, but restore must only be tested against an isolated database.

```powershell
bash scripts/backup-database.sh
bash scripts/restore-database.sh <backup-file>
```

Do not restore over the active development or production database.

## 11. Security Notes

- Do not commit `.env` files.
- Do not expose database URLs, JWT secrets, SMTP credentials, cookies, or tokens.
- Backend authorization must remain authoritative.
- Do not weaken restaurant isolation to make UI work.
- Use secure cookies and strict production CORS before deployment.

## 12. Launch Checklist

Before controlled pilot:
- Core order workflow passes.
- Kitchen workflow passes.
- Payment and receipt workflow passes.
- Inventory movement workflow passes.
- Cashier close workflow passes.
- Backup and isolated restore pass.
- Security and restaurant isolation tests pass.
- Real staff UAT is completed.

Before full launch:
- Production infrastructure configured.
- Hardware tested.
- Real restaurant data configured.
- Legal/privacy/management reviews completed.
- No software blockers remain.

