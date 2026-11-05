# SENTINELAAUT — D-P0-2B-4B-B8 — Final Package Audit & Controlled Versioning Readiness

**Data:** 2026-11-05
**Branch (ref):** `main`
**HEAD:** `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68`
**Veredito de auditoria:** **PASS WITH CONDITIONS** (preparado para decisão de versionamento; **não** aprova produção irrestrita)

---

## 1. Resumo executivo

A B8 consolida evidências **B4 → B7-C** e audita o **pacote agent-v1** (gateway n8n, consume API, nonce PostgreSQL, harness, Docker isolado, workflow AUT-2F-001, piloto n8n) para um **commit futuro controlado**.

| Resultado | Significado |
|-----------|-------------|
| Inventário + classificação | **Completo** para o escopo agent-v1 |
| Segurança estática | **PASS WITH CONDITIONS** (defaults sintéticos só em harness/testes; env reais gitignored) |
| Dependências (`pg`) | **Necessária** ao runtime do consume + registry PG; lockfile **deve** ir no commit gateway |
| Testes | **188/188** harness Vitest (B7-C); lacunas E2E **documentadas** |
| Git operacional | **`git.exe` indisponível** no host (BUG fork bomb) — estado deduzido de ref + snapshot inicial da working tree |
| Ação B8 | **Relatório + lista INCLUDE**; **sem** `git add` / commit / push / deploy |

**Não converter** PASS WITH CONDITIONS das fases anteriores em “pronto para produção”.

---

## 2. Fase 0 — Pré-check (read-only)

### 2.1 Git

| Item | Evidência |
|------|-----------|
| Branch | `main` (`.git/HEAD` → `refs/heads/main`) |
| HEAD | `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` |
| `git status` / `git diff` | **Não executável** — `C:\Program Files\Git\bin\git.exe` retorna `BUG (fork bomb)` |
| Staging | **Assumido vazio** — nenhuma operação `git add` nesta fase |
| Working tree | **Grande** — centenas de paths `M`/`??` (snapshot início B7-C): mistura **pacote gateway**, **ops API (M5A/M6A)**, **master/provision**, **HITL**, **backups**, **artefactos temporários** |

### 2.2 Ignorados relevantes (`.gitignore`)

| Padrão | Finalidade |
|--------|------------|
| `.env`, `.env.local`, `*.env` | Secrets locais |
| `docker/dp02b3-isolated/nonce-sidecar.env` | Sidecar clone |
| `docker/dp02b3-isolated/n8n-clone-b4.env` | Env clone n8n |
| `node_modules`, `dist` | Build |

### 2.3 Infra (momento da auditoria)

| Recurso | Estado |
|---------|--------|
| `sentinelaaut-n8n-local` | **Up** — `:5678` host (**live intacto**) |
| Clone `sentinelaaut-n8n-dp02b3-import` | **Exited** |
| Piloto B7 / sidecar B4 | **Exited** |
| PG A4 `sentinelaaut-pg-nonce-test-a4` | **Up** — `127.0.0.1:55440` |
| Volumes clone / A4 | **Preservados** (sem remoção) |

### 2.4 Backups anteriores (presença)

| Pasta | Fase |
|-------|------|
| `backups/d-p0-2b-4b-b3-20261105/` | B3 |
| `backups/d-p0-2b-4b-b5-20261105-b5/` | B5 |
| `backups/d-p0-2b-4b-b6-20261105/` | B6/B7 matriz |
| `backups/d-p0-2b-4b-a5-20261105/` | A5 |
| `backups/sentinela-b16-*`, `backups/hitl-*`, etc. | **NR** / EXCLUDE commit |

**Supabase LIVE:** não acedido nesta auditoria.

---

## 3. Fase 1 — Inventário do pacote (por domínio)

Estados Git: **`M`** = modificado vs HEAD; **`??`** = untracked (snapshot conversação / B2–B7-C); **`A`** = adicionado no índice (não verificado).

### 3.1 Gateway agent-v1 (n8n + espelho harness)

