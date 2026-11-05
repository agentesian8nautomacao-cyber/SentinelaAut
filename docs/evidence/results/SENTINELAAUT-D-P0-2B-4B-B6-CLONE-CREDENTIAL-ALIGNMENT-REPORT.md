# SENTINELAAUT — D-P0-2B-4B-B6 — Clone credential alignment & functional E2E

**Data:** 2026-11-05
**Referência B5:** `docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B5-WORKFLOW-RESPONSE-HARDENING-REPORT.md`
**Escopo:** clone `sentinelaaut-n8n-dp02b3-import`, rede `sentinelaaut-n8n-dp02b3-isolated`, sidecar nonce, PG A4, API sintética no namespace do clone.
**Proibido cumprido:** n8n live **não** alterado; sem Supabase LIVE; sem secrets reais; sem commit/push/deploy; volumes A3/A4 preservados.

---

## 1. Pré-check (Fase 1)

| Item | Resultado |
|------|-----------|
| SHA Git (working tree, sem commit B6) | `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` |
| Relatórios A3–A5, B1–B5 | Presentes em `docs/evidence/results/` |
| Backup B5 | `backups/d-p0-2b-4b-b5-20261105-b5/` (SHA pré `7BEE371B…`, pós `B3AA7C56…`) |
| n8n live | **Up** (`sentinelaaut-n8n-local`) |
| Clone / sidecar (pré-B6) | **Exited** (parados após B5) |
| PG A4 | **Up** (healthy), volume `dp02b3-isolated_sentinelaaut-pg-nonce-test-a4-data` |
| Rede isolada | `sentinelaaut-n8n-dp02b3-isolated`, **Internal: true** |
| `docker/dp02b3-isolated/n8n-clone-b4.env` | Existe (gitignored); chaves listadas §3 |
| `docker/dp02b3-isolated/nonce-sidecar.env` | Existe (gitignored); chaves sem valores neste relatório |

---

## 2. Inventário de credenciais (Fase 2)

### 2.1 Causa B5

O nó **Generate HMAC** (AUT-010 e demais filhos Fase 1) exige **quatro** variáveis via `$env` (contrato `n8n/shared/hmac-code.js`):

| Variável | Alternativa harness | Obrigatória |
|----------|---------------------|-------------|
| `SENTINELA_N8N_SECRET` | `SENTINELA_HARNESS_SECRET` | Sim |
| `SENTINELA_N8N_CLIENT_ID` | `SENTINELA_HARNESS_CLIENT_ID` | Sim |
| `SENTINELA_N8N_ORGANIZATION_ID` | `SENTINELA_HARNESS_ORG` | Sim |
| `SENTINELA_N8N_CONDOMINIUM_ID` | `SENTINELA_HARNESS_CONDO` | Sim |

Mais **base URL** da API: `SENTINELA_API_BASE_URL` / `SENTINELA_PILOT_BASE` (default artefacto `http://127.0.0.1:3099`).

**Credenciais n8n UI:** workflows filhos **não** usam credencial formal n8n para HMAC — apenas `$env` (paridade com `docker/n8n-local/compose.yml`).

### 2.2 Matriz resumida (filhos acionados por AUT-2F-001)

| Workflow | Serviço | Variável / credencial | Obrigatória? | Origem esperada | Situação B6 |
|----------|---------|------------------------|--------------|-----------------|-------------|
| AUT-2F-001 | Agent Gateway | `SENTINELA_AGENT_GATEWAY_*` | Sim (webhook) | `n8n-clone-b4.env` | Já B4/B5 |
| AUT-010 (LIST_EVENTS) | API v1 GET `/api/v1/events` | HMAC v1 + tenant env | Sim | Clone env + piloto | **Alinhado** |
| AUT-3B-001…005 | API v1 operações | Idem HMAC v1 | Sim | Clone env + piloto | **Não exercido** nesta fase |
| Sidecar nonce | `POST …/nonce/consume` | `INTERNAL_TOKEN`, `DATABASE_URL` (sidecar) | Sim (persistent) | `nonce-sidecar.env` + PG A4 | Operacional |

Tenant no payload webhook é **removido** no filho; autoridade de tenant = **env** (AUT-010 Validate).

---

## 3. Auditoria de contrato (Fase 3)

| Camada | Contrato | Notas |
|--------|----------|-------|
| Agent Gateway | agent-v1 HMAC + nonce persistente | Inalterado B5 |
| AUT-2F-001 | Allowlist intent → Execute Workflow | `LIST_EVENTS` → **AUT-010** |
| AUT-010 | GET `/api/v1/events`, permission `events.view` | HMAC canonical **v1** (8 linhas) |
| API piloto repo | `local-api-pilot.ts` + memória | **Não** bindável na rede **internal** via `host.docker.internal` (Network unreachable) |

