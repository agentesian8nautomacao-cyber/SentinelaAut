# SENTINELAAUT — D-P0-2B-4B-A — Implementação controlada da persistência de nonce (clone isolado)

**Data/hora:** 2026-11-05 ~09:22 (UTC-3)
**Escopo:** clone D-P0-1 / dp02b3 — **sem** n8n live, **sem** activar AUT-2F-001, **sem** migrations Supabase, **sem** deploy/push
**Relacionado:** D-P0-2B-4B-B0, D-P0-2B-3-A, artefato `AUT-2F-001-INTENT-ROUTER-D-P0-1.json`

---

## 1. Resumo executivo

A persistência durável de nonce **já está implementada** no repositório (SQLite + PostgreSQL + handler HTTP consume). Nesta fase **não foi necessário** alterar adapters de persistência: a validação consistiu em **pré-check**, **decisão arquitectural** e **execução de testes Vitest** que cobrem os critérios da Fase 4.

| Item | Resultado |
|------|-----------|
| Adapter SQLite + API consume | **Presente** — testes **33/33 PASS** |
| Adapter PostgreSQL (`consumeNoncePg`) | **Presente** no código — **sem** teste de integração PG nesta fase |
| Migration 022 / 023 | **Presentes** no repo — **NOT APPLIED** (Supabase) |
| Runtime clone dp02b3 | **NOT VERIFIED** — container **Exited (137)**; AUT-2F-001 **não** activado (conforme autorização) |
| n8n live | **Não tocado** |

### Veredito: **`PASS WITH CONDITIONS`**

**Condições:** (1) prova operacional no clone (n8n → consume URL → SQLite file) **pendente** de fase com `docker start` autorizado; (2) migrations 022/023 **pendentes** em PG definitivo; (3) testes automatizados **PG** inexistentes.

---

## 2. Fase 1 — Pré-check

| # | Verificação | Evidência | Classificação |
|---|-------------|-----------|---------------|
| 1 | Branch / HEAD | `main` @ `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` | **PASS** |
| 2 | Git ficheiros nonce | `agentGatewayPersistentNonceStore.ts`, `nonce-consume.ts`, `nonceConsumeCore.ts` → **`??` untracked** (não commitados) | **PASS WITH CONDITIONS** |
| 3 | Backup recuperável | `D:\SentinelaAut-Preservation\n8n-quiesced\D-P0-2B-1-20261104-230847` (D-P0-2B-1) | **PASS** |
| 4 | Clone artefato SHA | `1db6bac72ec08fac8f5fd1cafc92c3230aed3278bdfd271e67bde65c69678f96` (`_dp02b3_artifact_sha256.json`) | **PASS** |
| 5 | Clone container | `sentinelaaut-n8n-dp02b3-import` **Exited (137)** | **NOT VERIFIED** runtime |
| 6 | NONCE_STORE código | `agentGatewayNonceMode.ts`, `agentGatewayValidate.n8n.js`, `agentGatewayV1.ts` | **PASS** |
| 7 | Migration 022 | `supabase/migrations/20261103180000_022_agent_gateway_nonces.sql` | **PASS** (ficheiro) |
| 8 | Migration 023 | `20261103200000_023_agent_gateway_identity_registry.sql` | **PASS** (ficheiro); **opcional** se registry via env JSON |
| 9 | API gateway consume | `POST /api/v1/agent-gateway/nonce/consume` (`router.ts`) | **PASS** |
| 10 | Testes | `agentGatewayPersistentNonceStore.test.ts`, `nonce-consume.identity.test.ts` | **PASS** (executados §4) |

**Migrations aplicadas em Supabase:** **NOT VERIFIED** — assumido **não** aplicado (restrição de fase).

---

## 3. Fase 2 — Decisão arquitectural

### A. SQLite (local / clone / sidecar API)

