# SENTINELAAUT — D-P0-2B-4B-B1 — Gateway integration readiness audit

**Data/hora:** 2026-11-05 ~10:15 (UTC-3)
**Modo:** **READ-ONLY** — sem alteração de código, env, containers, workflows, migrations, testes com efeito colateral, commit ou deploy
**Referências:** A3, A4, A5, B0 (relatórios em `docs/evidence/results/`)
**HEAD de referência informado:** `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68`

---

## 1. Veredito geral

### **`READY WITH CONDITIONS`**

A implementação **agent-v1** (HMAC, canonicalização, anti-replay, fail-closed de nonce store, política de tenant no payload) está **presente no working tree** e **coberta por testes Vitest**, com **runtime isolado comprovado** apenas para **nonce SQLite via sidecar (A3)** e **PostgreSQL via integração Vitest (A4/A5)**. **Não** há comprovação de integração ponta-a-ponta **n8n clone → gateway completo → PostgreSQL** nem de **deploy/commit** do pacote gateway no `HEAD` versionado.

**Não autoriza** activação de AUT-2F-001, alteração de n8n live, migrations Supabase LIVE ou gateway de produção.

---

## 2. Pré-check

| Item | Evidência | Notas |
|------|-----------|--------|
| Branch | `main` | Git READ-ONLY |
| HEAD actual | `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` | **Igual** ao HEAD de referência |
| Relatórios A3, A4, A5, B0 | **Presentes** em `docs/evidence/results/` | Lidos para cruzamento |
| Working tree | Muitos `M` + pacote gateway **`??` não commitado** | Ver §3 |
| Containers (snapshot, **sem** start/stop) | `sentinelaaut-n8n-local` **Up** `:5678`; clone `sentinelaaut-n8n-dp02b3-import` **Exited (137)**; sidecar nonce **Exited (137)**; PG A4 **Exited (0)**; `sentinelaaut-b16c-pg-test` **Up** `:55433` | PG A4/B16c **não** inspeccionados além de estado |
| n8n live alterado nesta auditoria | **Não** | Apenas `docker ps` / `docker inspect` (nomes de env) |

### Divergência relevante (continuação segura)

- **HEAD commitado** não inclui rota `agent-gateway/nonce/consume` nem handlers (`git diff HEAD -- api/v1/_lib/router.ts` adiciona rota + imports **só no working tree**).
- Módulos `api/v1/_lib/agentGateway/`, `api/v1/_lib/handlers/agent-gateway/`, `api/_lib/db/pgPool.ts`, harness `agentGateway*.ts` aparecem como **`??` untracked**.
- **Implicação:** prontidão de **código local** ≠ prontidão de **artefacto deployável no SHA publicado**.

---

## 3. Arquivos e artefactos examinados (amostra)

| Área | Ficheiros / pastas |
|------|---------------------|
| API v1 router | `api/v1/_lib/router.ts` |
| Nonce consume API | `api/v1/_lib/handlers/agent-gateway/nonce-consume.ts` |
| PG pool / transacção | `api/_lib/db/pgPool.ts` |
| Nonce core | `api/v1/_lib/agentGateway/nonceConsumeCore.ts`, `nonceConsumeSqlite.ts`, `nonceConsumeHttpOutcome.ts` |
| Identity | `identityAuth.ts`, `identityRegistryEnv.ts`, `identityRegistryPg.ts`, `allowedKeyIds.ts` |
| Gateway n8n (contrato) | `scripts/n8n-harness/agentGatewayV1.ts`, `agentGatewayValidate.n8n.js`, `agentGatewayNonceMode.ts`, `agentGatewayPersistentNonceStore.ts`, `agentGatewayHttpNonceStore.ts`, `agentGatewayRawBody.ts`, `agentGatewayTenantPolicy.ts`, `agentGatewayHarnessRuntime.ts` |
| Workflow | `n8n/workflows/AUT-2F-001-INTENT-ROUTER.json` |
| Testes estáticos | `scripts/n8n-harness/aut-2f-001-agent-gateway.wiring.test.ts`, `agentGatewayV1.test.ts`, `agentGatewayPgNonce.integration.test.ts` |
| Migrations | `supabase/migrations/20261103180000_022_agent_gateway_nonces.sql`, `20261103200000_023_agent_gateway_identity_registry.sql` |
| Config documentada | `.env.example` (nomes apenas) |
| Relatórios | A3, A4, A5, B0 |

