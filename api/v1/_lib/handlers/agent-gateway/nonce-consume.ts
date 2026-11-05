/**

 * POST /api/v1/agent-gateway/nonce/consume

 * Internal-only. B16-C store + B16-D2 per-identity authorization.

 */



export const runtime = 'nodejs';



import { isKeyIdAllowed, resolveAllowedKeyIds } from '../../agentGateway/allowedKeyIds';

import {

  authenticateAgentGatewayIdentity,

  authorizeKeyIdForIdentity

} from '../../agentGateway/identityAuth';

import { consumeNoncePg } from '../../agentGateway/nonceConsumeCore';

import { consumeNonceSqlite, openAgentGatewayNonceSqlite } from '../../agentGateway/nonceConsumeSqlite';

import { withPgTransaction } from '../../../../_lib/db/pgPool';

import { getTimestampWindowSeconds } from '../../auth/timestamp';



function parseBody(raw: string): { key_id?: string; nonce?: string; consumed_ms?: number } | null {

  try {

    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    return parsed as { key_id?: string; nonce?: string; consumed_ms?: number };

  } catch {

    return null;

  }

}



function windowFromEnv(): number {

  const raw = String(process.env.SENTINELA_AGENT_GATEWAY_TIMESTAMP_WINDOW_SECONDS || '').trim();

  const n = raw ? Number(raw) : NaN;

  if (Number.isFinite(n) && n >= 30 && n <= 3600) return n;

  return getTimestampWindowSeconds();

}



let sqliteDb: ReturnType<typeof openAgentGatewayNonceSqlite> | null = null;



function getSqliteDb() {

  const path = String(process.env.SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH || '').trim();

  if (!path) return null;

  if (!sqliteDb) {

    try {

      sqliteDb = openAgentGatewayNonceSqlite(path);

    } catch {

      return null;

    }

  }

  return sqliteDb;

}



function respondStore(outcome: 'ok' | 'replay' | 'unavailable'): Response {

  if (outcome === 'ok') {

    return Response.json({ success: true, consumed: true }, { status: 200 });

  }

  if (outcome === 'replay') {

    return Response.json(

      { success: false, error: { code: 'NONCE_REPLAY' } },

      { status: 409, headers: { 'Content-Type': 'application/json' } }

    );

  }

  return Response.json(

    { success: false, error: { code: 'STORE_UNAVAILABLE' } },

    { status: 503, headers: { 'Content-Type': 'application/json' } }

  );

}



function jsonError(status: number, code: string): Response {

  return Response.json(

    { success: false, error: { code } },

    { status, headers: { 'Content-Type': 'application/json' } }

  );

}



export default {

  async fetch(request: Request): Promise<Response> {

    if (request.method !== 'POST') {

      return jsonError(405, 'METHOD_NOT_ALLOWED');

    }



    const identityAuth = await authenticateAgentGatewayIdentity(request, process.env);

    if (!identityAuth.ok) {

      return jsonError(identityAuth.httpStatus, identityAuth.code);

    }



    const bodyRaw = await request.text();

    const body = parseBody(bodyRaw);

    const keyId = String(body?.key_id || '').trim();

    const nonce = String(body?.nonce || '').trim();

    const nowMs =

      typeof body?.consumed_ms === 'number' && Number.isFinite(body.consumed_ms)

        ? body.consumed_ms

        : Date.now();



    if (!keyId || !nonce) {

      return jsonError(400, 'INVALID_BODY');

    }



    const allowlist = resolveAllowedKeyIds(process.env);

    if (!allowlist.ok) {

      return jsonError(503, 'KEY_ID_ALLOWLIST_NOT_CONFIGURED');

    }



    const keyAuth = isKeyIdAllowed(keyId, process.env);

    if (!keyAuth.allowed) {

      const code =

        keyAuth.reason === 'key_id_not_allowed' ? 'KEY_ID_NOT_ALLOWED' : 'KEY_ID_INVALID';

      const status = keyAuth.reason === 'key_id_not_allowed' ? 403 : 400;

      return jsonError(status, code);

    }



    const keyIdentity = await authorizeKeyIdForIdentity(identityAuth.identity_id, keyId, process.env);

    if (!keyIdentity.ok) {

      return jsonError(keyIdentity.httpStatus, keyIdentity.code);

    }



    const env = { timestampWindowSeconds: windowFromEnv() };

    const sqlitePath = String(process.env.SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH || '').trim();

    const dbUrl = String(process.env.DATABASE_URL || '').trim();



    if (sqlitePath) {

      const db = getSqliteDb();

      if (!db) {

        return respondStore('unavailable');

      }

      return respondStore(consumeNonceSqlite(db, keyId, nonce, nowMs, env));

    }



    if (dbUrl) {

      const tx = await withPgTransaction(process.env, async (client) =>

        consumeNoncePg(client, keyId, nonce, nowMs, env)

      );

      if (!tx.ok) {

        return respondStore('unavailable');

      }

      return respondStore(tx.value);

    }



    return jsonError(503, 'STORE_NOT_CONFIGURED');

  }

};



/** Test-only */

export function resetAgentGatewayNonceSqliteForTests(): void {

  sqliteDb = null;

}
