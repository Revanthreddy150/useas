/**
 * Local Development Server (Simulates Cloudflare Worker Edge Gatekeeper)
 * 
 * Allows full local testing of login, rate limiting, bcrypt verification,
 * cookie sessions, protected page blocking, and logout before deploying.
 * 
 * Run: node server-local.js
 * Open: http://localhost:3000
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const COOKIE_NAME = 'admin_session';
const JWT_SECRET = 'useas-local-test-secret-key-2026';
const ADMIN_HASHES = [
  "$2y$10$bHElaZPj7kxXbYE5TUYVMu4xZAxSJMXpLbh2b7nrQ62S1scfvMp8G",
  "$2y$10$5ZSQbytvy4tFnwYZkiF1NuO.5HsvQ9tHpvGO2lMIQ3LAjI7m1rVAq",
  "$2y$10$Q.CqKi/RIZ2Uk5x.CDQaNO8plNDccaaaOIdRH7w2S77nxA717BGKO"
];

const PROTECTED_PAGES = new Set([
  '/',
  '/index',
  '/index.html',
  '/feedbackadmin',
  '/feedbackadmin.html',
  '/letterhubadmin',
  '/letterhubadmin.html',
  '/notificationsadmin',
  '/notificationsadmin.html',
  '/paperhubadmin',
  '/paperhubadmin.html',
  '/studyhubadmin',
  '/studyhubadmin.html',
  '/ultraabhyaslabadmin',
  '/ultraabhyaslabadmin.html'
]);

const rateLimitMap = new Map();

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

function createSessionToken() {
  const exp = Math.floor(Date.now() / 1000) + 86400;
  const nonce = crypto.randomBytes(16).toString('hex');
  const data = `${exp}.${nonce}`;
  const hmac = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
  return `${data}.${hmac}`;
}

function verifySessionToken(token) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expStr, nonce, hmac] = parts;
  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const data = `${expStr}.${nonce}`;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const cookies = parseCookies(req);
  const isAuthenticated = verifySessionToken(cookies[COOKIE_NAME]);
  const clientIP = req.socket.remoteAddress || '127.0.0.1';

  // 1. Logout
  if (pathname === '/admin/logout' || pathname === '/logout') {
    res.writeHead(302, {
      'Location': '/admin-login.html',
      'Set-Cookie': `${COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`
    });
    return res.end();
  }

  // 2. Login POST
  if ((pathname === '/api/login' || pathname === '/admin/login') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let password = '';
      try {
        if (req.headers['content-type']?.includes('application/json')) {
          password = (JSON.parse(body).password || '').trim();
        } else {
          const params = new URLSearchParams(body);
          password = (params.get('password') || '').trim();
        }
      } catch (e) {}

      // Rate limit check
      const entry = rateLimitMap.get(clientIP) || { count: 0, first: Date.now() };
      if (Date.now() - entry.first > 900000) {
        entry.count = 0;
        entry.first = Date.now();
      }

      if (entry.count >= 5) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Too many attempts. Lockout active for 15 mins.' }));
      }

      // Bcrypt verification
      let isValid = false;
      for (const hash of ADMIN_HASHES) {
        if (bcrypt.compareSync(password, hash)) {
          isValid = true;
          break;
        }
      }

      if (isValid) {
        rateLimitMap.delete(clientIP);
        const token = createSessionToken();
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
        });
        return res.end(JSON.stringify({ success: true, redirect: '/index.html' }));
      } else {
        entry.count += 1;
        rateLimitMap.set(clientIP, entry);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Invalid admin authorization key.', remainingAttempts: 5 - entry.count }));
      }
    });
    return;
  }

  // 3. Login Page
  if (pathname === '/admin-login' || pathname === '/admin-login.html') {
    if (isAuthenticated) {
      res.writeHead(302, { 'Location': '/index.html' });
      return res.end();
    }
    const filePath = path.join(__dirname, 'admin-login.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return fs.createReadStream(filePath).pipe(res);
  }

  // 4. Protected Pages Gatekeeper
  const cleanPath = pathname.toLowerCase().replace(/\/$/, '') || '/';
  if (PROTECTED_PAGES.has(cleanPath)) {
    if (!isAuthenticated) {
      res.writeHead(302, { 'Location': '/admin-login.html' });
      return res.end();
    }
    const targetFile = cleanPath === '/' ? 'index.html' : (cleanPath.endsWith('.html') ? cleanPath.slice(1) : `${cleanPath.slice(1)}.html`);
    const filePath = path.join(__dirname, targetFile);
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return fs.createReadStream(filePath).pipe(res);
    }
  }

  // 5. Static Files Pass-Through
  const staticPath = path.join(__dirname, pathname);
  if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    const ext = path.extname(staticPath);
    const mimeMap = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };
    res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'text/plain' });
    return fs.createReadStream(staticPath).pipe(res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  USEAS Control Panel - Local Gatekeeper Running`);
  console.log(`  Access URL : http://localhost:${PORT}`);
  console.log(`  Login Page : http://localhost:${PORT}/admin-login.html`);
  console.log(`  Admin Hub  : http://localhost:${PORT}/index.html (Protected)`);
  console.log(`======================================================\n`);
});
