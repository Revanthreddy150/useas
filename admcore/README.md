# USEAS Admin Control Panel — Cloudflare Worker Gatekeeper Architecture

Secure, server-side Bcrypt password gatekeeper designed specifically for **GitHub Pages** (static hosting) paired with **Cloudflare Workers** edge execution.

---

## 🔒 Security Architecture

```
                                      +---------------------------------------------+
                                      |             Client Web Browser              |
                                      +----------------------+----------------------+
                                                             |
                                                             v
+-------------------------------------------------------------------------------------------------------------------+
|                                       CLOUDFLARE WORKER EDGE GATEKEEPER                                           |
|                                                                                                                   |
|  1. /admin-login.html           --> Serves single-field password login gateway.                                   |
|  2. POST /api/login             --> Server-side Bcrypt comparison against 3 authorized hashes.                     |
|                                     Issues HttpOnly, Secure, SameSite=Lax HMAC-SHA256 session cookie.              |
|                                     Enforces Brute-force rate limiting (Lockout after 5 failed tries).            |
|  3. Protected Admin Pages       --> Validates session token signature & expiration.                               |
|     (/, /index.html, feature*)      If INVALID / MISSING: Blocks access & immediately 302 redirects to login.     |
|                                     If VALID: Fetches requested page from GitHub Pages origin & returns it.        |
|  4. /admin/logout               --> Clears session cookie & redirects to login.                                   |
+----------------------------------------------------+--------------------------------------------------------------+
                                                     | (Only authenticated requests)
                                                     v
                                  +--------------------------------------+
                                  |         GitHub Pages Origin          |
                                  | (feedback, letter, notifications,    |
                                  |  paper, study, ultraabhyaslab)       |
                                  +--------------------------------------+
```

### Key Security Guarantees:
- **No Plain-Text Passwords**: Passwords exist nowhere in code.
- **Server-Side Bcrypt Only**: Verification happens strictly at the Cloudflare Edge before any HTML is returned. A user inspecting DevTools can never see or bypass authentication.
- **Direct Access Protection**: Anyone trying to open any `.html` file directly is blocked at the edge and redirected to `/admin-login.html`.
- **HttpOnly Cookies**: Session cookies cannot be accessed or stolen via JavaScript (`document.cookie`).
- **Brute-Force Rate Limiting**: Maximum 5 attempts per 15 minutes before temporary lockout.

---

## 🔑 The 3 Authorized Admin Password Hashes

The Worker matches any one of the following 3 Bcrypt hashes:

1. **Admin Password Hash 1:** `$2y$10$bHElaZPj7kxXbYE5TUYVMu4xZAxSJMXpLbh2b7nrQ62S1scfvMp8G`
2. **Admin Password Hash 2:** `$2y$10$5ZSQbytvy4tFnwYZkiF1NuO.5HsvQ9tHpvGO2lMIQ3LAjI7m1rVAq`
3. **Admin Password Hash 3:** `$2y$10$Q.CqKi/RIZ2Uk5x.CDQaNO8plNDccaaaOIdRH7w2S77nxA717BGKO`

---

## 📂 Project Structure

| File | Purpose |
|---|---|
| [`admin-login.html`](admin-login.html) | Modern single-field password login page with show/hide toggle and rate-limiting alerts. |
| [`index.html`](index.html) | Unified Admin Hub dashboard linking to all 6 feature pages with session indicator & logout. |
| [`feedbackadmin.html`](feedbackadmin.html) | Moderation & approvals for user reviews (with universal nav & logout). |
| [`letterhubadmin.html`](letterhubadmin.html) | Official letter format generator (with universal nav & logout). |
| [`notificationsadmin.html`](notificationsadmin.html) | System notification broadcaster & quiz creator (with universal nav & logout). |
| [`paperhubadmin.html`](paperhubadmin.html) | Question paper repository & file upload manager (with universal nav & logout). |
| [`studyhubadmin.html`](studyhubadmin.html) | Curriculum directory & notes hierarchy (with universal nav & logout). |
| [`ultraabhyaslabadmin.html`](ultraabhyaslabadmin.html) | Master control room for test keys & passcodes (with universal nav & logout). |
| [`cloudflare-worker.js`](cloudflare-worker.js) | Cloudflare Worker gatekeeper script (for Wrangler CLI deployment). |
| [`cloudflare-worker-bundle.js`](cloudflare-worker-bundle.js) | Standalone single-file bundle with embedded Bcrypt (ready for Cloudflare Dashboard copy-paste). |
| [`wrangler.toml`](wrangler.toml) | Cloudflare Wrangler CLI configuration. |
| [`server-local.js`](server-local.js) | Built-in local development server simulating the Cloudflare edge gatekeeper. |
| [`test-auth.js`](test-auth.js) | CLI utility to test candidate passwords against the 3 hashes locally. |