| Caminho | Finalidade | Git | Relação agent-v1 |
|---------|------------|-----|------------------|
| `scripts/n8n-harness/agentGatewayValidate.n8n.js` | Código nó n8n (HMAC, rawBody, nonce HTTP) | `??`/M | **Core** |
| `scripts/n8n-harness/agentGatewayV1.ts` + `.test.ts` | Contrato canónico agent-v1 | `??` | **Core** |
| `scripts/n8n-harness/agentGatewayRawBody.ts` + test | rawBody / body strip | `??` | **Core** |
| `scripts/n8n-harness/agentGatewayNonceMode.ts` + test | memory_test / persistent / unavailable | `??` | **Core** |
| `scripts/n8n-harness/agentGatewayTenantPolicy.ts` + test | Tenant fail-closed | `??` | **Core** |
| `scripts/n8n-harness/agentGatewayWorkflowPolicy.ts` + test | Política workflow | `??` | **Core** |
| `scripts/n8n-harness/agentGatewayHarnessRuntime.ts` + test | Gate runtime local_n8n / vitest | `??` | **Core** |
| `scripts/n8n-harness/agentGatewayHttpNonceStore.ts` + test | Cliente HTTP consume | `??` | **Core** |
| `scripts/n8n-harness/agentGatewayPersistentNonceStore.ts` + test | Store persistente | `??` | **Core** |
| `scripts/n8n-harness/agentGatewayN8nVmRuntime.test.ts` | VM n8n | `??` | Teste |
| `scripts/n8n-harness/patch-aut-2f-001-agent-gateway.mjs` + test | Patch gateway no JSON | `??` | Ferramenta |
| `scripts/n8n-harness/patch-aut-2f-001-webhook-response.mjs` + test | B5 Respond Webhook / 401 | `??` | **Core** (resposta) |
| `scripts/n8n-harness/aut-2f-001-agent-gateway.*.test.ts` | Wiring / paridade | `??` | Teste |
| `scripts/n8n-harness/d-p0-1-agent-gateway-matrix.test.ts` | Matriz negativos | `??` | Teste |
| `n8n/workflows/AUT-2F-001-INTENT-ROUTER.json` | Router intents + gateway | `??`/M | **Core** |
| `n8n/shared/hmac-code.js` | HMAC filhos AUT-* | existente | **Core** (filhos) |

### 3.2 API v1 — consume + router

| Caminho | Finalidade | Git |
|---------|------------|-----|
| `api/v1/_lib/router.ts` | Rota `/agent-gateway/nonce/consume` (+ ops M5A/M6A no mesmo diff) | **M** |
| `api/v1/_lib/handlers/agent-gateway/nonce-consume.ts` | Handler consume | `??` |
| `api/v1/_lib/handlers/agent-gateway/nonce-consume.identity.test.ts` | Testes identidade | `??` |
| `api/v1/_lib/agentGateway/*` | Core nonce + identity adapters | `??` |
| `api/_lib/db/pgPool.ts` | Pool PG + transacções | `??` |

### 3.3 Nonce PostgreSQL / migrations

| Caminho | Finalidade |
|---------|------------|
| `supabase/migrations/20261103180000_022_agent_gateway_nonces.sql` (+ rollback) | Schema nonces |
| `supabase/migrations/20261103200000_023_agent_gateway_identity_registry.sql` (+ rollback) | Registry identidade |
| `scripts/n8n-harness/agentGatewayPgNonce.integration.test.ts` | A5 — 11 testes PG descartável |
| `docker/dp02b3-isolated/compose-postgres-nonce-test.yml` | PG teste A4 |

### 3.4 Sidecar + Docker isolado

| Caminho | Finalidade |
|---------|------------|
| `scripts/n8n-harness/agent-gateway-nonce-sidecar.ts` | Entry sidecar |
| `scripts/n8n-harness/run-agent-gateway-nonce-sidecar.mjs` | Launcher |
| `docker/dp02b3-isolated/Dockerfile.nonce-sidecar` | Imagem sidecar |
| `docker/dp02b3-isolated/compose-nonce-sidecar.yml` | Compose (env_file; sem JSON inline pós-B3) |
| `docker/dp02b3-isolated/nonce-sidecar.env.example` | Template (**sem** secrets commitados) |
| `docker/dp02b3-isolated/compose-b4-e2e-pg.yml` | B4 sidecar + DATABASE_URL A4 |
| `docker/dp02b3-isolated/compose-b7-real-pilot.yml` | Piloto real rede isolada |
| `docker/dp02b3-isolated/Dockerfile.api-pilot` | Build Linux piloto |
| `docker/dp02b3-isolated/n8n-clone-b4.env.example` | Template clone (**valores sintéticos documentados**) |

