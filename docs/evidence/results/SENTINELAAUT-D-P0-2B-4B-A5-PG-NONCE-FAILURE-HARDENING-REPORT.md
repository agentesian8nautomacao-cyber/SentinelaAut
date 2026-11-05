# SENTINELAAUT — D-P0-2B-4B-A5 — PostgreSQL nonce failure hardening

**Data/hora:** 2026-11-05 ~10:06 (UTC-3)
**Referência:** [A4 POSTGRES NONCE REPORT](./SENTINELAAUT-D-P0-2B-4B-A4-POSTGRES-NONCE-REPORT.md)
**Escopo:** fail-closed HTTP **503** quando PostgreSQL indisponível; suíte A4 + cenários A5 em PG descartável.

---

## 1. Resumo executivo

| Item | Resultado |
|------|-----------|
| Pré-check HEAD / branch / live / PG A4 | **PASS** |
| Causa raiz confirmada | `p.connect()` fora de `try/catch` em `withPgTransaction` |
| Correção mínima | **PASS** (`pgPool.ts` apenas; handler já mapeava `!tx.ok` → 503) |
| Vitest integração | **11/11 PASS** (~11s testes) |
| HTTP 200 / 409 / 503 | **Comprovados** |
| Recuperação pós-restart PG | **PASS** |
| n8n live | **Inalterado** |

### Veredito: **`PASS`**

---

## 2. Fase 1 — Pré-check (READ-ONLY)

| Verificação | Evidência |
|-------------|-----------|
| Branch | `main` |
| HEAD | `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` (**match** esperado A4) |
| Artefatos A4 não commitados | `??` em `pgPool.ts`, `nonce-consume.ts`, compose PG, teste integração, relatório A4 |
| PG A4 | `sentinelaaut-pg-nonce-test-a4` **Exited** → iniciado só para testes → **Stopped** ao encerrar A5 |
| Volume A4 | **Preservado** (sem `down -v`) |
| n8n live | `sentinelaaut-n8n-local` Up `:5678` |
| Componentes (A4) | Handler `nonce-consume.ts`; core `consumeNoncePg`; pool `withPgTransaction` |

### Backup pré-alteração

| Caminho |
|---------|
| `backups/d-p0-2b-4b-a5-20261105/pgPool.ts` |
| `backups/d-p0-2b-4b-a5-20261105/nonce-consume.ts` |
| `backups/d-p0-2b-4b-a5-20261105/agentGatewayPgNonce.integration.test.ts` (versão A4) |

---

## 3. Fase 2 — Diagnóstico

| Camada | Comportamento antes |
|--------|---------------------|
| `withPgTransaction` | `connect()` **lançava** → Vitest/handler **500** não controlado |
| `consumeNoncePg` | Erros SQL → `'unavailable'` (OK) |
| Handler | `!tx.ok` → `respondStore('unavailable')` → **503** `STORE_UNAVAILABLE` (OK se `tx` não lançasse) |
| Pool idle | `docker stop` → clientes idle **57P01** sem handler → uncaught em Vitest (A4) |

**Conclusão:** gap exclusivamente na **aquisição de conexão** e **ciclo de vida do pool** em testes de outage.

---

## 4. Fase 3 — Correção implementada

**Ficheiro alterado:** `api/_lib/db/pgPool.ts` (handler **não** modificado).

1. **`connect()` em `try/catch`** → `{ ok: false, error: 'Postgres indisponível (ligação).' }` + log `{ phase, code }` sem URL/senha.
2. **`pool.on('error')`** → log sanitizado (clientes idle após restart/stop).
3. **`endPgPoolForTests()`** → `pool.end()` antes de `docker stop/restart` nos testes.

Contratos **200** / **409** / `ok` / `replay` **inalterados**.

---

## 5. Fase 4 — Testes

**Comando:**

```text
SENTINELA_PG_NONCE_TEST_URL=postgresql://nonce_test:nonce_test_local_discard@127.0.0.1:55440/nonce_test
npx vitest run scripts/n8n-harness/agentGatewayPgNonce.integration.test.ts
```

