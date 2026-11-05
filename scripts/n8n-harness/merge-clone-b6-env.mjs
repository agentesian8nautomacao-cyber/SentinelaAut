/**
 * B6 — append missing synthetic pilot/HMAC env keys to gitignored n8n-clone-b4.env (names only in logs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../docker/dp02b3-isolated/n8n-clone-b4.env');

const SYNTHETIC = {
  SENTINELA_API_BASE_URL: 'http://127.0.0.1:3099',
  SENTINELA_PILOT_BASE: 'http://127.0.0.1:3099',
  SENTINELA_N8N_CLIENT_ID: 'n8n-pilot-test',
  SENTINELA_N8N_SECRET: 'test-secret-do-not-use-in-prod',
  SENTINELA_HARNESS_CLIENT_ID: 'n8n-pilot-test',
  SENTINELA_HARNESS_SECRET: 'test-secret-do-not-use-in-prod',
  SENTINELA_N8N_ORGANIZATION_ID: '0e5a5c4b-4cc6-48ee-8c1b-08d5015ab928',
  SENTINELA_N8N_CONDOMINIUM_ID: '3f383313-5ec0-4d21-97c7-1b2500c933be',
  SENTINELA_HARNESS_ORG: '0e5a5c4b-4cc6-48ee-8c1b-08d5015ab928',
  SENTINELA_HARNESS_CONDO: '3f383313-5ec0-4d21-97c7-1b2500c933be'
};

const DROP_FROM_N8N = new Set(['DATABASE_URL']);

if (!fs.existsSync(envPath)) {
  console.error('missing', envPath);
  process.exit(1);
}

const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
const present = new Set();
const out = [];

for (const line of lines) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) {
    if (DROP_FROM_N8N.has(m[1])) continue;
    if (Object.prototype.hasOwnProperty.call(SYNTHETIC, m[1])) {
      out.push(`${m[1]}=${SYNTHETIC[m[1]]}`);
      present.add(m[1]);
      continue;
    }
    present.add(m[1]);
  }
  out.push(line);
}

out.push('', '# --- B6 synthetic API pilot (child workflows) ---');
for (const [k, v] of Object.entries(SYNTHETIC)) {
  if (!present.has(k)) {
    out.push(`${k}=${v}`);
    present.add(k);
  }
}

fs.writeFileSync(envPath, out.join('\n').replace(/\n+$/, '\n'), 'utf8');
console.log('updated keys:', Object.keys(SYNTHETIC).filter((k) => present.has(k)).join(', '));