### 3.5 API piloto + readonly (harness G7-H-B — **não** runtime Vercel prod)

| Caminho | Finalidade | Inclusão commit gateway |
|---------|------------|-------------------------|
| `scripts/n8n-harness/local-api-pilot.ts` | HTTP piloto memória + `n8n-pilot-readonly` | **REVIEW** — commit separado ou tag “harness” |
| `scripts/n8n-harness/run-local-api-pilot.mjs` | Strip env LIVE | **REVIEW** |
| `scripts/n8n-harness/pilotIsolationGate.ts` + `.test.ts` | Fail-closed + bind Docker isolado | **REVIEW** (acoplado B7) |
| `scripts/n8n-harness/pilot-http.mjs` | Matriz HTTP loopback | **C** |
| `scripts/n8n-harness/pilot-local-entry.wiring.test.ts` | Regressão estática piloto | **C** |
| `api/v1/_lib/auth/testFixtures.ts` | FIXTURE_CLIENT / readonly | **B** (já existente; usado por testes) |

### 3.6 Harness E2E (`dp04-*`)

| Script | Fase | Prova |
|--------|------|-------|
| `dp04-b4-e2e-matrix.mjs` | B4 | E2E clone |
| `dp04-b4-e2e-webhook-harness.mjs` | B4 | Webhook |
| `dp04-b6-list-events-matrix.mjs` | B6 | Stub (**não** prova prod) |
| `dp04-b7-real-gateway-matrix.mjs` | B7 | Piloto real + LIST_EVENTS |
| `dp04-b7c-router-coverage-matrix.mjs` | B7-C | Leituras + readonly |
| `merge-clone-b6-env.mjs` / `merge-clone-b7-env.mjs` | B6/B7 | Gera env gitignored |
| `b6-isolated-api-stub.mjs` | B6 | **Stub — EXCLUDE** do pacote prod |

### 3.7 Workflows n8n (filhos)

Exports em `n8n/workflows/AUT-*.json` (**35** ficheiros). Pacote agent-v1 **exige** AUT-2F-001; filhos 3B/010 validados E2E (B7-C). Demais AUT-* — implementação repo **≠** prova E2E completa.

### 3.8 Documentação evidências

| Relatório | Incluir no commit? |
|-----------|-------------------|
| `SENTINELAAUT-D-P0-2B-4B-A*.md`, `B0`–`B2` | **INCLUDE** |
| `B3`–`B7`, `B7-C`, **B8** (este) | **INCLUDE** |
| `docs/evidence/isolated/d-p0-1/CLONE-NONCE-PERSISTENCE-ENV-TEMPLATE.env.example` | **INCLUDE** |

### 3.9 Config raiz

| Ficheiro | Nota |
|----------|------|
| `.env.example` | Secção Agent Gateway + API v1 — placeholders `troque-me` |
| `.gitignore` | Entradas env Docker clone/sidecar — **INCLUDE** |
| `package.json` / `package-lock.json` | `pg`, `@types/pg`, scripts `pilot:*` — **REVIEW** diff mínimo |

---

## 4. Fase 2 — Classificação A–H

| Cat. | Descrição | Exemplos |
|------|-----------|----------|
| **A** | Código produção gateway + consume API | `agentGateway/*`, `nonce-consume.ts`, `pgPool.ts`, migrations 022/023 |
| **B** | Testes automatizados | `*.test.ts` harness + `nonce-consume.identity.test.ts` |
| **C** | Harness / ferramentas | `dp04-*`, patches `.mjs`, sidecar launcher, smoke |
| **D** | Docker isolado | `docker/dp02b3-isolated/*` |
| **E** | Docs evidências | `docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-*.md` |
| **F** | Temporários | `_tmp_b7c_matrix.json`, `_tmp_b7c_intent_routes.json`, `_tmp_*.sqlite`, `scripts/n8n-harness/b7c-matrix-output.json`, `_tmp_g7hb_pilot_raw.json` |
| **G** | Backups | `backups/**`, patches na raiz `SENTINELAAUT-WORKTREE-BACKUP-*.patch` |
| **H** | Sem relação directa pacote gateway | `api/master/**`, `api/_lib/admin/provision*`, `hitlCustody*`, `App.tsx`, suites M5A/M6A extensas, `backups/sentinela-b16-*` |

