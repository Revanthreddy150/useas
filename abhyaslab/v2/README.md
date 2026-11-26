# Abhyas Lab Keys

A strictly **Blue & White** web platform with a **User Web** (`index.html`) and an **Admin Web** (`admin.html`), powered by **Firebase Realtime Database** and **Firebase Authentication**.

## Project Files

- [index.html](file:///c:/My%20Work%20Space/ABHYAS%20LAB%20KEYS%20WEB/index.html) & [app.js](file:///c:/My%20Work%20Space/ABHYAS%20LAB%20KEYS%20WEB/app.js) — User-facing portal to browse repositories, click questions, view answers/code, and copy solutions with one click.
- [admin.html](file:///c:/My%20Work%20Space/ABHYAS%20LAB%20KEYS%20WEB/admin.html) & [admin.js](file:///c:/My%20Work%20Space/ABHYAS%20LAB%20KEYS%20WEB/admin.js) — Admin portal to sign in, create/edit/delete repositories, add/edit/delete questions & answers, preview solutions, and import/export JSON backups.
- [styles.css](file:///c:/My%20Work%20Space/ABHYAS%20LAB%20KEYS%20WEB/styles.css) — Shared Blue & White design system.
- [firebase-config.js](file:///c:/My%20Work%20Space/ABHYAS%20LAB%20KEYS%20WEB/firebase-config.js) — Firebase app initialization (`exams-f7881`).
- [database.rules.json](file:///c:/My%20Work%20Space/ABHYAS%20LAB%20KEYS%20WEB/database.rules.json) — Realtime Database rules (public read, authenticated write).
- [firebase.json](file:///c:/My%20Work%20Space/ABHYAS%20LAB%20KEYS%20WEB/firebase.json) — Firebase Hosting & Database rules config.

## Firebase Console Setup (One-Time)

1. Open the **Firebase Console** for project **`exams-f7881`**.
2. **Authentication**:
   - Go to **Build → Authentication → Sign-in method**.
   - Enable **Email/Password**.
   - Either add your admin user under **Authentication → Users**, or use the **Create Admin Account** tab in `admin.html`.
3. **Realtime Database Rules**:
   - Go to **Build → Realtime Database → Rules**.
   - Paste the contents of `database.rules.json`:
     ```json
     {
       "rules": {
         "repositories": {
           ".read": true,
           ".write": "auth != null"
         },
         "questions": {
           ".read": true,
           ".write": "auth != null"
         }
       }
     }
     ```
   - *(Recommended for production)*: Replace `"auth != null"` with `"auth != null && auth.uid === 'YOUR_ADMIN_UID'"` so only your specific admin UID can modify data.

## Running Locally

Because the site uses browser ES Modules (`type="module"`), serve the folder over HTTP (rather than opening `file://` directly):

- **VS Code Live Server**: Right-click `index.html` → *Open with Live Server*.
- **Python**: `python -m http.server 5500` then open `http://localhost:5500/index.html` and `http://localhost:5500/admin.html`.
- **Node**: `npx serve .`

## Deploying to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase use exams-f7881
firebase deploy
```
