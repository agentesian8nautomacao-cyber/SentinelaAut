# SENTINELAAUT — D-P0-2B-4B-B7-C — Router Coverage & Operational Workflow Readiness

**Data:** 2026-11-05
**Branch:** `main`
**SHA:** `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68`
**Veredito:** **PASS WITH CONDITIONS**

---

## 1. Resumo executivo

A B7-C completou o **inventário** do router agent-v1 (AUT-2F-001), do gateway HTTP `/api/v1` e dos workflows exportados em `n8n/workflows/`, e executou **E2E real** no stack isolado B7 (clone n8n + sidecar nonce PG A4 + API piloto Linux).

**Comprovado E2E (gateway → filho → HMAC API v1 → piloto em memória):**

- Regressão **LIST_EVENTS** (AUT-010).
- **Leituras 3B** (AUT-3B-001…005) + **QUERY_BOLETO** (AUT-2D-001).
- Amostra **escrita** CREATE_PACKAGE (AUT-003), CREATE_OCCURRENCE (AUT-005), **IDENTIFY_RESIDENT** (AUT-001).

**Cliente `n8n-pilot-readonly`:** validado **directamente** contra o piloto (403 em operações sem permissão; 401 sem assinatura).

**Lacunas honestas:** intents **SENSITIVE** / HITL / contexto (2A-002, 2B-001/003, 2C-002/003, 2D-002/003, 2F-002, AUT-004/008/009), idempotência/concorrência de escrita via router, e auditoria de event store LIVE — **NOT TESTED** ou **NOT IMPLEMENTED** no clone.

n8n **live** e Supabase **LIVE** não foram tocados. Sem `git add` / commit / push.

---

## 2. Fase 0 — Pré-check (read-only)

| # | Verificação | Evidência |
|---|-------------|-----------|
| 1 | Relatórios B4–B7 lidos | `docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B{4,5,6,7}-*.md` |
| 2 | Branch / HEAD | `main` @ `f0d76cc…` (`.git/refs/heads/main`; `git.exe` indisponível — fork bomb no host) |
| 3 | Working tree | Múltiplos M/?? pré-existentes (B4–B7); **nenhum commit** nesta fase |
| 4 | Containers | Clone/sidecar/piloto B7 **Exited** no início; PG A4 **Up**; live **Up** |
| 5 | B7 parado antes dos testes | **Sim** (Exited 137) |
| 6 | n8n live separado | `sentinelaaut-n8n-local` **Up** `:5678` — não usado para tráfego B7-C |
| 7 | Rede / portas | `sentinelaaut-n8n-dp02b3-isolated` **Internal: true**; piloto B7 **sem** `PortBindings`; PG A4 `127.0.0.1:55440` |
| 8 | Backups | Volumes A3/A4 preservados; artefactos B6/B7 em `backups/d-p0-2b-4b-b6-20261105/` |
| 9 | Scripts B7 | `dp04-b7-real-gateway-matrix.mjs`, `merge-clone-b7-env.mjs`, `Dockerfile.api-pilot`, etc. |
| 10 | Supabase LIVE | **Não** configurado no piloto (`pilotIsolationGate` bloqueia env LIVE) |

**Risco produção:** nenhum bloqueio — execução só na rede internal + piloto sintético.

---

## 3. Inventário gateway HTTP (`api/v1/_lib/router.ts`)

| Método | Path | Handler (lazy) | Auth API v1 | Tipo |
|--------|------|----------------|-------------|------|
| GET | `/health` | `handlers/health` | Não | Leitura |
| GET | `/events` | `handlers/events` | HMAC + RBAC | Leitura |
| GET | `/boletos` | `handlers/boletos` | HMAC + RBAC | Leitura |
| GET | `/authz-probe` | `handlers/authz-probe` | Probe | — |
| GET | `/confirmation-probe` | `handlers/confirmation-probe` | Probe | — |
| GET | `/protected-probe` | `handlers/protected-probe` | HMAC | Leitura |
| GET | `/residents/identify` | `residents/identify` | HMAC + RBAC | Leitura |
| GET | `/units/identify` | `units/identify` | HMAC + RBAC | Leitura |
| GET/POST | `/operations/occurrences` | `operations/occurrences` | HMAC + idempotência (POST) | R/W |
| PATCH | `/operations/occurrences/update` | `occurrences/update` | HMAC | Escrita |
| GET/POST | `/operations/packages` | `operations/packages` | HMAC + idempotência (POST) | R/W |
| POST | `/operations/packages/pickup` | `packages/pickup` | HMAC + confirmação | Sensível |
| GET/POST | `/operations/reservations` | `operations/reservations` | HMAC + idempotência (POST) | R/W |
| POST | `/operations/reservations/cancel` | `reservations/cancel` | HMAC | Sensível |
| GET | `/operations/reservations/availability` | `reservations/availability` | HMAC | Leitura |
| GET | `/operations/areas` | `operations/areas` | HMAC | Leitura |
| POST | `/agent-gateway/nonce/consume` | `agent-gateway/nonce-consume` | Token interno | Persistência nonce |