### Avaliação pedida na spec

| Artefacto | Classificação | Decisão |
|-----------|---------------|---------|
| `_tmp_b7c_matrix.json` | **F** | **EXCLUDE** (evidência local; conteúdo resumido nos relatórios B7-C/B8) |
| `_tmp_b7c_intent_routes.json` | **F** | **EXCLUDE** ou **REVIEW** (derivado do router; pode regenerar) |
| `dp04-*` | **C** | **INCLUDE** (rastreabilidade E2E) |
| `nonce-sidecar.env.example` | **D/E** | **INCLUDE** |
| `n8n-clone-b4.env.example` | **D/E** | **INCLUDE** com nota: placeholders sintéticos **não** são secrets prod |
| Env reais (`nonce-sidecar.env`, `n8n-clone-b4.env`) | gitignored | **BLOCKED** |
| Backups B3–B7 | **G** | **EXCLUDE** |
| `b6-isolated-api-stub.mjs` | **C/F** | **EXCLUDE** do commit prod |
| `package-lock.json` | **A** | **INCLUDE** se `pg` for commitado |
| `router.ts` | **A** | **REVIEW** — diff misto gateway + operations |

---

## 5. Fase 3 — Auditoria de segurança (estática)

| Verificação | Resultado |
|-------------|-----------|
| Secrets hardcoded produção | **Não encontrados** em `api/v1/_lib/agentGateway` |
| `service_role` no frontend | **Não** — `App.tsx` só menciona anon key / mensagem config |
| `.env` commitado | **Bloqueado** por `.gitignore` |
| Defaults sintéticos harness | **Presentes** (`test-secret-do-not-use-in-prod`, `b4-e2e-*-not-production`) — **aceitável** em teste/E2E; **não** usar em prod |
| `merge-clone-b6-env.mjs` | Escreve secrets sintéticos para ficheiro **gitignored** |
| `n8n-clone-b4.env.example` | Contém strings de teste documentadas — **REVIEW** (risco confusão operacional) |
| Logs com secrets | Relatórios e matrizes **sem** valores reais; handlers logam códigos (`pgPool` phase/code) |
| Fail-closed gateway | Coberto por testes (401/503/replay) |
| Tenant policy | Código + testes; E2E multi-tenant **incompleto** (B7-C) |
| Identidade consume | Registry env / PG 023 — exige config servidor |

**npm audit (read-only, sem fix):** advisories em cadeia dev/transitiva (`@babel/core`, `@xmldom/xmldom`, `@protobufjs/utf8`, etc.) — **não** corrigido na B8; **REVIEW** antes release app completa (muitas **não** são só gateway).

---

## 6. Fase 4 — Auditoria de dependências

| Dependência | Onde usada | Necessária gateway? |
|-------------|------------|---------------------|
| `pg` ^8.13.1 | `pgPool.ts`, `identityRegistryPg.ts`, `nonce-consume` | **Sim** (modo PostgreSQL nonce/registry) |
| `@types/pg` | dev | **Sim** (TypeScript) |
| `vitest` | harness tests | Dev |
| `vite` / `vite-node` | piloto local | Dev/harness apenas |

**Lockfile:** entrada `pg` presente em `package-lock.json`. **Não** executado `npm install`/`ci` nesta B8 (sem alterar lock).

**Gateway mínimo runtime (Vercel/serverless):** `pg` + código API + env `DATABASE_URL` + migrations 022/023 (conforme modo escolhido).

---

## 7. Fase 5 — Testes e evidências

### 7.1 Rastreabilidade

