# SENTINELAAUT — D-P0-2B-4B-B2 — Pacote versionável Gateway agent-v1

**Data/hora:** 2026-11-05 ~10:23 (UTC-3)
**Modo:** READ-ONLY + testes Vitest locais **sem** Docker, **sem** `git add`/`commit`/`push`, **sem** alteração de código ou infra
**HEAD de referência:** `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68`
**Referências:** B1, A3, A4, A5, B0

---

## 1. Resumo executivo

Foi inventariado o **pacote lógico** do Gateway agent-v1 (HMAC no n8n, API `nonce/consume`, adapters SQLite/PG, sidecar clone, migrations 022/023, workflow AUT-2F-001, testes e Docker isolado). A implementação está **coerente no working tree** e **174 testes Vitest** passaram **sem infraestrutura externa**. O pacote **ainda não está rastreado pelo Git** (quase tudo `??`); o `HEAD` commitado **não** contém rota `agent-gateway` nem dependência `pg`.

### Veredito: **`PASS WITH CONDITIONS`**

**Condições:** (1) futuro commit deve usar a **lista exacta** da §10; (2) **revisar** tokens sintéticos em `compose-nonce-sidecar.yml` antes de publicar; (3) alinhar `package.json`/`package-lock.json` com dependência `pg`; (4) desacoplar ou documentar alterações **não-gateway** em `router.ts`; (5) integração PG/n8n E2E permanece **NOT VERIFIED** (teste `agentGatewayPgNonce.integration.test.ts` excluído nesta fase por exigir PostgreSQL).

---

## 2. SHA e estado Git

| Item | Valor |
|------|--------|
| Branch | `main` |
| SHA inicial / final | `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` (inalterado; **sem commit**) |
| `git diff --cached` | **Vazio** |
| Divergência vs baseline | Pacote gateway **untracked**; `api/v1/_lib/router.ts` **modificado** (+5 linhas: areas, availability, **agent-gateway/nonce/consume**) |

### Confirmação operacional B2

- **Não** executado: `git add`, `commit`, `push`, migrations, containers, env, workflows live, Supabase LIVE.
- **Único ficheiro criado:** este relatório.

---

## 3. Inventário por categoria

### 3.1 Gateway agent-v1 (n8n + contrato)

| Artefacto | Estado Git | Notas |
|-----------|------------|--------|
| `scripts/n8n-harness/agentGatewayV1.ts` | `??` | Contrato HMAC, canonical, validate |
| `scripts/n8n-harness/agentGatewayValidate.n8n.js` | `??` | Paridade n8n Code node |
| `scripts/n8n-harness/agentGatewayRawBody.ts` | `??` | Strip campos não confiáveis |
| `scripts/n8n-harness/agentGatewayNonceMode.ts` | `??` | Allowlist `NONCE_STORE` |
| `scripts/n8n-harness/agentGatewayHarnessRuntime.ts` | `??` | Gate `memory_test` |
| `scripts/n8n-harness/agentGatewayTenantPolicy.ts` | `??` | Tenant no body |
| `scripts/n8n-harness/agentGatewayWorkflowPolicy.ts` | `??` | Política workflow |
| `scripts/n8n-harness/agentGatewayHttpNonceStore.ts` | `??` | Cliente HTTP → consume API |
| `scripts/n8n-harness/agentGatewayPersistentNonceStore.ts` | `??` | SQLite/PG in-process |
| `n8n/workflows/AUT-2F-001-INTENT-ROUTER.json` | `??` | Webhook `rawBody: true` + Validate Gateway |

### 3.2 API nonce consume + adapters

| Artefacto | Estado Git |
|-----------|------------|
| `api/v1/_lib/handlers/agent-gateway/nonce-consume.ts` | `??` |
| `api/v1/_lib/agentGateway/nonceConsumeCore.ts` | `??` |
| `api/v1/_lib/agentGateway/nonceConsumeSqlite.ts` | `??` |
| `api/v1/_lib/agentGateway/nonceConsumeHttpOutcome.ts` | `??` |
| `api/v1/_lib/agentGateway/allowedKeyIds.ts` | `??` |
| `api/v1/_lib/agentGateway/identityAuth.ts` | `??` |
| `api/v1/_lib/agentGateway/identityRegistryEnv.ts` | `??` |
| `api/v1/_lib/agentGateway/identityRegistryPg.ts` | `??` |
| `api/_lib/db/pgPool.ts` | `??` |
| `api/v1/_lib/router.ts` | `M` (rota `/agent-gateway/nonce/consume` + rotas ops não-gateway) |

