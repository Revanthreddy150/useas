/**
 * Cloudflare Worker Edge Gatekeeper for USEAS Control Panel
 * 
 * Supports both root domain and subfolder deployment (e.g. https://www.useas.online/admcore/)
 * Protects GitHub Pages static admin files behind edge-verified Bcrypt authentication.
 * Verifies passwords against 3 fixed Bcrypt hashes using Web Crypto HMAC session cookies.
 */

import bcrypt from 'bcryptjs';

// The 3 authorized Bcrypt password hashes
const DEFAULT_HASHES = [
  "$2y$10$bHElaZPj7kxXbYE5TUYVMu4xZAxSJMXpLbh2b7nrQ62S1scfvMp8G",
  "$2y$10$5ZSQbytvy4tFnwYZkiF1NuO.5HsvQ9tHpvGO2lMIQ3LAjI7m1rVAq",
  "$2y$10$Q.CqKi/RIZ2Uk5x.CDQaNO8plNDccaaaOIdRH7w2S77nxA717BGKO"
];

// Default origin: User's GitHub Pages domain
const DEFAULT_ORIGIN_URL = 'https://revanthreddy150.github.io';

const COOKIE_NAME = 'admin_session';
const SESSION_TTL_SECONDS = 86400; // 24 Hours
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_SECONDS = 900; // 15 Minutes

// In-Memory Brute Force Prevention (per Cloudflare Edge PoP)
const rateLimitMap = new Map();

