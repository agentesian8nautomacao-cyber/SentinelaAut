# SENTINELAAUT — D-P0-2B-4B-B4 — E2E Gateway + n8n + PostgreSQL (isolado)

**Data:** 2026-11-05
**Escopo:** clone `sentinelaaut-n8n-dp02b3-import`, rede `sentinelaaut-n8n-dp02b3-isolated`, sidecar nonce, PG descartável A4.
**Proibido cumprido:** n8n live (`sentinelaaut-n8n-local` :5678) **não** parado/reiniciado/alterado; sem commit/push/deploy/migrations prod; credenciais **sintéticas** (`b4-e2e-*`); sem Supabase LIVE.

---

## 1. Git e pré-check

| Item | Resultado |
|------|-----------|
| SHA inicial / final (working tree, sem commit B4) | `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` |
| Relatórios A3, A4, A5, B1, B2, B3 | Presentes em `docs/evidence/results/` |
| Backup B3 | `backups/d-p0-2b-4b-b3-20261105/` |
| Volume SQLite A3 | `dp02b3-isolated_sentinelaaut-agent-nonces-clone-data` — **preservado** |
| Volume PG A4 | `dp02b3-isolated_sentinelaaut-pg-nonce-test-a4-data` — **preservado** |
| n8n live | **Up** durante toda a fase (não utilizado para tráfego de teste) |

---

## 2. Inventário runtime (isolado)

| Container | Papel | Rede |
|-----------|--------|------|
| `sentinelaaut-n8n-dp02b3-import` | n8n clone (AUT-2F-001 publicado) | `sentinelaaut-n8n-dp02b3-isolated` |
| `sentinelaaut-agent-nonce-sidecar-dp02b3` | `POST /api/v1/agent-gateway/nonce/consume` | mesma |
| `sentinelaaut-pg-nonce-test-a4` | Postgres 16, migration **022** (`agent_gateway_nonces`) | mesma (+ bind host `127.0.0.1:55440`) |

**Imagens:** sidecar `sentinelaaut-agent-nonce-sidecar-dp02b3:local` (build local); clone `sha256:a8c95f75…` (digest import D-P0-2B-3).

**Artefatos B4 (working tree, não commitados):**

- `docker/dp02b3-isolated/compose-b4-e2e-pg.yml`
- `docker/dp02b3-isolated/nonce-sidecar.env` / `n8n-clone-b4.env` (**gitignored**)
- `scripts/n8n-harness/dp04-b4-e2e-webhook-harness.mjs`, `dp04-b4-e2e-matrix.mjs`
- Ajustes: `run-agent-gateway-nonce-sidecar.mjs`, `api/_lib/db/pgPool.ts`, `.gitignore`

**Migration 023:** **não aplicada** — registry via `SENTINELA_AGENT_GATEWAY_IDENTITY_REGISTRY` (env); sem dependência comprovada de registry PG.

---

## 3. Fase 2 — `npm ci`

| Alvo | Resultado |
|------|-----------|
| Cópia descartável (`%TEMP%\sentinelaaut-npm-ci-b4`, sessão B3/B4) | **OK** (~684 pacotes) |
| `D:\SentinelaAut\node_modules` | **EPERM** (ficheiros em uso no Windows) — bloqueio **ambiental**, lockfile não invalidado |

---

## 4. Correções técnicas descobertas na B4 (sidecar + PG)

1. **`STORE_NOT_CONFIGURED`:** o launcher `run-agent-gateway-nonce-sidecar.mjs` removia `DATABASE_URL` do processo filho. Mitigação: `SENTINELA_AGENT_GATEWAY_NONCE_SIDECAR_ALLOW_DATABASE_URL=1` no compose B4 + alteração no scrubber.
2. **`STORE_UNAVAILABLE` (PG):** `pgPool` forçava SSL para hosts Docker internos; Postgres A4 não fala SSL. Mitigação: respeitar `sslmode=disable` na URL + `?sslmode=disable` no `DATABASE_URL` do clone.
3. **Clone n8n — Code node:** exigiu `NODE_FUNCTION_ALLOW_BUILTIN=crypto` e `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` (paridade com `docker/n8n-local/compose.yml`).
4. **Env gateway clone:** `SENTINELA_AGENT_GATEWAY_SECRETS` em JSON válido via `--env-file` (`n8n-clone-b4.env`); valores **omitidos** neste relatório.

---

## 5. Gateway / PostgreSQL (sidecar)