**Agent-v1 (n8n):** nó `Validate Agent Gateway` em AUT-2F-001 — HMAC `agent-v1`, `rawBody`, timestamp, `key_id`, nonce via sidecar PG; espelho em `scripts/n8n-harness/agentGatewayValidate.n8n.js`.

**Entrada única n8n (webhook):** `POST /webhook/sentinelaaut/aut-2f-001` → allowlist `INTENT_*` → Execute Workflow filho.

Mapa de intents (código real do router): `docs/evidence/results/_tmp_b7c_intent_routes.json` (**27 intents**).

---

## 4. Inventário n8n (export repo + meta AUT-2F-001)

| Fonte | Contagem / nota |
|-------|-----------------|
| Ficheiros `n8n/workflows/AUT-*.json` | **35** exports (incl. backups `.pre-*`, WA pilots) |
| `meta.composed_of` AUT-2F-001 | **25** AUT filhos referenciados |
| Intents no router (allowlist) | **27** chaves (incl. `HITL_RESUME`) |
| Clone runtime | Volume `sentinelaaut-n8n-dp02b3-work-data` — **não inspecionado SQLite**; E2E prova filhos resolvíveis no clone |

Workflows **3B** e **010** seguem padrão: Validate → Generate HMAC (`$env` tenant) → HTTP Request → envelope (`sql_access: 0`).

---

## 5. Matriz rotas / workflows (classificação B7-C)

Legenda **Resultado:** PASS | PASS WITH CONDITIONS | NOT IMPLEMENTED | NOT TESTED | BLOCKED | FAIL.

| Componente / Intent | AUT | Impl. repo | Testado E2E | Persistência | Segurança | Resultado |
|---------------------|-----|------------|-------------|--------------|-----------|-----------|
| LIST_EVENTS | AUT-010 | Sim | Sim (regressão B7 + B7-C) | Memória piloto | agent-v1 + API HMAC | **PASS** |
| LIST_PACKAGES | AUT-3B-001 | Sim | Sim | Memória | Idem | **PASS** |
| LIST_OCCURRENCES | AUT-3B-002 | Sim | Sim | Memória | Idem | **PASS** |
| LIST_RESERVATIONS | AUT-3B-003 | Sim | Sim | Memória | Idem | **PASS** |
| LIST_AREAS | AUT-3B-004 | Sim | Sim | Memória | Idem | **PASS** |
| CHECK_AVAILABILITY | AUT-3B-005 | Sim | Sim | Memória | Idem | **PASS** |
| QUERY_BOLETO | AUT-2D-001 | Sim | Sim | Memória | Idem | **PASS** |
| IDENTIFY_RESIDENT | AUT-001 | Sim | Sim (amostra) | Memória | Idem | **PASS WITH CONDITIONS** (1 cenário) |
| CREATE_PACKAGE | AUT-003 | Sim | Sim (amostra) | Fake DB piloto | Idem | **PASS WITH CONDITIONS** (sem matriz idempotência router) |
| CREATE_OCCURRENCE | AUT-005 | Sim | Sim (amostra) | Fake DB | Idem | **PASS WITH CONDITIONS** |
| IDENTIFY_UNIT | AUT-002 | Sim | Não | — | — | **NOT TESTED** |
| GET_BOLETO | AUT-009 | Sim | Não | — | — | **NOT TESTED** |
| QUERY_BOLETO_BY_RESIDENT_CONTEXT | AUT-2D-002 | Sim | Não | — | — | **NOT TESTED** |
| QUERY_BOLETO_SAFE | AUT-2D-003 | Sim | Não | — | — | **NOT TESTED** |
| CREATE_RESERVATION | AUT-007 | Sim | Não | — | — | **NOT TESTED** |
| UPDATE_OCCURRENCE | AUT-006 | Sim | Não | — | — | **NOT TESTED** |
| REGISTER_PACKAGE | AUT-2A-001 | Sim | Não | — | — | **NOT TESTED** |
| REGISTER_OCCURRENCE | AUT-2B-001 | Sim | Não | — | — | **NOT TESTED** |
| REGISTER_OCCURRENCE_FROM_CONTEXT | AUT-2B-003 | Sim | Não | — | — | **NOT TESTED** |
| CREATE_RESERVATION_FROM_CONTEXT | AUT-2C-002 | Sim | Não | — | — | **NOT TESTED** |
| PICKUP_PACKAGE | AUT-004 | Sim | Não | HITL | — | **NOT TESTED** |
| PICKUP_PACKAGE_HITL | AUT-2A-002 | Sim | Não | HITL | — | **NOT TESTED** |
| CANCEL_RESERVATION | AUT-008 | Sim | Não | HITL | — | **NOT TESTED** |
| CANCEL_RESERVATION_HITL | AUT-2C-003 | Sim | Não | HITL | — | **NOT TESTED** |
| HITL_RESUME | AUT-2F-002 | Sim | Não | Custódia | — | **NOT TESTED** |
| Cliente readonly (piloto) | — | Sim | Sim (direct HTTP) | N/A | 403/401 | **PASS** |
| Escrita idempotência/concorrência via router | — | Parcial | Não | Fake DB | — | **NOT TESTED** |
| Multi-tenant cruzado E2E | — | Código | Não (B7 tenant strip só LIST_EVENTS) | — | — | **NOT TESTED** |