**Routing produção:** `api/_lib/safeApiHandler.ts` → `routeV1Request` (já no `HEAD`); rota nova só efectiva após commit do `router.ts` + handler.

### 3.3 PostgreSQL (A4/A5)

| Artefacto | Estado Git |
|-----------|------------|
| `supabase/migrations/20261103180000_022_agent_gateway_nonces.sql` | `??` |
| `supabase/migrations/20261103180000_022_agent_gateway_nonces.rollback.sql` | `??` |
| `supabase/migrations/20261103200000_023_agent_gateway_identity_registry.sql` | `??` |
| `supabase/migrations/20261103200000_023_agent_gateway_identity_registry.rollback.sql` | `??` |
| `scripts/n8n-harness/agentGatewayPgNonce.integration.test.ts` | `??` | Requer PG descartável (A4/A5) |

### 3.4 SQLite clone / sidecar (A3)

| Artefacto | Estado Git |
|-----------|------------|
| `scripts/n8n-harness/agent-gateway-nonce-sidecar.ts` | `??` |
| `scripts/n8n-harness/run-agent-gateway-nonce-sidecar.mjs` | `??` |
| `scripts/n8n-harness/dp02b3-nonce-smoke.mjs` | `??` | Smoke ops (runtime) |
| `scripts/n8n-harness/dp02b3-nonce-restart-smoke.mjs` | `??` |
| `docker/dp02b3-isolated/Dockerfile.nonce-sidecar` | `??` |
| `docker/dp02b3-isolated/compose-nonce-sidecar.yml` | `??` |
| `docker/dp02b3-isolated/compose-postgres-nonce-test.yml` | `??` | PG descartável A4 |

### 3.5 Testes automatizados (pacote)

17 ficheiros Vitest executados na B2 (§8) + 1 integração PG **não** executada. Ver lista completa §10.

### 3.6 Documentação e evidência

| Artefacto | Decisão |
|-----------|---------|
| `docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-A3…` … **B1** | **INCLUIR** (rastreabilidade) |
| `docs/evidence/isolated/d-p0-1/CLONE-NONCE-PERSISTENCE-ENV-TEMPLATE.env.example` | **INCLUIR** (sem valores reais) |
| `docs/evidence/isolated/d-p0-1/AUT-2F-001-INTENT-ROUTER-D-P0-1.json` | **REVISAR** (duplicado vs `n8n/workflows/`) |
| `.env.example` (secção gateway, `M`) | **INCLUIR** (placeholders `troque-me`) |

### 3.7 Excluir do pacote (NÃO RELACIONADO / temporário)

| Padrão | Motivo |
|--------|--------|
| `backups/**` (incl. `d-p0-2b-4b-a5-20261105/`) | Cópias locais, não entrega |
| `api/_lib/admin/**`, `api/_lib/handlers/admin/**` | Fora escopo gateway |
| `api/v1/_lib/protectedHandler.pre-*.backup.ts` | Backups locais |
| `scripts/n8n-harness/pilot-*`, `run-local-api-pilot*`, `b16c-*`, `demo-n8n-local-check.mjs` | Piloto G7-H-B, não agent-v1 |
| `scripts/n8n-harness/pilot-env-empty/` | Artefacto efémero |
| Ficheiros `??` massivos de HITL, M5A, M8A em `api/v1/_lib/execution/` | Outros épicos |
| `SENTINELAAUT-*-UNTRACKED-LIST*.txt`, patches soltos na raiz | Temporários |

---

## 4. Auditoria de integridade (estática)

| Verificação | Resultado |
|-------------|-----------|
| Sidecar → handler | `agent-gateway-nonce-sidecar.ts` importa `nonce-consume.ts` — **OK** |
| Harness PG store → core | `agentGatewayPersistentNonceStore.ts` → `withPgTransaction` + `consumeNoncePg` — **OK** |
| Harness HTTP → API | `agentGatewayHttpNonceStore.ts` → `mapNonceConsumeHttpStatus` — **OK** |
| Handler → PG/SQLite | Prioridade SQLite path, senão `DATABASE_URL` — **OK** |
| Identity consume | `identityAuth.ts` → env registry **ou** `identityRegistryPg` (modo postgres) — **OK** |
| Testes ↔ módulos | 174 testes locais **PASS** — **OK** |
| Dependência npm `pg` | Presente no **working tree** `package.json`; **ausente no HEAD** — **GAP** |
| `node:sqlite` | Usado em testes/handler; experimental Node — **documentado** |
| Duplicação | `agentGatewayValidate.n8n.js` espelha `agentGatewayV1.ts` (intencional) — **OK** |
| Conflito alternativo | Nenhum segundo adapter PG encontrado — **OK** |
| Ficheiros em falta | Imports cruzados amostrados resolvem — **OK** |
| `api/_lib/v1ApiEntry.ts` | `??`, não necessário se `safeApiHandler` já roteia v1 — **NÃO RELACIONADO** (revisar separadamente) |

