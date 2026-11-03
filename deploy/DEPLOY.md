# Deploying Guinhawa online

Local XAMPP is the reference install; this guide only adds a public copy. The
front end is static React. The API is PHP 8 + MySQL, so it needs a host that
runs PHP — Vercel alone cannot.

## What each host can do

| Host | Can serve the React build | Can serve the PHP API + MySQL | Can call a cross-origin API |
| --- | --- | --- | --- |
| Vercel | Yes | **No** | n/a |
| HelioHost (free) | Yes | Yes | **Yes** |
| GoogieHost (free) | Yes | Yes | Usually; not documented |
| InfinityFree (free) | Yes | Yes | **No — CORS from other domains is blocked by policy** |
| AwardSpace (free) | Yes | Yes | No HTTPS on the free plan |

Consequences:

- **InfinityFree can only host the whole app on one domain.** It cannot be the
  backend for `guinhawa.vercel.app`, no matter what headers the PHP sends.
- To keep the Vercel address, host the API on **HelioHost** (recommended) and
  point Vercel at it with `VITE_API_URL`.
- The simplest free option is to host **everything** on one free PHP host and
  skip the split entirely (Path B).

The code already supports both: `app/src/api.js` reads `VITE_API_URL`, and the
PHP API sends CORS headers only for the exact origins you list.

---

## Path A — keep Vercel, host the API on HelioHost (recommended)

HelioHost is a non-profit free host that explicitly allows small JSON APIs,
provides PHP 8, MySQL/MariaDB and free Let's Encrypt SSL, and does not block
cross-origin requests. Free signups on the **Johnny** server open twice a day
(00:00 and 12:00 UTC) and fill quickly; a one-time $2 donation opens **Tommy**
immediately.

### A1. Create the hosting account

1. Sign up at <https://heliohost.org> and pick a subdomain, for example
   `guinhawa.helioho.st`.
2. In **Plesk → Websites & Domains → PHP Settings**, select PHP 8.2 or newer.
3. In **Plesk → SSL It!**, issue a free Let's Encrypt certificate for the
   subdomain. HTTPS is required for cross-site cookies (`SameSite=None`).

### A2. Upload the API

Upload the **contents of `backend/`** into `httpdocs` (Plesk File Manager →
upload a zip → extract). The result must look like:

```
httpdocs/
  bootstrap.php
  api/index.php
  api/.htaccess
  config/config.php
  src/*.php
```

Ignore `backend/schema.sql`, `backend/scripts/` and `backend/uploads/` — they
are not needed online.

Do **not** upload the React build here; Vercel serves it.

### A3. Create the database

1. **Plesk → Databases → Add Database**. Note the generated name, user and
   password; host is usually `localhost`.
2. **phpMyAdmin → Import** → `deploy/guinhawa_db.hosting.sql` into that
   database. It creates the 18 tables and the 202-product catalogue.
3. Keep your real data: export `guinhawa_db` from local phpMyAdmin and import
   that export **instead** — it already contains your admin, employees, sales
   and stock.
4. If you used the catalogue-only file, create the admin with
   `deploy/create-admin.sql` (follow the instructions in that file).

### A4. Point the API at the database and Vercel

1. Copy `deploy/config.local.example.php` to `backend/config/config.local.php`
   on the server (Plesk File Manager → create file) and fill in:
   - the database host/name/user/password;
   - `allowed_origins` = `https://guinhawa.vercel.app`;
   - `same_site` = `None`, `secure` = `1`.
2. Test it in a browser or with curl:

   ```text
   https://guinhawa.helioho.st/api/auth/me
   ```

   Expected: `401` with `{"error":"Please sign in to continue.","code":"UNAUTHENTICATED"}`.
   A `404` means the file layout is wrong; a `500` means the database settings
   in `config.local.php` are wrong.

3. In **Vercel → Project → Settings → Environment Variables**, add:

   ```text
   VITE_API_URL = https://guinhawa.helioho.st/api
   ```

4. Redeploy (Deployments → ⋯ → Redeploy, or push a commit). Vite bakes the
   variable in at build time, so an existing deployment will not pick it up.

5. Sign in at <https://guinhawa.vercel.app>. If the red screen says the API was
   not found, the URL or the redeploy is wrong. If the browser console shows a
   CORS error, `allowed_origins` does not exactly match the page origin
   (scheme + host, no trailing slash).

Optional: PHP environment variables can replace `config.local.php` if the host
supports them:

```text
GUINHAWA_DB_HOST, GUINHAWA_DB_PORT, GUINHAWA_DB_NAME,
GUINHAWA_DB_USER, GUINHAWA_DB_PASSWORD,
GUINHAWA_ALLOWED_ORIGINS=https://guinhawa.vercel.app,
GUINHAWA_COOKIE_SAMESITE=None, GUINHAWA_COOKIE_SECURE=1
```

---

## Path B — host everything on one free PHP host (simplest)

Use this with **InfinityFree**, GoogieHost, or HelioHost. Because the React app
and the PHP API share one domain, no CORS or cross-site cookies are involved.

1. Build the front end for a domain root:

   ```powershell
   npm run build:vercel
   ```

   (The script name is historical — it simply builds with base `/`.)

2. Upload to the host's web root (`htdocs` / `httpdocs`):
   - everything in `dist/` (so `index.html` is at the domain root);
   - the contents of `backend/` in a `backend/` folder;
   - the `.htaccess` below at the web root.

3. Import the database as in A3 and create `backend/config/config.local.php`
   with only the `db` settings (leave CORS empty and `same_site` at `Lax`).

4. Root `.htaccess` (Apache; replace `guinhawa/` with the folder you used if the
   site is not at the domain root):

   ```apache
   RewriteEngine On

   # API -> PHP front controller
   RewriteRule ^backend/api/(.*)$ backend/api/index.php [QSA,L]

   # React single-page app deep links
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule ^ index.html [QSA,L]
   ```

5. The front end calls `/backend/api` only if you set
   `VITE_API_URL=/backend/api` **before** building. Otherwise put the backend at
   the domain root and leave the build alone. The cleanest layout is:

   ```text
   index.html + assets/   (from dist/)
   api/index.php          (from backend/)
   config/, src/, bootstrap.php
   ```

   and upload `backend/` contents directly to the web root. Then the default
   `/api` path works with no extra variables.

Notes:

- On InfinityFree, enable the free SSL certificate before using the site.
- Free hosts inspect uploads; if a zip is rejected, upload the files with FTP.

---

## Verifying after either path

1. `https://<api-host>/api/auth/me` returns `401` JSON, not HTML and not 404.
2. The page loads with `Ctrl+F5`.
3. Sign in with the admin account, then change the temporary password.
4. Record a stock-in and check that the dashboard updates — that proves the
   database is writable.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `The PHP API was not found at ...` | `VITE_API_URL` wrong, or Vercel not redeployed |
| `The API at ... did not return JSON` | Host returned an HTML error/404 page |
| `Cannot reach the server` | API host down, wrong scheme, or blocked by the host |
| CORS error in DevTools | `allowed_origins` mismatch, or the host blocks CORS (InfinityFree) |
| Login succeeds then immediately logs out | Cookie needs `SameSite=None` + `Secure` + HTTPS |
| `500` on every request | Database credentials in `config.local.php` |

## Security

- `backend/config/config.local.php` is git-ignored; never commit real
  credentials.
- `deploy/create-admin.sql` contains no password unless you put one there.
- Remove `deploy/` and `backend/scripts/` from the server after setup.