---

## 6. Cliente API readonly (`n8n-pilot-readonly`)

Implementação: `scripts/n8n-harness/local-api-pilot.ts` — credencial com `permission_keys: ['residents.view']` apenas.

Testes **integração real** (piloto container, rede isolada) — evidência: `docs/evidence/results/_tmp_b7c_matrix.json`:

| Caso | HTTP | `error_code` | Interpretação |
|------|------|--------------|---------------|
| `readonly_residents_view_ok` | 200 | — | **PASS** |
| `readonly_packages_denied` | 403 | FORBIDDEN | **PASS** |
| `readonly_events_denied` | 403 | FORBIDDEN | **PASS** |
| `readonly_invalid_signature` | 401 | INVALID_SIGNATURE | **PASS** |
| `write_readonly_create_package_403` | 403 | FORBIDDEN | **PASS** |

**Nota:** `scripts/n8n-harness/pilot-http.mjs` exige loopback — **não** usado como prova E2E Docker; matriz B7-C usa HMAC v1 inline (mesmo contrato).

Testes **unitários** com mock: classificados separadamente nos ficheiros `api/v1/**/*.test.ts` (fora do indicador E2E).

---

## 7. Workflows de leitura (E2E)

Script: `scripts/n8n-harness/dp04-b7c-router-coverage-matrix.mjs`
Execução: `docker run --network sentinelaaut-n8n-dp02b3-isolated …`

Todos os casos `gateway_LIST_*`, `gateway_CHECK_AVAILABILITY`, `gateway_QUERY_BOLETO`: **HTTP 200**, `ok: true`, `dispatched_aut` correto.

---

## 8. Workflows de escrita (E2E)

| Caminho | Resultado |
|---------|-----------|
| POST direto piloto (`n8n-pilot-test`) create package | 200 — `_tmp_b7c_matrix.json` |
| Gateway CREATE_PACKAGE / CREATE_OCCURRENCE | 200 — execução ad hoc isolada (mesma sessão) |
| Idempotência repetida / concorrência escrita via router | **NOT TESTED** |
| SENSITIVE (pickup/cancel/HITL) | **NOT TESTED** (sem custódia descartável exercitada) |

Persistência: **`createFakePersistenceDb`** + stores Supabase-shaped **em memória** — descartável, **não** PostgreSQL operacional nem Supabase LIVE.

---

## 9. Persistência e auditoria

| Mecanismo | B7-C |
|-----------|------|
| Nonce agent-v1 | PG A4 via sidecar — regressão B7 matrix (replay/concorrência) **reexecutada** |
| Dados operacionais piloto | Memória — resets com restart container |
| Event store listado | Seed sintético `createMemoryEventStoreQuery` |
| Auditoria LIVE | **Não aplicável** |

---

## 10. Segurança e multi-tenant