**Resultado:** `Test Files 1 passed | Tests 11 passed (11)` — 2026-11-05 ~10:06.

| # | Requisito A5 | Teste Vitest | Resultado |
|---|--------------|--------------|-----------|
| 1 | Nonce novo → 200 | 1 + 7 | **200** / `ok` |
| 2 | Replay → 409 | 2 + 7 | **409** `NONCE_REPLAY` |
| 3 | PG off antes da conexão → 503 | 9 | **503** `STORE_UNAVAILABLE`; `pgConsume` → `ok: false` |
| 4 | Erro SQL no consume → 503 | 10 (DROP TABLE) | **503**; corpo sem detalhe SQL |
| 5 | PG reiniciado → recuperação | 9 (tail) + 11 | **200** após `waitPgReady` |
| 6 | Nonce persistido após restart | 11 | **200** depois **409** |
| 7 | Concorrência 12× | 3 | 1× ok, 11× replay |
| 8 | Separação `key_id` | 4 | **PASS** |
| 9 | Expiração / prune | 5 | **PASS** |
| 10 | Nenhuma aceitação store down | 9 (2× handler 503) | **PASS** |
| — | Suíte A4 completa | 1–8 | **PASS** |

### Evidências HTTP (fail-closed)

- **200:** `{ success: true, consumed: true }` — sem credenciais no JSON.
- **409:** `{ success: false, error: { code: 'NONCE_REPLAY' } }`.
- **503:** `{ success: false, error: { code: 'STORE_UNAVAILABLE' } }` — sem `ECONNREFUSED`, stack ou password.

**Logs servidor (stderr Vitest, aceitável):** `[pgPool] store unavailable { phase: 'connect', code: 'ECONNREFUSED' }`.

---

## 6. SHA e ficheiros

| | Valor |
|---|--------|
| Git HEAD (início e fim) | `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` |
| `pgPool.ts` (pós-A5) | `77a843e175df697b624473d5826aeee380beb8b841fcf5c19ce10ce288e019b1` |
| `agentGatewayPgNonce.integration.test.ts` (pós-A5) | `c054373bee5e4b63a7aa7f2759b4b4a9bb223fbc45a22fef01d4ca317bc4a75d` |

| Ficheiro | Alteração |
|----------|-----------|
| `api/_lib/db/pgPool.ts` | Hardening connect + pool error + `endPgPoolForTests` |
| `scripts/n8n-harness/agentGatewayPgNonce.integration.test.ts` | Testes 9–11, helpers HTTP, `endPgPool` antes de outage |

**Sem commit** (conforme autorização).

---

## 7. Divergências remanescentes

| Item | Severidade | Nota |
|------|------------|------|
| Logs `57P01` em burst durante `docker stop` | Baixa | Esperado; não expõe segredos; não afecta resposta HTTP |
| `withPgTransaction` devolve mensagem interna em `error` | Baixa | Handler **não** a propaga ao cliente |
| Sidecar HTTP PG em runtime n8n | N/A | Fora de escopo A5 (Vitest + handler directo) |

---

## 8. Rollback

**Código:**

```text
copy backups\d-p0-2b-4b-a5-20261105\pgPool.ts api\_lib\db\pgPool.ts
copy backups\d-p0-2b-4b-a5-20261105\agentGatewayPgNonce.integration.test.ts scripts\n8n-harness\
```

**Infra A4:** igual A4 — `docker compose -f docker/dp02b3-isolated/compose-postgres-nonce-test.yml down -v` só se operador quiser destruir volume.

---

## 9. Encerramento

- Container **`sentinelaaut-pg-nonce-test-a4`:** **Stopped**
- Supabase LIVE / migrations: **não tocados**
- AUT-2F-001 / gateway prod: **não activados**
- Volumes A3/A4: **preservados**

---

**PARAR AQUI — aguardar autorização para a próxima fase.**