| Critério | Avaliação |
|----------|-----------|
| Persistência após restart | **Sim** — ficheiro + WAL (`nonceConsumeSqlite.ts` PRAGMA WAL) |
| Atomicidade | **Sim** — `BEGIN IMMEDIATE` + COMMIT/ROLLBACK |
| Concorrência | **Sim** — PK `(key_id, nonce)`; teste 20 paralelos **PASS** |
| Unicidade nonce | **Sim** — constraint → `replay` |
| Expiração / limpeza | **Sim** — DELETE `expires_at < now`; reutilização após expiração testada (teste 5) |
| Isolamento | Por **`key_id`** (não tenant PG) — teste 9 |
| Fail-closed | Modo persistent sem path → **503** |
| Recuperação indisponibilidade | Erro SQL → `unavailable` → **503** no handler |
| Supabase | **N/A** (ficheiro local) |

**Uso recomendado:** clone isolado, dev, sidecar Node com `SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH`.

### B. PostgreSQL (definitivo)

| Critério | Avaliação |
|----------|-----------|
| Persistência | **Sim** — tabela `agent_gateway_nonces` (022) |
| Atomicidade | **Sim** — transacção + `INSERT … ON CONFLICT DO NOTHING` |
| Concorrência | **Desenhada** — mesma semântica que SQLite |
| Unicidade | **PK (key_id, nonce)** |
| Expiração | DELETE pré-insert em `consumeNoncePg` |
| Isolamento | Por `key_id` |
| Fail-closed | Sem `DATABASE_URL`/SQLite → handler **503** |
| Supabase | **Compatível** (DDL padrão PG); **NOT VERIFIED** apply |

**Recomendação:** **PostgreSQL (Supabase)** como armazenamento **definitivo** em produção; **SQLite** para **clone/local** até migrations e `DATABASE_URL` estarem autorizados.

**Ponte n8n clone:** `NONCE_STORE=persistent` + `NONCE_CONSUME_URL` + `INTERNAL_TOKEN` → API com SQLite ou PG por trás (template: `docs/evidence/isolated/d-p0-1/CLONE-NONCE-PERSISTENCE-ENV-TEMPLATE.env.example`).

---

## 4. Fase 3 — Implementação no clone

### 3.1 Alterações de código

**Nenhuma** alteração nos adapters de persistência nesta sessão — implementação B16-C **já satisfaz** o contrato (replay, fail-closed, sem fallback inseguro).

**Artefacto novo (só preparação, sem secrets):**

| Ficheiro | Propósito |
|----------|-----------|
| `docs/evidence/isolated/d-p0-1/CLONE-NONCE-PERSISTENCE-ENV-TEMPLATE.env.example` | Template env clone + API consume |

### 3.2 Runtime clone

**Não executado:** `docker start` clone, inject env, activar workflow — conforme limites (**AUT-2F-001 não activado**; n8n live intocado).

**Pré-condição para ligação clone:** API reachável na rede isolada com consume operacional + registry/allowlist configurados.

---

## 5. Fase 4 — Testes executados

### Comandos

```text
npx vitest run scripts/n8n-harness/agentGatewayPersistentNonceStore.test.ts api/v1/_lib/handlers/agent-gateway/nonce-consume.identity.test.ts --reporter=verbose

npx vitest run scripts/n8n-harness/d-p0-1-agent-gateway-matrix.test.ts -t "07 —" --reporter=verbose
```

### Mapeamento critérios → testes

| # | Critério | Teste / evidência | Resultado |
|---|----------|-------------------|-----------|
| 1 | Nonce novo aceite | `1. first nonce accepted`; identity consume **200** | **PASS** |
| 2 | Repetido rejeitado | `2. replay rejected`; handler **409**; identity `replay → 409` | **PASS** |
| 3 | Concorrência | `3. concurrent…`; matriz `07 —` (16 paralelos) | **PASS** |
| 4 | Reinício | `8. process restart — replay still rejected` | **PASS** |
| 5 | Store indisponível | `7. persistent without backend → 503`; `6b. handler without store → 503` | **PASS** |
| 6 | Expiração | `5. expired nonce row pruned` | **PASS** |
| 7 | Falha BD sem bypass | `6. invalid path`; `store indisponível → 503` | **PASS** |
| 8 | Regressão | 33 testes persistent + identity | **PASS** |