---

## 5. Matriz de segurança (estática)

| Controlo | Evidência | Classificação |
|----------|-----------|---------------|
| HMAC agent-v1 | `agentGatewayV1.ts` + testes | **PASS** |
| rawBody | Workflow + `AGENT_RAW_BODY_MISSING` | **PASS** (repo) |
| Timestamp / janela | `checkTimestamp` + env window | **PASS** |
| Nonce / replay | Store + regex; API **409**; webhook **401** agregado | **PASS** / **PARTIAL** (semântica HTTP externa) |
| PG fail-closed | A5 em `pgPool.ts` (uncommitted) | **PASS** (código) |
| key_id allowlist | `allowedKeyIds.ts` + consume handler | **PASS** |
| Identity / tenant body | Strip + registry; PG 023 opcional | **PASS** |
| service_role no frontend | Sem refs em `agentGateway*` / handler | **PASS** (amostra) |
| Secrets em ficheiros versionáveis | `.env.example`: placeholder `troque-me`; template clone **sem** valores | **PASS** |
| **Risco:** `compose-nonce-sidecar.yml` | JSON inline com token **sintético** `…-not-production` | **REVISAR** → preferir env file / sem token no YAML |
| **Risco:** `compose-postgres-nonce-test.yml` | Password descartável **documentada** | **INCLUIR** com rótulo descartável (A4) |
| Backups locais | `backups/d-p0-2b-4b-a5/` cópias pré-A5 | **EXCLUIR** do commit |

---

## 6. Migrations 022 e 023 (inspecção SQL apenas)

| Migration | Objetivo | RLS | Relação gateway |
|-----------|----------|-----|-----------------|
| **022** | Tabela `agent_gateway_nonces` PK `(key_id, nonce)`, índice `expires_at` | **Não** definida no SQL | **Obrigatória** para nonce PG |
| **023** | `agent_gateway_identities`, `identity_keys`, `internal_credentials` (hash SHA-256) | Comentário: uso service/DATABASE_URL, sem RLS app | **Opcional** se `IDENTITY_REGISTRY_MODE=env`; **obrigatória** para registry PG |

**Multi-tenant:** nonce **não** carrega tenant; isolamento depende de **credencial n8n** + RBAC API v1 pós-intent. Migration 023 liga **identity ↔ key_id**, não condomínio directamente.

**B2:** **Nenhum** SQL executado.

---

## 7. Testes executados na B2 (sem Docker / sem PG)

| Comando | Ficheiros | Testes | Resultado | Duração |
|---------|-----------|--------|-----------|---------|
| `npx vitest run` (17 ficheiros gateway listados abaixo) | Ver §10 testes | **167** | **PASS** | ~6,8s |
| `npx vitest run scripts/n8n-harness/agentGatewayN8nVmRuntime.test.ts` | 1 | **7** | **PASS** | ~3,0s |
| **Total B2** | 18 | **174** | **PASS** | ~10s |

### Não executados (limitação declarada)

| Teste | Motivo |
|-------|--------|
| `agentGatewayPgNonce.integration.test.ts` | Requer PostgreSQL (`127.0.0.1:55440`) — **infra** |
| `dp02b3-nonce-smoke.mjs` | Requer containers/rede Docker |
| Runtime A3/A4/A5 histórico | Já documentado nos relatórios; **NOT RE-RUN** |

---

## 8. Matriz de ficheiros (decisão)

Legenda decisão: **INCL** = INCLUIR NO PACOTE | **EXC** = EXCLUIR | **REV** = REVISAR | **BLK** = BLOQUEADO | **NR** = NÃO RELACIONADO

### API e migrations