| Camada | Implementação | Testes | Relatório |
|--------|---------------|--------|-----------|
| agent-v1 HMAC | `agentGatewayV1.ts`, `Validate.n8n.js` | 26+ testes V1, VM runtime | B2, B5 |
| rawBody | `agentGatewayRawBody.ts` | `.test.ts` | B5 |
| Resposta webhook | `patch-aut-2f-001-webhook-response.mjs` | `.test.ts` | B5 |
| Nonce PG | `nonceConsumeCore`, sidecar | A5 11/11 integration | A4, A5, B7 |
| E2E LIST_EVENTS | AUT-010 | `dp04-b7*` | B7 |
| E2E leituras 3B | AUT-3B-* | `dp04-b7c*` | B7-C |
| Readonly client | `local-api-pilot.ts` | E2E B7-C direct HTTP | B7-C |

### 7.2 Regressão B7-C (referência)

| Tipo | Resultado |
|------|-----------|
| Unitário / integração código | **188/188** `scripts/n8n-harness` Vitest |
| Persistência | A5 PG integration **PASS** |
| E2E | B7 matriz + B7-C matriz **PASS** (isolado) |
| Segurança E2E | Replay/concorrência B7; readonly 403/401 B7-C |

### 7.3 Lacunas B7-C (não marcar como prontas)

- HITL / **SENSITIVE** (AUT-004, 008, 2A-002, 2C-003, 2F-002)
- Fluxos **FROM_CONTEXT** (2B-003, 2C-002, 2D-002)
- **GET_BOLETO** (AUT-009) vs **QUERY_BOLETO** (2D-001) — só QUERY E2E
- **Idempotência escrita via router** — NOT TESTED
- **Concorrência escrita** via router — NOT TESTED
- **Multi-tenant E2E completo** — NOT TESTED

---

## 8. Fase 6 — Matriz INCLUDE / EXCLUDE / REVIEW / BLOCKED

| Caminho | Estado Git* | Cat. | Incluir? | Justificativa |
|---------|-------------|------|----------|---------------|
| `api/_lib/db/pgPool.ts` | `??` | A | **INCLUDE** | Pool PG A5/consume |
| `api/v1/_lib/agentGateway/**` | `??` | A/B | **INCLUDE** | Pacote gateway |
| `api/v1/_lib/handlers/agent-gateway/**` | `??` | A/B | **INCLUDE** | HTTP consume |
| `api/v1/_lib/router.ts` | M | A | **REVIEW** | Inclui rotas ops fora gateway — separar diff ou commit conjunto documentado |
| `supabase/migrations/20261103*_022_*` | `??` | A | **INCLUDE** | Schema nonce |
| `supabase/migrations/20261103*_023_*` | `??` | A | **INCLUDE** | Registry (se modo PG) |
| `scripts/n8n-harness/agentGateway*` (core) | `??` | B/C | **INCLUDE** | Contrato + testes |
| `scripts/n8n-harness/patch-aut-2f-001-*.mjs` + tests | `??` | C | **INCLUDE** | B5/B16 |
| `scripts/n8n-harness/agent-gateway-nonce-sidecar.ts` + run | `??` | A/C | **INCLUDE** | Sidecar A3 |
| `scripts/n8n-harness/dp02b3-nonce-*.mjs` | `??` | C | **INCLUDE** | Smoke |
| `scripts/n8n-harness/dp04-b4*.mjs`, `dp04-b7*.mjs`, `dp04-b7c*.mjs` | `??` | C | **INCLUDE** | E2E evidência |
| `scripts/n8n-harness/dp04-b6-list-events-matrix.mjs` | `??` | C | **REVIEW** | Stub era prova B6 — histórico |
| `scripts/n8n-harness/b6-isolated-api-stub.mjs` | `??` | F | **EXCLUDE** | Stub |
| `scripts/n8n-harness/merge-clone-b6-env.mjs` | `??` | C | **INCLUDE** | Ops clone |
| `scripts/n8n-harness/merge-clone-b7-env.mjs` | `??` | C | **INCLUDE** | Ops B7 |
| `scripts/n8n-harness/local-api-pilot.ts` + gate + run | M/`??` | C | **REVIEW** | Harness integração; não é API prod |
| `docker/dp02b3-isolated/**` | `??`/M | D | **INCLUDE** | Isolado + examples |
| `n8n/workflows/AUT-2F-001-INTENT-ROUTER.json` | M/`??` | A | **INCLUDE** | Router |
| `n8n/shared/hmac-code.js` | existente | A | **REVIEW** | Se alterado no working tree |
| `.env.example`, `.gitignore` | M | E | **INCLUDE** | Documentação |
| `docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-*.md` | vários | E | **INCLUDE** | Rastreabilidade |
| `docs/evidence/results/_tmp_*` | `??` | F | **EXCLUDE** | Temp / DB dumps |
| `scripts/n8n-harness/b7c-matrix-output.json` | `??` | F | **EXCLUDE** | Duplicata evidência |
| `package.json` + `package-lock.json` | M | A | **REVIEW** | Commit `pg` + scripts pilot |
| `backups/**` | `??` | G | **EXCLUDE** | Local |
| `docker/**/nonce-sidecar.env`, `n8n-clone-b4.env` | ignorado | — | **BLOCKED** | Secrets |
| `api/master/**`, `provision*`, `hitlCustody*`, `App.tsx`, etc. | M/`??` | H | **EXCLUDE** | Fora pacote agent-v1 |