**Total:** **34** testes (33 + 1 matriz), **0** falhas.

**Vitest:** v2.1.9.

---

## 6. SHA-256 (início = fim — sem mutação de código de persistência)

| Ficheiro | SHA-256 |
|----------|---------|
| `agentGatewayPersistentNonceStore.ts` | `6cceb0de8e537055ce00be3c077ba892118ad92ec625d8e4a1b6b9dff4dc7678` |
| `nonceConsumeCore.ts` | `895cfe5496e8e2733a3747884a1a94174ea1f4a2c29eef7599a674fa4aa6149e` |
| `nonceConsumeSqlite.ts` | `25546053a2ced8f4989fa180736d2228613eb36720c8cd3c6132988ae9e05253` |
| `nonce-consume.ts` | `31c75044c653e82c03af01786da6f37f95a2a72a2b918acdff53a138021a7404` |
| `20261103180000_022_agent_gateway_nonces.sql` | `a19281a1d267daf27d1f2b864ec69ce425742c7351bf76b30879f6eb979a53a9` |

---

## 7. Limitações

1. **Clone n8n** não executou consume HTTP real nesta fase.
2. **PostgreSQL** — lógica em `nonceConsumeCore.ts` **sem** teste Vitest dedicado contra PG real.
3. **Migration 022/023** — **não** aplicadas; estado Supabase **desconhecido**.
4. Ficheiros de persistência **untracked** — rastreabilidade release depende de commit futuro **autorizado**.
5. **Paridade n8n JS** ↔ handler API — coberta indirectamente; **NOT VERIFIED** no Code node em runtime.

---

## 8. Migrations pendentes

| Migration | Conteúdo | Estado |
|-----------|----------|--------|
| **022** | `agent_gateway_nonces` | **Pendente** apply Supabase (proibido nesta fase) |
| **023** | Identity registry PG | **Pendente** se `IDENTITY_REGISTRY_MODE=postgres`; alternativa env JSON já testada |

---

## 9. Riscos residuais

| Risco | Severidade |
|-------|------------|
| Env clone mal configurado → 503 ou replay fraco se usar `memory_test` em prod | **Alta** |
| Token interno + registry desalinhados | **Média** |
| Volume n8n live ainda sem gateway B16 (B17) | **Crítica** (fora deste escopo clone) |
| PG não testado E2E | **Média** |

---

## 10. Rollback

| Camada | Procedimento |
|--------|--------------|
| **Código** | Nenhuma alteração de adapter nesta sessão — rollback **N/A** |
| **Env clone (futuro)** | Remover `NONCE_STORE=persistent` → default fail-closed **503**; apagar ficheiro SQLite sidecar se criado |
| **PG** | Rollback SQL `20261103180000_022_agent_gateway_nonces.rollback.sql` **só** com autorização explícita |
| **Clone container** | Manter **stopped**; volume dp02b3 intacto; restaurar de D-P0-2B-2 referência se corrupção |

---

## 11. Veredito final

### **`PASS WITH CONDITIONS`**

Persistência durável **implementada e comprovada** em Vitest (SQLite + handler HTTP + integração `validateAgentGatewayWithNonceEnv`). **Condições** para declarar “pronto no clone”: subir API consume com env template, rede isolada, smoke HTTP clone → consume, **sem** activar AUT-2F-001 até autorização Camada B.

---

## 12. Encerramento

- **Sem** merge, push, deploy, migrations Supabase, activação gateway live.
- **PARAR** — aguardar nova autorização explícita.

---

*Fim — D-P0-2B-4B-A (persistência de nonce).*