---

## 4. Auditoria do Gateway agent-v1

**Arquitectura:** o “gateway definitivo” **não** é um único endpoint HTTP na API que valida HMAC. A validação **agent-v1** corre no **n8n Code node** (`Validate Agent Gateway`), espelhando `agentGatewayV1.ts`. A API expõe **`POST /api/v1/agent-gateway/nonce/consume`** (store interno) quando `NONCE_STORE=persistent` usa HTTP consume.

| Componente | Evidência | Classificação |
|------------|-----------|---------------|
| Implementação gateway (HMAC + headers) | `agentGatewayV1.ts`, `agentGatewayValidate.n8n.js` | **PASS** (código) |
| Rotas HTTP API relacionadas | Só `nonce/consume` em `router.ts` (working tree) | **PARTIAL** (sem rota webhook agent-v1 na API) |
| Middleware auth gateway | Headers `X-Agent-*`; secrets `SENTINELA_AGENT_GATEWAY_SECRETS` | **PASS** (código) |
| Validação HMAC | `verifySignature` + `buildAgentGatewayCanonical` | **PASS** (código + Vitest) |
| Canonicalização | `agent-v1\\n{ts}\\n{nonce}\\nPOST\\n/webhook/sentinelaaut/aut-2f-001\\n{bodySha256}` | **PASS** |
| Anti-replay (lógica) | Nonce store após crypto; replay → falha gateway | **PASS** (código) |
| Integração nonce store | `memory_test` / SQLite / PG / HTTP → `nonce-consume` | **PASS** (código) |
| Idempotência operacional AUT-* | Idempotency G7 na API v1 clássica | **NOT VERIFIED** ligação directa ao gateway agent-v1 |
| Validação tenant | `stripAgentUntrustedBodyFields` / TENANT_KEYS no workflow | **PASS** (política: tenant **não** vem do body) |
| Autorização por operação pós-gateway | Intents AUT-* + API v1 protegida | **PARTIAL** (fora do nó gateway) |
| Auditoria eventos | Observability G7 separada | **NOT VERIFIED** para webhook agent-v1 |
| Tratamento erros | 401 auth, 403 forbidden consume, 503 unavailable store | **PASS** (código) |
| Timeouts HTTP nonce | `timeoutMs` opcional em `agentGatewayHttpNonceStore.ts` | **PARTIAL** (default sem timeout explícito) |
| Fail-closed | `NONCE_STORE=unavailable` → 503; A5 connect → 503 no consume API | **PASS** (código + A5 Vitest) |
| Runtime n8n live | Inspect: **nenhuma** env `SENTINELA_AGENT_GATEWAY_*` | **NOT VERIFIED** / **FAIL** operacional |
| Runtime clone + sidecar | A3 PASS (SQLite); containers **parados** | **PASS** (histórico A3) |

---

## 5. Integração PostgreSQL (A4/A5) — análise estática

| # | Pergunta | Resposta | Status |
|---|----------|----------|--------|
| 1 | Adapter PG usado pelo gateway? | Sim, via `createPersistentAgentNonceStoreFromEnv` → `withPgTransaction` + `consumeNoncePg`; n8n em modo persistente usa **HTTP consume** ou PG directo só em processos com `DATABASE_URL` | **PASS** (código) |
| 2 | `pgPool` no fluxo correcto? | Handler `nonce-consume` e store persistente importam `withPgTransaction` | **PASS** |
| 3 | Falha de conexão → indisponível? | A5: `connect()` → `{ ok: false }` | **PASS** (A5) |
| 4 | Handler → HTTP 503? | `!tx.ok` → `respondStore('unavailable')` → **503** `STORE_UNAVAILABLE` | **PASS** |
| 5 | Replay → HTTP 409? | `respondStore('replay')` → **409** `NONCE_REPLAY` | **PASS** (A4/A5 Vitest) |
| 6 | Consumo atómico / concorrente? | PK `(key_id, nonce)` + transacção; testes 12× | **PASS** (A4/A5) |
| 7 | Separação `key_id`? | PK composta | **PASS** |
| 8 | Store ligado a tenant/identidade? | Nonce store **não** inclui tenant; **identity** validada no consume API (registry env ou PG 023) | **PARTIAL** — anti-replay por key_id, tenant vem de credenciais n8n downstream |
| 9 | Dependência migration **022**? | Tabela `agent_gateway_nonces` | **PASS** (obrigatória para PG persistente) |
| 10 | Migration **023**? | Modo `SENTINELA_AGENT_GATEWAY_IDENTITY_REGISTRY_MODE=postgres`; alternativa **env JSON** sem 023 | **Opcional** para nonce; **obrigatória** só para registry PG |

