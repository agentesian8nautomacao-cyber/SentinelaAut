#!/usr/bin/env node
/**
 * Start agent-gateway nonce sidecar (strip LIVE DB env).
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const config = path.join(here, 'pilot.vite.config.ts');
const entry = path.join(here, 'agent-gateway-nonce-sidecar.ts');

const STRIP_EXACT = new Set([
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'DIRECT_URL',
  'POSTGRES_URL',
  'SENTINELA_API_CREDENTIALS',
  'SENTINELA_TENANT_CATALOG'
]);

function scrubEnv(base) {
  const env = { ...base };
  const allowPgDbUrl = String(env.SENTINELA_AGENT_GATEWAY_NONCE_SIDECAR_ALLOW_DATABASE_URL || '').trim() === '1';
  for (const key of Object.keys(env)) {
    if (allowPgDbUrl && key === 'DATABASE_URL') continue;
    if (key.startsWith('POSTGRES_') || STRIP_EXACT.has(key)) {
      delete env[key];
    }
  }
  return env;
}

const viteNode = path.join(root, 'node_modules', 'vite-node', 'vite-node.mjs');
const child = spawn(process.execPath, [viteNode, '--config', config, entry], {
  cwd: root,
  env: scrubEnv(process.env),
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
