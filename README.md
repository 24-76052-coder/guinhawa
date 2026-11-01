# Guinhawa Poultry Supply

A role-based inventory and point-of-sale system for Guinhawa Poultry Supply, built with React, PHP, and MySQL/MariaDB.

## Technology

- React + Vite frontend
- PHP API
- MySQL/MariaDB database
- XAMPP development and deployment environment
- SweetAlert2 dialogs and Bootstrap Icons

## Workspace roles

- **Admin**: dashboard, products, inventory, staff, sales, reports, and settings
- **Inventory Staff**: inventory, stock movements, and inventory monitoring
- **Cashier/Counter Staff**: products, POS sales, receipts, and attendance

## Local development

```powershell
npm install
npm run dev
```

Vite is available at `http://localhost:5173`. The PHP API is served by XAMPP at `/guinhawa/api`.

## Production build

```powershell
npm run build
```

The build output is written to `dist/` and is deployed under `C:\xampp2\htdocs\guinhawa`.

## Database setup

The database configuration is in `backend/config/config.php`.

```powershell
node scripts/build-sql.mjs
C:\xampp2\php\php.exe backend/scripts/setup_admin.php
```

Import `guinhawa_db.sql` into phpMyAdmin or MySQL before creating the first administrator.

## Project structure

```text
app/               React source and styles
backend/           PHP API, controllers, configuration, and schema
data/              Source product workbook
public/            Files copied directly into builds
scripts/           Database SQL generation utility
dist/              Generated production frontend
guinhawa_db.sql    Complete database import
```

Operational records, products, stock, sales, employees, attendance, and settings are stored in MySQL/MariaDB. Theme preference and opening-animation state are the main browser-local values.