**Runtime n8n + PostgreSQL:** **NOT VERIFIED** (A4/A5 não exercitaram webhook AUT-2F-001 com `DATABASE_URL` no n8n).

---

## 6. Contrato n8n ↔ Gateway

| Aspecto | Contrato (código + workflow repo) | Paridade workflow |
|---------|-------------------------------------|-------------------|
| URL webhook | `POST /webhook/sentinelaaut/aut-2f-001` (`AGENT_GATEWAY_CANONICAL_PATH`) | **PASS** em `AUT-2F-001-INTENT-ROUTER.json` |
| Método | POST | **PASS** |
| Headers | `X-Agent-Key-Id`, `X-Agent-Timestamp`, `X-Agent-Nonce`, `X-Agent-Signature` | **PASS** (workflow Code node) |
| Payload | JSON; SHA-256 do **raw body** na assinatura | **PASS** |
| rawBody | Webhook `options.rawBody: true` | **PASS** (`aut-2f-001-agent-gateway.wiring.test.ts`) |
| Timestamp / nonce | Regex + janela (`checkTimestamp`) | **PASS** (código) |
| Sucesso gateway | `_agentGatewayPassed` / fluxo para Normalize | **PASS** (workflow) |
| Replay (camada n8n) | API consume **409** → store `replay` → gateway **401** `AGENT_AUTH_FAILED` (não 409 externo) | **PARTIAL** — contrato externo webhook é 401 genérico, não 409 |
| Indisponibilidade store | **503** `AGENT_GATEWAY_UNAVAILABLE` | **PASS** (código) |
| Timeout / retry n8n | HTTP store: abort opcional; catch → unavailable; **sem** retry automático documentado | **PARTIAL** |
| Idempotency-Key HTTP | Não usado no agent-v1 | **N/A** |
| Divergência AUT-2F-001 vs gateway | Repo workflow inclui nó gateway; **live** (B0) reportado sem env gateway / possível export desalinhado | **NOT VERIFIED** nesta auditoria (sem abrir volume live) |

**Nota HMAC:** assinatura depende dos **bytes originais** do body; reconstruir JSON no n8n **quebra** a verificação — workflow exige `rawBody`.

---

## 7. Segurança multi-tenant

| Controlo | Evidência | Status |
|----------|-----------|--------|
| Tenant no body não confiável | Chaves removidas / ignoradas (`agentGatewayTenantPolicy.ts`, workflow TENANT_KEYS) | **PASS** |
| Tenant efectivo | Credenciais `SENTINELA_N8N_*` / vault nos sub-workflows | **PARTIAL** (documentado; runtime **NOT VERIFIED**) |
| Credencial ↔ key_id ↔ identity | Consume API: `IDENTITY_REGISTRY` + allowlist `ALLOWED_KEY_IDS` | **PASS** (código) |
| Acesso cruzado condomínios | Depende de credenciais server-side pós-gateway | **NOT VERIFIED** E2E |
| RBAC operações API v1 | `protectedHandler` / authz separado | **PASS** (código existente; não agent-webhook) |
| Secrets no frontend | Sem referência agent gateway em `App.tsx` (amostra) | **PASS** (amostra) |
| service_role no frontend | Não auditado exaustivamente; padrão repo API server-side | **NOT VERIFIED** repo-wide |
| Replay / duplicidade | Nonce persistente + HMAC | **PASS** (código); runtime live **NOT VERIFIED** |

---

