import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read pure ESM bcryptjs
let bcryptEsm = fs.readFileSync(path.join(__dirname, 'node_modules/bcryptjs/index.js'), 'utf8');

// Remove nodeCrypto import and fallback
bcryptEsm = bcryptEsm.replace('import nodeCrypto from "crypto";', '// Web Crypto API is native in Cloudflare Workers');
bcryptEsm = bcryptEsm.replace(/try\s*\{\s*return nodeCrypto\.randomBytes\(len\);\s*\}\s*catch\s*\{\}/, '');

// Convert export declarations to local declarations
bcryptEsm = bcryptEsm.replace(/^export function /gm, 'function ');
bcryptEsm = bcryptEsm.replace(/^export const /gm, 'const ');
bcryptEsm = bcryptEsm.replace(/^export default \{[\s\S]*?\};/m, '');

// Clean worker code
let workerCode = fs.readFileSync(path.join(__dirname, 'cloudflare-worker.js'), 'utf8');
workerCode = workerCode.replace(/import\s+bcrypt\s+from\s+['"]bcryptjs['"];?/, '// bcrypt.compareSync provided by embedded pure-JS bcrypt below');
workerCode = workerCode.replace(/bcrypt\.compareSync/g, 'compareSync');
workerCode = workerCode.replace(/new Response\(null,/g, "new Response('',");
workerCode = workerCode.replace(/async fetch\(request, env, ctx\)/g, "async fetch(request, env)");

const header = `/**
 * STANDALONE CLOUDFLARE WORKER GATEKEEPER FOR USEAS CONTROL PANEL
 * 
 * 100% PURE JAVASCRIPT - ZERO EXTERNAL DEPENDENCIES - MONACO COMPATIBLE
 * 
 * Instructions:
 * 1. Select all & copy this entire file.
 * 2. In Cloudflare Dashboard Workers Editor (worker.js), delete all existing code and paste this.
 * 3. Update ORIGIN_URL below with your GitHub Pages URL (e.g. "https://username.github.io/repo").
 * 4. Click the blue "Deploy" button in the top right.
 */
`;

const finalFile = `${header}\n// === PURE-JS BCRYPT ENGINE ===\n${bcryptEsm}\n// === WORKER GATEKEEPER LOGIC ===\n${workerCode}`;

fs.writeFileSync(path.join(__dirname, 'cloudflare-worker-bundle.js'), finalFile, 'utf8');
console.log('Clean standalone bundle written to cloudflare-worker-bundle.js! Length:', finalFile.length);