| Arquivo | Git | Finalidade | Necessário? | Risco | Decisão |
|---------|-----|------------|-------------|-------|---------|
| `api/_lib/db/pgPool.ts` | `??` | Pool + transacções A5 | Sim | Baixo | **INCL** |
| `api/v1/_lib/agentGateway/*` (8 TS + 2 test) | `??` | Adapters, identity, nonce core | Sim | Baixo | **INCL** |
| `api/v1/_lib/handlers/agent-gateway/nonce-consume.ts` | `??` | HTTP consume | Sim | Baixo | **INCL** |
| `api/v1/_lib/handlers/agent-gateway/nonce-consume.identity.test.ts` | `??` | Testes handler | Sim | Baixo | **INCL** |
| `api/v1/_lib/router.ts` | `M` | Registo rota consume | Sim | Médio (diff misto) | **REV** / **INCL** |
| `supabase/migrations/20261103180000_022_*` | `??` | Schema nonce | Sim | Baixo | **INCL** |
| `supabase/migrations/20261103200000_023_*` | `??` | Schema identity | Condicional | Baixo | **INCL** |

### Harness n8n

| Arquivo | Git | Finalidade | Necessário? | Risco | Decisão |
|---------|-----|------------|-------------|-------|---------|
| `agentGatewayV1.ts` + `.test.ts` | `??` | Contrato gateway | Sim | Baixo | **INCL** |
| `agentGatewayValidate.n8n.js` + `.test.ts` | `??` | n8n parity | Sim | Baixo | **INCL** |
| `agentGatewayNonceMode.ts` + `.test.ts` | `??` | Modos store | Sim | Baixo | **INCL** |
| `agentGatewayHarnessRuntime.ts` + `.test.ts` | `??` | Harness gate | Sim | Baixo | **INCL** |
| `agentGatewayRawBody.ts` + `.test.ts` | `??` | Body strip | Sim | Baixo | **INCL** |
| `agentGatewayTenantPolicy.ts` + `.test.ts` | `??` | Tenant policy | Sim | Baixo | **INCL** |
| `agentGatewayWorkflowPolicy.ts` + `.test.ts` | `??` | Workflow policy | Sim | Baixo | **INCL** |
| `agentGatewayHttpNonceStore.ts` + `.test.ts` | `??` | HTTP nonce client | Sim | Baixo | **INCL** |
| `agentGatewayPersistentNonceStore.ts` + `.test.ts` | `??` | SQLite/PG store | Sim | Baixo | **INCL** |
| `agentGatewayN8nVmRuntime.test.ts` | `??` | VM runtime | Sim | Baixo | **INCL** |
| `agentGatewayPgNonce.integration.test.ts` | `??` | PG integração | Sim (CI ops) | Médio (cred descartável no teste) | **INCL** |
| `aut-2f-001-agent-gateway.wiring.test.ts` | `??` | Workflow wiring | Sim | Baixo | **INCL** |
| `aut-2f-001-agent-gateway.parity.test.ts` | `??` | Paridade workflow | Sim | Baixo | **INCL** |
| `patch-aut-2f-001-agent-gateway.mjs` + `.test.ts` | `??` | Ferramenta patch | Opcional | Baixo | **INCL** |
| `d-p0-1-agent-gateway-matrix.test.ts` | `??` | Matriz negativos | Sim | Baixo | **INCL** |
| `d-p0-1-isolated-wiring.test.ts` | `??` | Wiring D-P0-1 | Condicional | Baixo | **REV** |
| `agentGatewayLocalN8nHttp.harness.mjs` | `??` | Harness HTTP live | Ops | Médio | **REV** |
| `agent-gateway-nonce-sidecar.ts` | `??` | Sidecar A3 | Sim | Baixo | **INCL** |
| `run-agent-gateway-nonce-sidecar.mjs` | `??` | Launcher | Sim | Baixo | **INCL** |
| `dp02b3-nonce-smoke.mjs` | `??` | Smoke runtime | Ops | Baixo | **INCL** |
| `dp02b3-nonce-restart-smoke.mjs` | `??` | Smoke restart | Ops | Baixo | **INCL** |

### Docker, workflow, docs

| Arquivo | Git | Finalidade | Necessário? | Risco | Decisão |
|---------|-----|------------|-------------|-------|---------|
| `docker/dp02b3-isolated/*` (3 ficheiros) | `??` | Clone/sidecar/PG test | Sim | Médio (YAML tokens) | **INCL** + **REV** compose sidecar |
| `n8n/workflows/AUT-2F-001-INTENT-ROUTER.json` | `??` | Workflow definitivo repo | Sim | Baixo | **INCL** |
| `docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-*.md` | `??`/`B2` | Evidências | Sim | Baixo | **INCL** |
| `docs/evidence/isolated/d-p0-1/CLONE-NONCE-PERSISTENCE-ENV-TEMPLATE.env.example` | existente | Template clone | Sim | Baixo | **INCL** |
| `.env.example` | `M` | Documentação env | Sim | Baixo (placeholders) | **INCL** |
| `package.json` / `package-lock.json` | `M` | Dep `pg` | Sim | Baixo | **REV** (diff mínimo gateway) |
| `backups/d-p0-2b-4b-a5-20261105/**` | local | Backup A5 | Não | Médio | **EXC** |