\*Estado Git inferido — confirmar quando `git` voltar a funcionar.

---

## 9. Fase 7 — Reprodutibilidade (Linux limpo)

| Passo | Viável? | Requisitos (nomes only) |
|-------|---------|-------------------------|
| 1. `npm ci` / install | **Condicional** | Node ≥18; Windows teve EPERM em B3 — Linux preferível |
| 2. Build piloto | **Sim** | `docker build -f docker/dp02b3-isolated/Dockerfile.api-pilot` |
| 3. Gateway n8n | **Sim** | Import AUT-2F-001 + env clone a partir de `.example` |
| 4. Sidecar | **Sim** | `nonce-sidecar.env` from example; rede Docker internal |
| 5. Testes Vitest | **Sim** | `npx vitest run scripts/n8n-harness` |
| 6. PG integration | **Sim** | `SENTINELA_PG_NONCE_TEST_URL` → PG descartável |
| 7. Matriz E2E | **Sim** | Rede `sentinelaaut-n8n-dp02b3-isolated`, containers clone+sidecar+piloto |

**Variáveis obrigatórias (sem valores):**
`SENTINELA_AGENT_GATEWAY_ENABLED`, `SENTINELA_AGENT_GATEWAY_SECRETS`, `SENTINELA_AGENT_GATEWAY_NONCE_STORE`, `SENTINELA_AGENT_GATEWAY_NONCE_CONSUME_URL`, `SENTINELA_AGENT_GATEWAY_INTERNAL_TOKEN`, `SENTINELA_AGENT_GATEWAY_IDENTITY_REGISTRY` ou `DATABASE_URL` + migrations, `B4_*` / `SENTINELA_HARNESS_*` para E2E, `SENTINELA_PILOT_ISOLATED_DOCKER` para piloto em container.

**Produção Vercel:** **NOT VERIFIED** nesta cadeia — exige deploy staging, migrations autorizadas, vault real.

---

## 10. Lista exacta — candidatos ao **próximo commit** (pacote agent-v1)

**Recomendação:** commit **atómico** só com paths abaixo; **não** `git add .`.