| Controlo | Estado |
|----------|--------|
| agent-v1 HMAC + rawBody | Coberto B7 + regressão matriz B7 |
| Nonce replay / 409 concorrente | Matriz B7 reexecutada — **PASS** |
| API v1 fail-closed readonly | **PASS** (secção 6) |
| Tenant no body webhook | Strip no router; override testado na B7 para LIST_EVENTS — **não repetido** para todos os filhos |
| Logs | Sem secrets nos JSON de evidência |
| `SENTINELA_PILOT_ISOLATED_DOCKER=1` | Piloto B7 bind `0.0.0.0` **sem** publish host — **PASS** |

---

## 11. Docker e isolamento

| Item | Estado |
|------|--------|
| Rede clone | `Internal: true` |
| Piloto B7 portas host | `{}` (vazio) |
| n8n live | Intacto, único bind público `:5678` |
| Encerramento gate | Clone + sidecar + piloto **stopped**; PG A4 **Up** (volume preservado) |

---

## 12. Testes e regressões

| Tipo | Suíte | Resultado |
|------|-------|-----------|
| Unitário / integração código | `npx vitest run scripts/n8n-harness` | **188/188 PASS** (20 ficheiros; incl. A5 PG 11 testes em `agentGatewayPgNonce.integration.test.ts`) |
| Integração | Ajuste `pilot-local-entry.wiring.test.ts` | Alinhado a bind isolado B7 |
| E2E | `dp04-b7c-router-coverage-matrix.mjs` | **PASS** leituras + readonly |
| E2E | `dp04-b7-real-gateway-matrix.mjs` (regressão B7) | **PASS** |
| E2E | Escritas/identify ad hoc (3 intents) | **PASS** amostral |
| Unitário | Matriz B4 completa | **Não reexecutada** (B7/B7-C substituem cenário LIST_EVENTS) |
| Unitário | Matriz B6 stub | **Não reexecutada** (obsoleta para prova) |

**Nota contagem:** B7 reportava **177** testes; working tree actual **188** (+ gate isolado / wiring).

---

## 13. Ficheiros tocados na B7-C (sem commit)

| Ficheiro | Alteração |
|----------|-----------|
| `scripts/n8n-harness/dp04-b7c-router-coverage-matrix.mjs` | **Novo** — matriz cobertura + readonly |
| `scripts/n8n-harness/pilot-local-entry.wiring.test.ts` | Assert bind com `process.env` |
| `docs/evidence/results/_tmp_b7c_matrix.json` | Evidência E2E |
| `docs/evidence/results/_tmp_b7c_intent_routes.json` | Mapa intents router |
| `scripts/n8n-harness/b7c-matrix-output.json` | Cópia de trabalho da matriz |

---

## 14. Backups

Sem novos backups criados. Preservados: volume clone, PG A4, pastas `backups/d-p0-2b-4b-*`, exports `n8n/workflows/`.

---

## 15. Limitações

1. Cobertura E2E **não exaustiva** — 27 intents, ~13 exercitados ponta-a-ponta.
2. Piloto continua **memória** — não prova Vercel/Supabase LIVE.
3. Fluxos **SENSITIVE/HITL** exigem confirmação/custódia — **NOT TESTED**.
4. Clone n8n: IDs de workflow no volume **não** auditados ficheiro a ficheiro (prova operacional via dispatch).
5. `git status` completo bloqueado no host (fork bomb).

---

## 16. Recomendações para B8

1. Matriz E2E **parametrizada** para os 27 intents (payload mínimo válido por SPEC em cada AUT).
2. Escrita: idempotência duplicada + concorrência **via gateway** (não só HTTP directo).
3. SENSITIVE: ambiente HITL descartável + AUT-2F-002 resume.
4. Multi-tenant: caso org/condo B com credencial A para cada operação READ.
5. Validar **GET_BOLETO** vs **QUERY_*** e fluxos **FROM_CONTEXT** (2B/2C/2D).
6. Opcional: inspeção read-only do SQLite do clone vs exports Git (drift).

---

## 17. Gate final

| Critério | OK |
|----------|-----|
| Containers descartáveis parados | Sim |
| Volumes/backups preservados | Sim |
| n8n live intacto | Sim |
| Supabase LIVE intacto | Sim |
| Sem commit/push | Sim |
| B8 não iniciado | Sim |

---

**PASS WITH CONDITIONS** — inventário completo, lacunas explicitadas, leituras 3B + QUERY_BOLETO + readonly comprovados, amostra de escrita/identify, isolamento mantido, regressões automatizadas verdes.
