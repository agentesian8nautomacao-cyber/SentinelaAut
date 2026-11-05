/**
 * B7 — point clone n8n at real API pilot on isolated Docker DNS (not B6 stub/127.0.0.1).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../docker/dp02b3-isolated/n8n-clone-b4.env');
const PILOT_BASE = 'http://sentinelaaut-api-pilot-dp02b3:3099';

const OVERRIDES = {
  SENTINELA_API_BASE_URL: PILOT_BASE,
  SENTINELA_PILOT_BASE: PILOT_BASE
};

if (!fs.existsSync(envPath)) {
  console.error('missing', envPath);
  process.exit(1);
}

const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
const out = lines.map((line) => {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
  if (m && OVERRIDES[m[1]]) return `${m[1]}=${OVERRIDES[m[1]]}`;
  return line;
});

fs.writeFileSync(envPath, out.join('\n').replace(/\n+$/, '\n'), 'utf8');
console.log('B7 pilot base set to isolated service DNS (names only)');