**Divergência resolvida B6:** clone precisa de API em **`http://127.0.0.1:3099`** no **mesmo network namespace** que o n8n (`--network container:sentinelaaut-n8n-dp02b3-import`).

**Divergência remanescente:** `npm run pilot:api` dentro de container Linux falha (`rollup` native — `node_modules` Windows). Para E2E isolado foi usado **`b6-isolated-api-stub.mjs`** (HMAC v1 + resposta `list_events` sintética). Paridade com `local-api-pilot.ts` completo: **NOT VERIFIED** nesta sessão.

---

## 4. Configuração sintética (Fase 4)

| Artefacto | Acção |
|-----------|--------|
| `docker/dp02b3-isolated/n8n-clone-b4.env.example` | **Criado** — nomes + valores demo públicos (não prod) |
| `docker/dp02b3-isolated/n8n-clone-b4.env` | Atualizado via `merge-clone-b6-env.mjs` (gitignored): credenciais piloto + `127.0.0.1:3099`; removido `DATABASE_URL` do env **n8n** |
| Container `sentinelaaut-api-pilot-b6` | Stub API no namespace do clone |
| Valores | Alinhados a `api/v1/_lib/auth/testFixtures.ts` (sintéticos) |

Nenhum segredo de produção copiado. URLs apenas loopback / DNS interno isolado.

---

## 5. Testes funcionais LIST_EVENTS (Fase 5)

Script: `scripts/n8n-harness/dp04-b6-list-events-matrix.mjs`
Evidência: `backups/d-p0-2b-4b-b6-20261105/b6-matrix.json`

| # | Cenário | HTTP | Filho AUT-010 | Notas |
|---|---------|------|---------------|-------|
| 1 | HMAC agent válido | **200** | **Sim** (`dispatched_aut: AUT-010`, `ok: true`, `intent: LIST_EVENTS`) | Funcional |
| 2 | HMAC agent inválido | **401** | **Não** (`dispatched_aut: null`) | |
| 3 | Tenant no body (override) | **200** | **Sim** | Tenant strip + env vault |
| 4 | `key_id` desconhecido | **401** | **Não** | Identidade agent |
| 5 | Nonce repetido | **200** → **401** | 1.º sim / 2.º não | Replay gateway |
| 6 | PostgreSQL parado | **503** | **Não** | `AGENT_GATEWAY_UNAVAILABLE` / nonce store |
| 7 | PG recuperado | **200** | **Sim** | |
| 8 | Idempotency key repetida (READ) | **200** + **200** | Sim | Contrato AUT-010: idempotency **n/a** — comportamento esperado |

**Identidade API 403 (cliente readonly):** **NOT VERIFIED** — exigiria trocar `SENTINELA_N8N_CLIENT_ID` no clone; cobertura parcial via gateway `key_id`.

---

## 6. Regressão (Fase 6)

| Suíte | Resultado |
|-------|-----------|
| B5 Vitest (19 ficheiros) | **177/177 PASS** |
| A5 PostgreSQL | **11/11 PASS** |
| Matriz B4 `dp04-b4-e2e-matrix.mjs` | consume **200/409**; webhook auth **401**; `webhook_valid_list_events` **200** com filho (pós-B6) |

---

## 7. Encerramento operacional

Containers de validação B6 **parados:** `sentinelaaut-n8n-dp02b3-import`, `sentinelaaut-agent-nonce-sidecar-dp02b3`, `sentinelaaut-api-pilot-b6`.
**Live** permanece Up. Volumes A3/A4 intactos.

---

## 8. Rollback

1. Remover linhas B6 de `n8n-clone-b4.env` ou restaurar backup pré-merge.
2. Parar stub `sentinelaaut-api-pilot-b6`.
3. Recriar clone apenas com env gateway B4/B5 (sem HMAC filho) se regressão ao estado B5 for desejada.

---

## 9. Veredito

**PASS WITH CONDITIONS**

| Critério | Estado |
|----------|--------|
| Credenciais sintéticas no clone | **PASS** |
| LIST_EVENTS funcional até AUT-010 + HTTP API | **PASS** (stub isolado) |
| HMAC + nonce + PG | **PASS** |
| Rejeições sem filho | **PASS** |
| Piloto completo `local-api-pilot.ts` na rede internal | **NOT VERIFIED** (rollup / node_modules OS) |
| Demais filhos AUT-3B-* | **NOT VERIFIED** nesta fase |

**Aguardando autorização para B7.**