## 8. Inventário de variáveis (nomes apenas, sem valores)

| Variável | Obrigatória | Opcional | Clone | Produção | Estado runtime live |
|----------|-------------|----------|-------|----------|---------------------|
| `SENTINELA_AGENT_GATEWAY_ENABLED` | Sim (webhook) | — | Sim | Sim | **Ausente** (live) |
| `SENTINELA_AGENT_GATEWAY_SECRETS` | Sim | — | Sim | Sim | **Ausente** |
| `SENTINELA_AGENT_GATEWAY_NONCE_STORE` | Sim (`persistent` homolog.) | — | Sim | Sim | **Ausente** |
| `SENTINELA_AGENT_GATEWAY_NONCE_CONSUME_URL` | Sim (n8n→API/sidecar) | — | Sim (A3) | Sim | **Ausente** live; A3 clone **NOT VERIFIED** agora |
| `SENTINELA_AGENT_GATEWAY_INTERNAL_TOKEN` | Sim (consume) | — | Sim | Sim | **Ausente** live |
| `SENTINELA_AGENT_GATEWAY_IDENTITY_REGISTRY` | Sim (modo env) | Alt. PG | Sim | Sim | **Não verificado** live |
| `SENTINELA_AGENT_GATEWAY_IDENTITY_REGISTRY_MODE` | Opcional (`postgres`) | Sim | Opcional | Prod PG | **Ausente** |
| `SENTINELA_AGENT_GATEWAY_ALLOWED_KEY_IDS` | Sim (consume API) | — | Sidecar | API | Sidecar A3 |
| `SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH` | Alt. persistente | — | Sidecar | Raro | Sidecar A3 |
| `DATABASE_URL` | PG nonce / registry | — | Teste A4 | Produção | **Não verificado** live |
| `SENTINELA_AGENT_GATEWAY_TIMESTAMP_WINDOW_SECONDS` | Opcional | Sim | Sim | Sim | **Ausente** |
| `SENTINELA_AGENT_GATEWAY_ALLOW_MEMORY_TEST` | Só teste | — | Harness | **Proibido** prod | — |
| `SENTINELA_AGENT_GATEWAY_TEST_ENV` | Só teste | — | Harness | **Proibido** | — |
| `SENTINELA_AGENT_GATEWAY_HARNESS_RUNTIME` | Só `memory_test` | — | `local_n8n` | — | **Não verificado** |
| `SENTINELA_AGENT_GATEWAY_PRODUCTION` | Lock | — | — | Sim | **Ausente** |

**Serviços/endpoints para E2E homologação clone:**

1. n8n clone com AUT-2F-001 importado e webhook **não activado** até fase autorizada.
2. Sidecar ou API com `nonce/consume` reachable na rede Docker.
3. Store persistente (SQLite **comprovado A3** ou PG **comprovado Vitest A4/A5**).
4. Registry de identidade (env JSON **mínimo**; PG 023 se modo postgres).
5. Secrets HMAC alinhados ao `key_id` allowlist.

---

## 9. Matriz de prontidão

| Componente | Evidência | Status | Bloqueio | Próxima validação |
|------------|-----------|--------|----------|-------------------|
| Código agent-v1 (HMAC/canonical) | `agentGatewayV1.ts` + Vitest | **PASS** | Não commitado | Commit + review |
| Rota API nonce consume | `router.ts` (uncommitted) | **PARTIAL** | Handler untracked vs HEAD | Deploy staging |
| PostgreSQL nonce (adapter) | A4/A5 Vitest | **PASS** (teste) | Sem n8n E2E PG | B? — smoke clone + PG descartável |
| SQLite nonce sidecar | A3 runtime | **PASS** (histórico) | Containers parados | Reiniciar clone + sidecar (fase ops) |
| Fail-closed PG connect | A5 | **PASS** | — | — |
| Testes automatizados harness | Múltiplos `agentGateway*.test.ts` | **PASS** | Ficheiros `??` | CI após commit |
| Workflow AUT-2F-001 (repo) | rawBody + wiring test | **PASS** (estático) | Live vs repo | Read-only export live vs repo |
| Integração n8n clone gateway completo | A3 parcial (nonce only) | **PARTIAL** | AUT-2F-001 não activado; sem HMAC E2E reportado | Webhook signed request harness |
| Integração n8n live | B0 + inspect actual | **FAIL** | Zero env gateway | Fase dedicada (não live prod) |
| Integração Supabase LIVE | Migrations 022/023 não aplicadas (A3/A4) | **NOT VERIFIED** | Migrations + DATABASE_URL | DBA autorizado |
| Produção gateway | — | **BLOCKED** | Commit, env, migrations, E2E | Roadmap abaixo |