```
# API — gateway consume
api/_lib/db/pgPool.ts
api/v1/_lib/agentGateway/allowedKeyIds.ts
api/v1/_lib/agentGateway/allowedKeyIds.test.ts
api/v1/_lib/agentGateway/identityAuth.ts
api/v1/_lib/agentGateway/identityRegistryEnv.ts
api/v1/_lib/agentGateway/identityRegistryEnv.test.ts
api/v1/_lib/agentGateway/identityRegistryPg.ts
api/v1/_lib/agentGateway/nonceConsumeCore.ts
api/v1/_lib/agentGateway/nonceConsumeHttpOutcome.ts
api/v1/_lib/agentGateway/nonceConsumeHttpOutcome.test.ts
api/v1/_lib/agentGateway/nonceConsumeSqlite.ts
api/v1/_lib/handlers/agent-gateway/nonce-consume.ts
api/v1/_lib/handlers/agent-gateway/nonce-consume.identity.test.ts
api/v1/_lib/router.ts

# Migrations
supabase/migrations/20261103180000_022_agent_gateway_nonces.sql
supabase/migrations/20261103180000_022_agent_gateway_nonces.rollback.sql
supabase/migrations/20261103200000_023_agent_gateway_identity_registry.sql
supabase/migrations/20261103200000_023_agent_gateway_identity_registry.rollback.sql

# Harness gateway
scripts/n8n-harness/agentGatewayV1.ts
scripts/n8n-harness/agentGatewayV1.test.ts
scripts/n8n-harness/agentGatewayValidate.n8n.js
scripts/n8n-harness/agentGatewayValidate.n8n.test.ts
scripts/n8n-harness/agentGatewayNonceMode.ts
scripts/n8n-harness/agentGatewayNonceMode.test.ts
scripts/n8n-harness/agentGatewayHarnessRuntime.ts
scripts/n8n-harness/agentGatewayHarnessRuntime.test.ts
scripts/n8n-harness/agentGatewayRawBody.ts
scripts/n8n-harness/agentGatewayRawBody.test.ts
scripts/n8n-harness/agentGatewayTenantPolicy.ts
scripts/n8n-harness/agentGatewayTenantPolicy.test.ts
scripts/n8n-harness/agentGatewayWorkflowPolicy.ts
scripts/n8n-harness/agentGatewayWorkflowPolicy.test.ts
scripts/n8n-harness/agentGatewayHttpNonceStore.ts
scripts/n8n-harness/agentGatewayHttpNonceStore.test.ts
scripts/n8n-harness/agentGatewayPersistentNonceStore.ts
scripts/n8n-harness/agentGatewayPersistentNonceStore.test.ts
scripts/n8n-harness/agentGatewayN8nVmRuntime.test.ts
scripts/n8n-harness/agentGatewayPgNonce.integration.test.ts
scripts/n8n-harness/aut-2f-001-agent-gateway.wiring.test.ts
scripts/n8n-harness/aut-2f-001-agent-gateway.parity.test.ts
scripts/n8n-harness/patch-aut-2f-001-agent-gateway.mjs
scripts/n8n-harness/patch-aut-2f-001-agent-gateway.test.ts
scripts/n8n-harness/patch-aut-2f-001-webhook-response.mjs
scripts/n8n-harness/patch-aut-2f-001-webhook-response.test.ts
scripts/n8n-harness/d-p0-1-agent-gateway-matrix.test.ts
scripts/n8n-harness/agent-gateway-nonce-sidecar.ts
scripts/n8n-harness/run-agent-gateway-nonce-sidecar.mjs
scripts/n8n-harness/dp02b3-nonce-smoke.mjs
scripts/n8n-harness/dp02b3-nonce-restart-smoke.mjs
scripts/n8n-harness/dp04-b4-e2e-matrix.mjs
scripts/n8n-harness/dp04-b4-e2e-webhook-harness.mjs
scripts/n8n-harness/dp04-b7-real-gateway-matrix.mjs
scripts/n8n-harness/dp04-b7c-router-coverage-matrix.mjs
scripts/n8n-harness/merge-clone-b6-env.mjs
scripts/n8n-harness/merge-clone-b7-env.mjs

# Docker isolado
docker/dp02b3-isolated/Dockerfile.nonce-sidecar
docker/dp02b3-isolated/Dockerfile.api-pilot
docker/dp02b3-isolated/compose-nonce-sidecar.yml
docker/dp02b3-isolated/compose-postgres-nonce-test.yml
docker/dp02b3-isolated/compose-b4-e2e-pg.yml
docker/dp02b3-isolated/compose-b7-real-pilot.yml
docker/dp02b3-isolated/nonce-sidecar.env.example
docker/dp02b3-isolated/n8n-clone-b4.env.example

# Workflow + config
n8n/workflows/AUT-2F-001-INTENT-ROUTER.json
.env.example
.gitignore
docs/evidence/isolated/d-p0-1/CLONE-NONCE-PERSISTENCE-ENV-TEMPLATE.env.example
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-A-NEGATIVE-HARNESS-REPORT.md
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-A-NONCE-PERSISTENCE-REPORT.md
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-A1-READONLY-AUDIT-REPORT.md
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-A2-PREFLIGHT-REPORT.md
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-A3-NONCE-SIDECAR-RUNTIME-REPORT.md
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-A4-POSTGRES-NONCE-REPORT.md
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-A5-PG-NONCE-FAILURE-HARDENING-REPORT.md
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B0-NONCE-PREFLIGHT-REPORT.md
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B1-GATEWAY-INTEGRATION-READINESS-REPORT.md
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B2-VERSIONED-GATEWAY-PACKAGE-REPORT.md
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B3-GATEWAY-PACKAGE-CONSOLIDATION-REPORT.md
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B4-E2E-INTEGRATION-REPORT.md
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B5-WORKFLOW-RESPONSE-HARDENING-REPORT.md
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B6-CLONE-CREDENTIAL-ALIGNMENT-REPORT.md
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B7-REAL-GATEWAY-N8N-INTEGRATION-REPORT.md
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B7-C-ROUTER-COVERAGE-REPORT.md
docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B8-FINAL-PACKAGE-AUDIT-REPORT.md

# Dependências
package.json
package-lock.json
```