| Verificação | Evidência |
|-------------|-----------|
| Health sidecar | HTTP **200** `{ service: agent-gateway-nonce-sidecar }` (campo `nonce_store: not_configured` é **limitação do health** — só reflecte SQLite) |
| Consume nonce novo | HTTP **200** `{ success: true, consumed: true }` |
| Replay consume | HTTP **409** `NONCE_REPLAY` |
| PG parado | HTTP **503** `STORE_UNAVAILABLE` |
| PG reiniciado + sidecar restart | HTTP **200** novamente |
| Concorrência (8× mesmo nonce) | **1×200**, **7×409** |
| Persistência | Linhas em `agent_gateway_nonces` sobrevivem restart PG (volume A4) |

---

## 6. Webhook n8n (AUT-2F-001 no clone)

| Verificação | Resultado |
|-------------|-----------|
| Registo POST `/webhook/sentinelaaut/aut-2f-001` | **Sim** (após `publish:workflow --id=aut-2f-001` + restart clone) |
| `rawBody: true` no artefacto repo | **Sim** (`n8n/workflows/AUT-2F-001-INTENT-ROUTER.json`) |
| Assinatura agent-v1 + consume persistente | **Parcial:** em execuções com gateway completo, nonce aparece no PG **antes** de falha downstream |
| Resposta HTTP cliente webhook | **500** `Error in workflow` (não **401** documentado) |

### Divergência crítica (workflow — **sem correção autorizada**)

No ramo **rejeição gateway** (`Invalid Input Output` → `Observability` → `Final Output`), o nó **Final Output** referencia `$('Validate + Normalize')`, que **não corre** quando o gateway bloqueia. Isso provoca erro n8n e **500** em vez de resposta controlada (**401** / corpo `user_safe`).

**Impacto B4:** matriz HTTP do **webhook** não cumpre critérios de distinção 401 vs 503 na borda n8n; o **consume API** e o **consumo de nonce via gateway** (quando atingido) cumprem.

**Autorização necessária (B5+):** patch workflow clone (Final Output / respond webhook) ou `Respond to Webhook` dedicado no ramo gateway negado — **não** aplicado nesta fase.

---

## 7. Matriz de testes (resumo)

| Cenário | Canal | Esperado | Observado |
|---------|--------|----------|-----------|
| Assinatura válida + nonce novo | consume API | 200 | **200** |
| Assinatura válida + intent allowlist | webhook | 200 / 4xx negócio | **500** (workflow) |
| Assinatura inválida | webhook | 401 | **500** (Final Output) |
| Nonce repetido | consume API | 409 | **409** |
| Timestamp fora janela | webhook | 401 | **500** |
| PostgreSQL indisponível | consume API | 503 | **503** `STORE_UNAVAILABLE` |
| PG recuperado | consume API | 200 | **200** |
| Concorrência nonce | consume API | 1× aceite | **1×200, 7×409** |
| n8n live / Supabase prod | — | intocados | **OK** |

Script: `scripts/n8n-harness/dp04-b4-e2e-matrix.mjs` (rede isolada via `docker run --network sentinelaaut-n8n-dp02b3-isolated`).

---

## 8. Fase 7 — operação funcional ponta a ponta

**Não concluída.** Com webhook a **500**, não há resposta contratual ao cliente nem encadeamento fiável até AUT-3B/LIST_EVENTS sem alterar workflow ou dependências API no clone. Nonce + HMAC + consume **foram** exercitados em subconjunto (nonces persistidos no PG em execuções webhook anteriores à matriz LIST_EVENTS).

---

## 9. Isolamento e rollback

- Tráfego de teste: **apenas** DNS interno (`sentinelaaut-*` na rede `sentinelaaut-n8n-dp02b3-isolated`).
- **Rollback:** parar containers B4 (clone, sidecar); PG A4 pode parar — volumes **não** removidos; sidecar SQLite A3 intacto; live inalterado.
- Logs citados foram filtrados para **não** incluir tokens/HMAC/secrets.

---

## 10. Veredito

**PASS WITH CONDITIONS**

| Critério | Estado |
|----------|--------|
| Clone n8n → consume gateway (HTTP interno) | **PASS** |
| Nonce PostgreSQL atómico + replay | **PASS** (API) |
| Fail-closed PG down → 503 | **PASS** |
| Persistência pós-restart PG | **PASS** |
| rawBody + HMAC validados no código gateway | **PASS** (código + nonces PG em execuções gateway) |
| Respostas HTTP webhook 401/409 conforme contrato | **FAIL** (500 workflow) |
| E2E funcional completo (Fase 7) | **BLOCKED** até correção workflow ou autorização |

**Próximo passo:** aguardar autorização expressa para **B5** (correção ramo resposta webhook no clone + reexecução matriz E2E).

---

## 11. Encerramento operacional

Após geração deste relatório: parar `sentinelaaut-n8n-dp02b3-import` e `sentinelaaut-agent-nonce-sidecar-dp02b3` (opcional PG A4); **não** parar `sentinelaaut-n8n-local`. Sem `git add` / commit / push.