---

## 9. Lista exacta recomendada para futuro versionamento

*(Ainda **sem** `git add` — lista de trabalho para B3.)*

```
# API
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

# Harness
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
scripts/n8n-harness/d-p0-1-agent-gateway-matrix.test.ts
scripts/n8n-harness/agent-gateway-nonce-sidecar.ts
scripts/n8n-harness/run-agent-gateway-nonce-sidecar.mjs
scripts/n8n-harness/dp02b3-nonce-smoke.mjs
scripts/n8n-harness/dp02b3-nonce-restart-smoke.mjs

# Docker isolado
docker/dp02b3-isolated/Dockerfile.nonce-sidecar
docker/dp02b3-isolated/compose-nonce-sidecar.yml
docker/dp02b3-isolated/compose-postgres-nonce-test.yml

# Workflow
n8n/workflows/AUT-2F-001-INTENT-ROUTER.json

# Config / docs
.env.example
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

# Dependências (revisar diff)
package.json
package-lock.json
```

**Opcional / REVISAR antes do commit:** `scripts/n8n-harness/d-p0-1-isolated-wiring.test.ts`, `agentGatewayLocalN8nHttp.harness.mjs`, `docs/evidence/isolated/d-p0-1/AUT-2F-001-INTENT-ROUTER-D-P0-1.json`.

---

## 10. Bloqueios e riscos

| # | Bloqueio | Impacto |
|---|----------|---------|
| 1 | Pacote **não commitado** | Deploy a partir de `HEAD` **sem** gateway |
| 2 | `pg` só no working tree | Runtime API PG falha até alinhar lockfile |
| 3 | E2E n8n + PG **não** reproduzido na B2 | Integração definitiva **bloqueada** até fase ops |
| 4 | Tokens sintéticos no compose sidecar | Risco de confusão operacional — **REV** |
| 5 | `router.ts` acoplado a rotas M5A/M6A | Commit gateway pode arrastar ops — **REV** diff |
| 6 | Workflow live vs repo | **NOT VERIFIED** (B0/B1) |

---

## 11. Plano de integração (fases futuras)

1. **Gateway agent-v1** — env n8n: `ENABLED`, `SECRETS`, `NONCE_STORE=persistent`, `HARNESS_RUNTIME=local_n8n`.
2. **PostgreSQL nonce** — migration **022** em ambiente alvo; `DATABASE_URL` no consume API.
3. **API consume** — sidecar SQLite (A3) **ou** API Vercel/staging com rota commitada.
4. **Webhook rawBody** — confirmar opção no container clone.
5. **HMAC** — headers `X-Agent-*`; path canónico `/webhook/sentinelaaut/aut-2f-001`.
6. **Identidade** — `IDENTITY_REGISTRY` (env) ou **023** + `IDENTITY_REGISTRY_MODE=postgres`.
7. **Autorização operação** — intents AUT-* + API v1 `protectedHandler`.
8. **Workflows** — Execute Workflow pós `_agentGatewayPassed`.
9. **Idempotência** — camada G7 API (separada do nonce gateway).
10. **Auditoria** — event store G7 ( **NOT VERIFIED** ligação webhook).
11. **Resposta canal** — ramos n8n downstream (WhatsApp/meta).

**Endpoints:** `POST /webhook/sentinelaaut/aut-2f-001` (n8n); `POST /api/v1/agent-gateway/nonce/consume` (interno).
**Variáveis:** ver `.env.example` e template `CLONE-NONCE-PERSISTENCE-ENV-TEMPLATE.env.example` (nomes apenas).

---

## 12. Plano recomendado B3 → B5

| Fase | Objectivo |
|------|-----------|
| **B3** | `git add` **somente** lista §9; commit atómico; CI Vitest (174 + integração PG opcional job). |
| **B4** | Subir clone + sidecar; smoke HMAC + HTTP nonce; opcional PG descartável; **sem** live. |
| **B5** | Staging API + migration 022; n8n clone `persistent` → URL staging; gate antes de produção. |

---

## 13. Encerramento

A B2 entrega **inventário**, **matriz de decisão**, **174 testes PASS** locais, e **lista exacta** para versionamento. A integração definitiva continua **condicionada** a commit (B3) e validação runtime (B4/B5).

**PARAR — aguardar autorização expressa. Não executar B3 nem `git add`.**