### Commit separado sugerido (**REVIEW** — harness piloto B7)

```
scripts/n8n-harness/local-api-pilot.ts
scripts/n8n-harness/run-local-api-pilot.mjs
scripts/n8n-harness/pilotIsolationGate.ts
scripts/n8n-harness/pilotIsolationGate.test.ts
scripts/n8n-harness/pilot-local-entry.wiring.test.ts
scripts/n8n-harness/pilotServerShutdown.ts
scripts/n8n-harness/pilotServerShutdown.test.ts
scripts/n8n-harness/pilot-http.mjs
scripts/n8n-harness/dp04-b6-list-events-matrix.mjs
```

---

## 11. Pendências de produção

1. Aplicar migrations **022/023** em ambiente **autorizado** (não LIVE sem gate).
2. Configurar vault: `SENTINELA_AGENT_GATEWAY_SECRETS`, tokens consume, registry identidade.
3. Promover workflow AUT-2F-001 para ambiente alvo (**não** confundir clone isolado com live).
4. Completar E2E lacunas B7-C (HITL, idempotência router, multi-tenant).
5. Validar `router.ts` + handlers ops em **staging** (diff misto).
6. Endurecer npm audit transitivo (app completa).

---

## 12. Riscos conhecidos

| # | Risco |
|---|--------|
| 1 | Commit único da working tree **contamina** gateway com master/provision/HITL |
| 2 | `git` indisponível — lista INCLUDE **não** validada com `git diff` linha a linha |
| 3 | Defaults sintéticos em examples — confusão se copiados para prod |
| 4 | `pg` no bundle principal — superfície DB se `DATABASE_URL` mal configurado |
| 5 | PASS WITH CONDITIONS **≠** go-live |

---

## 13. Recomendação — próxima etapa

1. **Reparar Git** no host ou usar outra máquina/CI para `git status` + diff review.
2. **Staging manual:** `git add` **apenas** lista §10 (paths exactos).
3. **Commit atómico** mensagem tipo: `feat(agent-gateway): agent-v1 consume, PG nonce, n8n harness B4–B7-C`.
4. **PR** com checklist: Vitest harness + job opcional PG A4; **sem** deploy auto prod.
5. **Fase pós-B8:** staging API + n8n + migration 022 em ambiente descartável.

---

## 14. Gate final B8

| # | Confirmação |
|---|-------------|
| 1 | **Nenhum ficheiro de código alterado** pela auditoria B8 excepto **este relatório** |
| 2 | **Nenhum** ficheiro staged (sem `git add`) |
| 3 | **Sem** commit / push / deploy |
| 4 | **n8n live** intacto |
| 5 | **Supabase LIVE** intacto |
| 6 | Relatório entregue |
| 7 | **Aguardar autorização expressa** para staging/versionamento |

**A B8 prepara a decisão. Não executa versionamento.**