// Protected root paths (if deployed at root)
const PROTECTED_ROOT_PATHS = new Set([
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

function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         'unknown-client';
}

function checkRateLimit(ip) {
  const now = Math.floor(Date.now() / 1000);
  const entry = rateLimitMap.get(ip);
  if (!entry) return { allowed: true, remaining: MAX_FAILED_ATTEMPTS };

  if (now - entry.firstAttemptTime > LOCKOUT_WINDOW_SECONDS) {
    rateLimitMap.delete(ip);
    return { allowed: true, remaining: MAX_FAILED_ATTEMPTS };
  }

  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    const retryAfter = LOCKOUT_WINDOW_SECONDS - (now - entry.firstAttemptTime);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  return { allowed: true, remaining: MAX_FAILED_ATTEMPTS - entry.count };
}

function recordFailure(ip) {
  const now = Math.floor(Date.now() / 1000);
  const entry = rateLimitMap.get(ip);
  if (!entry || (now - entry.firstAttemptTime > LOCKOUT_WINDOW_SECONDS)) {
    rateLimitMap.set(ip, { count: 1, firstAttemptTime: now });
  } else {
    entry.count += 1;
  }
}

function resetRateLimit(ip) {
  rateLimitMap.delete(ip);
}

// Crypto Helper Functions (HMAC-SHA256 Tokenization)
async function getCryptoKey(secret) {
  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function createSignedSessionToken(secret) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const data = `${exp}.${nonce}`;

  const key = await getCryptoKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const hexSig = bufferToHex(sig);

  return `${data}.${hexSig}`;
}

async function verifySignedSessionToken(token, secret) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [expStr, nonce, hexSig] = parts;
  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const data = `${expStr}.${nonce}`;
  const key = await getCryptoKey(secret);
  const expectedSig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const expectedHexSig = bufferToHex(expectedSig);

  if (hexSig.length !== expectedHexSig.length) return false;
  let diff = 0;
  for (let i = 0; i < hexSig.length; i++) {
    diff |= hexSig.charCodeAt(i) ^ expectedHexSig.charCodeAt(i);
  }
  return diff === 0;
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx !== -1) {
      cookies[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return cookies;
}

function isProtectedPath(pathname) {
  const clean = pathname.toLowerCase().replace(/\/$/, '') || '/';

  // Always allow login and logout endpoints through
  if (
    clean.endsWith('/admin-login') || 
    clean.endsWith('/admin-login.html') || 
    clean.endsWith('/api/login') || 
    clean.endsWith('/logout')
  ) {
    return false;
  }

  // Any path inside /admcore/ is strictly protected
  if (clean === '/admcore' || clean.startsWith('/admcore/')) {
    return true;
  }

  // Legacy root paths
  if (PROTECTED_ROOT_PATHS.has(clean)) return true;
  if (clean.startsWith('/admin') && !clean.startsWith('/admin-login')) return true;

  return false;
}

// Proxies or passes through to GitHub Pages origin
async function fetchFromOrigin(request, env) {
  const origin = (env.ORIGIN_URL && env.ORIGIN_URL.trim() !== '') 
    ? env.ORIGIN_URL.trim().replace(/\/$/, '') 
    : DEFAULT_ORIGIN_URL;

  const url = new URL(request.url);
  const targetUrl = `${origin}${url.pathname}${url.search}`;
  
  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.set('Host', new URL(origin).host);
  
  return await fetch(targetUrl, {
    method: request.method,
    headers: forwardHeaders,
    redirect: 'follow'
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const clientIP = getClientIP(request);
    const secret = env.JWT_SECRET || 'useas-super-secure-admin-edge-session-secret-2026';
    const hashes = [
      env.HASH_1 || DEFAULT_HASHES[0],
      env.HASH_2 || DEFAULT_HASHES[1],
      env.HASH_3 || DEFAULT_HASHES[2]
    ];

    const isInAdmcore = pathname.toLowerCase().startsWith('/admcore');
    const loginPageUrl = isInAdmcore ? '/admcore/admin-login.html' : '/admin-login.html';
    const dashboardUrl = isInAdmcore ? '/admcore/index.html' : '/index.html';

    const cookies = parseCookies(request.headers.get('Cookie'));
    const sessionToken = cookies[COOKIE_NAME];
    const isAuthenticated = await verifySignedSessionToken(sessionToken, secret);

    // 1. LOGOUT ROUTE: /admcore/logout, /admcore/admin/logout, /admin/logout, or /logout
    if (
      pathname === '/admin/logout' || 
      pathname === '/logout' || 
      pathname === '/admcore/logout' || 
      pathname === '/admcore/admin/logout'
    ) {
      return new Response('', {
        status: 302,
        headers: {
          'Location': loginPageUrl,
          'Set-Cookie': `${COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`,
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      });
    }

    // 2. SESSION CHECK API
    if (pathname === '/api/session-check' || pathname === '/admcore/api/session-check') {
      return new Response(JSON.stringify({ authenticated: isAuthenticated }), {
        status: isAuthenticated ? 200 : 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. LOGIN SUBMISSION: POST /api/login, /admcore/api/login, /admin/login, /admcore/login
    if (
      (pathname === '/api/login' || 
       pathname === '/admcore/api/login' || 
       pathname === '/admin/login' || 
       pathname === '/admcore/login') && 
      request.method === 'POST'
    ) {
      const rateCheck = checkRateLimit(clientIP);
      if (!rateCheck.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: `Too many failed attempts. Locked out. Please try again in ${rateCheck.retryAfter} seconds.`
        }), {
          status: 429,
          headers: { 
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.retryAfter)
          }
        });
      }

      let submittedPassword = '';
      const contentType = request.headers.get('content-type') || '';
      
      try {
        if (contentType.includes('application/json')) {
          const body = await request.json();
          submittedPassword = (body.password || '').trim();
        } else {
          const formData = await request.formData();
          submittedPassword = (formData.get('password') || '').trim();
        }
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: 'Malformed request payload.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!submittedPassword) {
        return new Response(JSON.stringify({ success: false, error: 'Password is required.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Edge Bcrypt Verification against the 3 authorized hashes
      let matchFound = false;
      for (const hash of hashes) {
        try {
          if (bcrypt.compareSync(submittedPassword, hash)) {
            matchFound = true;
            break;
          }
        } catch (e) {
          // Ignore formatting anomalies
        }
      }

      if (matchFound) {
        resetRateLimit(clientIP);
        const signedToken = await createSignedSessionToken(secret);
        const cookieHeader = `${COOKIE_NAME}=${signedToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;

        if (contentType.includes('application/json')) {
          return new Response(JSON.stringify({ success: true, redirect: dashboardUrl }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': cookieHeader
            }
          });
        } else {
          // Standard form redirect
          return new Response('', {
            status: 302,
            headers: {
              'Location': dashboardUrl,
              'Set-Cookie': cookieHeader
            }
          });
        }
      } else {
        recordFailure(clientIP);
        const updatedCheck = checkRateLimit(clientIP);
        const remaining = updatedCheck.remaining !== undefined ? updatedCheck.remaining : 0;

        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid admin authorization key.',
          remainingAttempts: remaining
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 4. LOGIN PAGE GET: /admin-login, /admin-login.html, /admcore/admin-login, /admcore/admin-login.html
    if (
      pathname === '/admin-login' || 
      pathname === '/admin-login.html' || 
      pathname === '/admcore/admin-login' || 
      pathname === '/admcore/admin-login.html'
    ) {
      if (isAuthenticated) {
        return new Response('', {
          status: 302,
          headers: { 'Location': dashboardUrl }
        });
      }
      return await fetchFromOrigin(request, env);
    }

    // 5. PROTECTED ADMIN PAGES GATEKEEPER
    if (isProtectedPath(pathname)) {
      if (!isAuthenticated) {
        // Unauthenticated access blocked immediately at edge
        return new Response('', {
          status: 302,
          headers: {
            'Location': loginPageUrl,
            'Cache-Control': 'no-store, no-cache, must-revalidate'
          }
        });
      }

      // If user visits /admcore or /admcore/ without a file, rewrite to /admcore/index.html
      if (pathname === '/admcore' || pathname === '/admcore/') {
        const redirectedRequest = new Request(new URL('/admcore/index.html', request.url), request);
        const response = await fetchFromOrigin(redirectedRequest, env);
        const secureHeaders = new Headers(response.headers);
        secureHeaders.set('X-Frame-Options', 'SAMEORIGIN');
        secureHeaders.set('X-Content-Type-Options', 'nosniff');
        secureHeaders.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: secureHeaders
        });
      }

      // Authenticated admin: serve requested page from GitHub Pages origin
      const response = await fetchFromOrigin(request, env);
      const secureHeaders = new Headers(response.headers);
      secureHeaders.set('X-Frame-Options', 'SAMEORIGIN');
      secureHeaders.set('X-Content-Type-Options', 'nosniff');
      secureHeaders.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: secureHeaders
      });
    }

    // 6. ALL OTHER ASSETS (CSS, JS, Fonts, Images, Public Files)
    return await fetchFromOrigin(request, env);
  }
};
