# ParentIDPassport PHP Portal

This directory contains a minimal PHP web host that serves the ParentIDPassport single-page portal and administration console. The runtime is designed to run directly from your web server's document root (for example `public_html/`) and exposes a hardened JSON endpoint for persisting portal configuration to `config.json` in that directory.

## Running locally

```bash
cd php-app/public_html
php -S localhost:8000 index.php
```

The built-in PHP server will serve assets from the current directory and handle `POST /save-config.ashx` requests from the administrator console.

Open `http://localhost:8000/index.html` to view the public portal or `http://localhost:8000/admin.html` for the console.

> **Note** Ensure the process has write access to `config.json` so that configuration updates from the administrator console can be saved.

## Deploying to shared hosting

Upload the contents of the `public_html/` directory directly into the document root supplied by your provider (commonly also named `public_html/`). The structure should resemble:

```
public_html/
├── admin.html
├── config.json
├── images/
├── index.html
├── index.php
├── manifest.json
├── scripts/
├── service-worker.js
└── styles.css
```

With this layout `index.php` sits alongside the rest of the portal assets, allowing the application to run without any custom rewrite rules.

## Administrator bootstrap credentials

The initial configuration ships with the following credentials:

- **Username:** `portal-admin`
- **Password:** `ChangeMe!123`

The administrator console hashes the password locally using the stored salt. You should change these values immediately after deployment.

## Configuration payload

`config.json` tracks Azure AD B2C settings, branding, authentication preferences, role-based links, and salted administrator credentials. The admin console pushes updates to the service worker so other tabs can pick up changes instantly—even while offline.