---

## 🚀 Deployment Instructions

### Method 1: Instant Setup via Cloudflare Dashboard (No CLI Needed)

1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left sidebar, click **Workers & Pages** &rarr; **Create application** &rarr; **Create Worker**.
3. Name your worker (e.g., `useas-admin-gatekeeper`) and click **Deploy**.
4. Click **Edit code**.
5. Delete any existing template code and **paste the entire contents** of [`cloudflare-worker-bundle.js`](cloudflare-worker-bundle.js).
6. In the code, set `ORIGIN_URL` (or go to Worker **Settings** &rarr; **Variables** &rarr; **Environment Variables**) and add:
   - `ORIGIN_URL`: `https://<your-username>.github.io/<your-repo>` (your GitHub Pages site URL)
   - `JWT_SECRET`: Any random 32-character string for signing cookies
7. Click **Save and Deploy**.
8. Go to your Worker's **Settings** &rarr; **Triggers**:
   - You can access the panel via your free `*.workers.dev` URL, or
   - Add a **Custom Domain** (e.g., `admin.yourdomain.com`).

---

### Method 2: Deploy via Wrangler CLI

If you prefer using the terminal:

1. Install Wrangler globally or use npx:
   ```powershell
   npm install -g wrangler
   ```
2. Log in to Cloudflare:
   ```powershell
   wrangler login
   ```
3. Update `ORIGIN_URL` in [`wrangler.toml`](wrangler.toml) with your GitHub Pages URL:
   ```toml
   ORIGIN_URL = "https://<your-username>.github.io/<your-repo>"
   ```
4. Deploy the worker:
   ```powershell
   npm run deploy
   ```

---

## 🌐 Connecting GitHub Pages & Preventing Direct URL Bypass

To ensure visitors cannot bypass the Cloudflare Worker by going directly to `username.github.io/repo`:

1. In your **GitHub Repository** &rarr; **Settings** &rarr; **Pages**:
   - Set **Custom domain** to your Cloudflare domain (e.g. `admin.yourdomain.com`).
   - Check **Enforce HTTPS**.
2. In your **Cloudflare DNS**:
   - Create a `CNAME` record for `admin` pointing to `<your-username>.github.io`.
   - Make sure the proxy status is **Proxied (Orange Cloud)**.
3. In **Workers & Pages** &rarr; **Triggers**:
   - Add a Custom Domain for `admin.yourdomain.com` pointing to your Worker.
4. **Result**: Any visit to `username.github.io/repo` is automatically redirected by GitHub to `admin.yourdomain.com`, which is proxied by Cloudflare where your Worker intercepts and enforces Bcrypt authentication before serving any HTML!

---

## 💻 Local Testing on Your Computer

### 1. Test Candidate Passwords against the Hashes
```powershell
node test-auth.js YourSecretPassword123
```
- If it matches any of the 3 Bcrypt hashes, it will report `Access GRANTED!`.

### 2. Run the Full Gatekeeper Locally
```powershell
node server-local.js
```
- Open `http://localhost:3000` in your browser.
- Opening `/index.html` or any admin page without logging in will immediately redirect you to `/admin-login.html`.
- Enter your valid password to unlock the Admin Hub.
- Click **Logout** to test session destruction.