---

## 10. Bloqueios e riscos prioritários

1. **Pacote gateway não commitado** — deploy a partir de `f0d76ccb` **não** inclui handlers/agentGateway.
2. **n8n live sem configuração agent-v1** — webhook AUT-2F-001 activo (B0) **incompatível** com gateway persistente até env + rawBody no runtime.
3. **E2E ausente:** n8n → HMAC → HTTP nonce → PostgreSQL (só API/handler Vitest).
4. **Migration 022** necessária em qualquer PG de nonce; **023** se identity registry PG.
5. **Semântica HTTP replay:** consume **409** vs webhook cliente **401** — documentar para integradores.
6. **Dois PG locais** (`pg-nonce-test-a4` parado, `b16c-pg-test` Up) — risco de confusão operacional; **não** misturar credenciais/ports em fase futura.

---

## 11. Dependências de migrations

| Migration | Função | Obrigatoriedade |
|-----------|--------|-----------------|
| **022** `agent_gateway_nonces` | Nonce persistente PG | **Obrigatória** se `DATABASE_URL` + PG store |
| **023** identity registry | Auth consume + modo postgres registry | **Opcional** se registry via env JSON; **obrigatória** se `IDENTITY_REGISTRY_MODE=postgres` |

---

## 12. Plano recomendado de integração (fases)

1. **Versionamento** — commit do pacote `agentGateway` + handler + `pgPool` + rota router (sem activar prod).
2. **Clone dp02b3** — subir sidecar SQLite (A3 playbook) + env gateway **persistent** + `NONCE_CONSUME_URL`; smoke HMAC único (Vitest/harness HTTP).
3. **PG descartável** — repetir A4/A5; adicionar fase **n8n → sidecar/API com PG** (mesma rede Docker).
4. **AUT-2F-001 no clone** — activar webhook **só** com `ENABLED=1`, secrets sintéticos, `rawBody` confirmado no container.
5. **Staging API** — migration 022 (+ 023 se aplicável), `DATABASE_URL`, consume URL pública/interna.
6. **Produção** — gate separado; n8n live **por último**.

---

## 13. SHA e confirmação operacional

| | SHA / estado |
|---|----------------|
| SHA inicial auditoria | `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` |
| SHA final auditoria | `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` (**sem commit**) |
| Alterações operacionais nesta B1 | **Nenhuma** |
| n8n live | **Não** iniciado/parado/reconfigurado |
| Supabase LIVE | **Não** acedido |
| Workflows | **Não** modificados |
| Containers / volumes / redes | **Não** modificados (apenas listagem/inspect) |
| Migrations | **Não** aplicadas |
| Testes com efeito colateral | **Não** executados |

---

## 14. Resumo executivo (entrega)

O SentinelaAut possui **implementação técnica madura** do protocolo **agent-v1** no harness e no workflow **AUT-2F-001** do repositório, com **nonce persistente** validado em **SQLite (runtime A3)** e **PostgreSQL (Vitest A4/A5 + hardening A5)**, mas **não** está **operacionalmente pronto** para integração definitiva n8n isolado **ponta-a-ponta** nem para produção: falta **versionamento**, **configuração runtime**, **E2E webhook assinado com store PG**, e **alinhamento live/clone**.

**Veredito:** **`READY WITH CONDITIONS`**

**Bloqueios prioritários:** (1) commit/deploy do módulo gateway; (2) config env persistente no clone; (3) E2E HMAC + nonce PG; (4) migrations em ambiente alvo.

**Relatório:** `docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B1-GATEWAY-INTEGRATION-READINESS-REPORT.md`

---

**PARAR — aguardar autorização expressa para qualquer próxima etapa.**
