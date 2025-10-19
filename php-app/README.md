# ParentIDPassport PHP Portal

This directory contains a minimal PHP web host that serves the ParentIDPassport single-page portal and administration console. The runtime delivers static assets from `wwwroot/` and exposes a hardened JSON endpoint for persisting portal configuration to `wwwroot/config.json`.

## Running locally

```bash
cd php-app
php -S localhost:8000 index.php
```

The built-in PHP server will serve assets from `wwwroot/` and handle `POST /save-config.ashx` requests from the administrator console.

Open `http://localhost:8000/index.html` to view the public portal or `http://localhost:8000/admin.html` for the console.

> **Note** Ensure the process has write access to `wwwroot/config.json` so that configuration updates from the administrator console can be saved.

## Administrator bootstrap credentials

The initial configuration ships with the following credentials:

- **Username:** `portal-admin`
- **Password:** `ChangeMe!123`

The administrator console hashes the password locally using the stored salt. You should change these values immediately after deployment.

## Configuration payload

`config.json` tracks Azure AD B2C settings, branding, authentication preferences, role-based links, and salted administrator credentials. The admin console pushes updates to the service worker so other tabs can pick up changes instantly—even while offline.
