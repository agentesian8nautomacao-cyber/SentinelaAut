# SENTINELAAUT — D-P0-2B-4B-B0 — Pré-validação integração n8n ↔ API gateway

**Data/hora:** 2026-11-05 ~09:10 (UTC-3)
**Modo:** READ-ONLY — sem alteração de código, env, containers, workflows, migrations, Supabase ou testes com efeitos colaterais
**Objetivo:** Determinar se a infraestrutura **actual** permite integrar n8n ao gateway/API com HMAC, anti-replay, persistência de nonce e isolamento operacional

**Referências cruzadas:** D-P0-2B-4B-A1, D-P0-2B-4A, D-P0-2B-3-A, B17-N8N, `.env.example`, `docs/DEMO-N8N-LOCAL-DOCKER.md`

---

## 1. Resumo executivo

| Eixo | Classificação | Síntese |
|------|---------------|---------|
| **Implementação de nonce (código)** | **PASS** | Modos `unavailable` / `memory_test` / `persistent`; SQLite/PG/API consume; fail-closed documentado |
| **Configuração runtime n8n local (demo)** | **FAIL** | Sem variáveis `SENTINELA_AGENT_GATEWAY_*`; API alvo é piloto `:3099` **sem** rota agent-gateway |
| **Configuração runtime n8n local (live volume B17)** | **FAIL** | `AUT-2F-001` activo **sem** gateway B16 / sem `rawBody` webhook |
| **Clone isolado dp02b3** | **PASS** (estrutural) / **NOT VERIFIED** (runtime) | Gateway D-P0-1 importado; container **Exited**; env gateway **NOT VERIFIED** |
| **API definitiva (Vercel + PG)** | **NOT VERIFIED** | Handler `POST /api/v1/agent-gateway/nonce/consume` existe no repo; deploy, migration 022/023 e env **não** auditados em LIVE |
| **Demo G7-H-B (v1 HMAC)** | **PASS** (condicional) | Integração n8n → **API v1 clássica** via piloto; **não** é gateway agent-v1 |

### Veredito global: **`READY WITH CONDITIONS`**

A **base de software** e o **caminho isolado** (clone + artefato D-P0-1) **permitem** integração definitiva, mas a infraestrutura **operacional actual** **não** está configurada nem comprovada para gateway agent-v1 + nonce persistente. Vários pré-requisitos são **BLOCKING** para homologação do webhook sem fase operacional autorizada.

**Não autoriza implementação nem alteração operacional.**

---

## 2. Confirmação READ-ONLY

| Restrição | Cumprimento |
|-----------|-------------|
| Sem modificar código / env / workflows | **Sim** |
| Sem migrations / Supabase | **Sim** |
| Sem import/activar workflows | **Sim** |
| Sem AUT-2F-001 / AUT-004 / AUT-008 em execução | **Sim** |
| Sem restart de containers | **Sim** (apenas `docker ps` / `docker inspect`) |
| Sem testes adicionais | **Sim** |
| Secrets omitidos neste relatório | **Sim** (nomes de variáveis apenas) |

---

## 3. Auditoria da persistência de nonce

### 3.1 Onde o gateway implementa `NONCE_STORE`

| Camada | Ficheiro / local | Mecanismo |
|--------|------------------|-----------|
| Resolução de modo | `scripts/n8n-harness/agentGatewayNonceMode.ts` | `resolveAgentNonceStoreMode()` — allowlist |
| Harness validação | `scripts/n8n-harness/agentGatewayV1.ts` | `agentNonceStoreForMode()` → memory / SQLite / HTTP |
| n8n Code node | `scripts/n8n-harness/agentGatewayValidate.n8n.js` L285–329 | `resolveNonceMode()` + `memory_test` static data ou HTTP consume |
| API interna | `api/v1/_lib/handlers/agent-gateway/nonce-consume.ts` | SQLite path ou PG via `DATABASE_URL` |
| PG schema | `supabase/migrations/20261103180000_022_agent_gateway_nonces.sql` | Tabela `agent_gateway_nonces` |
| SQLite atómico | `api/v1/_lib/agentGateway/nonceConsumeSqlite.ts` | `BEGIN IMMEDIATE` + PK `(key_id, nonce)` |
| PG atómico | `api/v1/_lib/agentGateway/nonceConsumeCore.ts` | `INSERT … ON CONFLICT DO NOTHING` |

### 3.2 Implementação efectivamente configurada (runtime observado)

**Container `sentinelaaut-n8n-local` (Up, inspect READ-ONLY ~09:10 -03):**

| Variável agent-gateway | Presente no container |
|------------------------|------------------------|
| `SENTINELA_AGENT_GATEWAY_ENABLED` | **Não** |
| `SENTINELA_AGENT_GATEWAY_SECRETS` | **Não** |
| `SENTINELA_AGENT_GATEWAY_NONCE_STORE` | **Não** |
| `SENTINELA_AGENT_GATEWAY_NONCE_CONSUME_URL` | **Não** |
| `SENTINELA_AGENT_GATEWAY_INTERNAL_TOKEN` | **Não** |

**Presente (integração API v1 piloto, não agent-v1):**

- `SENTINELA_API_BASE_URL` → `http://host.docker.internal:3099`
- `SENTINELA_PILOT_BASE` → idem
- `SENTINELA_N8N_CLIENT_ID` / `SENTINELA_N8N_SECRET` → credencial piloto (valores **omitidos**)
- `SENTINELA_N8N_ORGANIZATION_ID` / `SENTINELA_N8N_CONDOMINIUM_ID` → UUIDs demo

**Nota:** `docker/n8n-local/compose.yml` no disco inclui `SENTINELA_HARNESS_*` e `SENTINELA_PILOT_SCENARIO`; o container **em execução não reflecte** essas entradas (sem `docker compose up` após edição) — **configuração em ficheiro ≠ runtime**.

**Comportamento default implícito:** ausência de `NONCE_STORE` ≡ **`unavailable`** → após validação criptográfica, n8n JS retorna **503** `AGENT_GATEWAY_UNAVAILABLE` (L297–298 `agentGatewayValidate.n8n.js`).

**Classificação:** modo efectivo **NOT VERIFIED** como funcional para nonce; default lógico **unavailable** → **FAIL** para persistência activa.

### 3.3 Persistência durável

| Modo | Durável? | Evidência |
|------|----------|-----------|
| `unavailable` | N/A | Rejeita antes de aceitar pedido |
| `memory_test` (n8n) | **Parcial** | `$getWorkflowStaticData('global')._agentNonces` — sobrevive **dentro** da instância n8n / volume workflow; **não** é PG |
| `memory_test` / memória (harness) | **Não** | `Set` in-process (`agentGatewayV1.ts` L56–65) |
| `persistent` + SQLite file | **Sim** (desenho) | Ficheiro + WAL (`nonceConsumeSqlite.ts` L43–44) |
| `persistent` + PG | **Sim** (desenho) | Migration 022 + `consumeNoncePg` |
| `persistent` + HTTP consume | **Sim** (desenho) | n8n chama API; API usa SQLite/PG backend |

**Apply migration 022/023 em Supabase produção:** **NOT VERIFIED** (fora de escopo; proibido alterar Supabase nesta fase).

### 3.4 Sobrevive reinicialização do processo

| Modo | Após restart n8n / API |
|------|-------------------------|
| `memory_test` static data | **Provável sim** enquanto volume `n8n_data` persistir — **NOT VERIFIED** nesta sessão |
| SQLite / PG | **Sim** (desenho) — **NOT VERIFIED** operacional |
| Piloto `:3099` | **N/A** — `local-api-pilot.ts` **não** expõe `/api/v1/agent-gateway/nonce/consume` (grep sem matches) |

### 3.5 Proteção contra nonce repetido

| Local | Comportamento | Classificação |
|-------|---------------|---------------|
| Harness memória | 2ª `consume` → `replay` → `AGENT_NONCE_REPLAY` | **PASS** (código) |
| n8n `memory_test` | 2ª chave `keyId:nonce` → 401 | **PASS** (código) |
| SQLite | UNIQUE / constraint → `replay` | **PASS** (código) |
| PG | `ON CONFLICT DO NOTHING` → `replay` | **PASS** (código) |
| Runtime actual | Store não configurado → **503** antes de “sucesso” | **NOT VERIFIED** replay em produção |

### 3.6 Concorrência

- SQLite: `BEGIN IMMEDIATE` + PK (`nonceConsumeSqlite.ts` L59–75) — **IMPLEMENTADA E EVIDENCIADA**
- PG: transacção + `ON CONFLICT` — **IMPLEMENTADA E EVIDENCIADA**
- Matriz harness D-P0-1 cenário 07 (16 paralelos, 1 ok) — prova **Vitest** (relatório 4B-A); **não** reexecutado nesta fase

### 3.7 Fail-closed default

| Condição | Resposta |
|----------|----------|
| Modo ausente / `unavailable` | 503 gateway unavailable (`agentGatewayNonceMode.ts` L58–59) |
| Modo typo (`redis`, etc.) | 503 (`agentGatewayValidate.n8n.test.ts` / allowlist) |
| `memory_test` sem gates env | 503 |
| Store consume falha | 503 / 401 conforme ramo (`agentGatewayV1.ts` L327–329) |
| API consume sem allowlist | 503 `KEY_ID_ALLOWLIST_NOT_CONFIGURED` (`nonce-consume.ts` L195–198) |

**Classificação fail-closed:** **PASS** (código).

### 3.8 Indisponibilidade do armazenamento

- Harness: `AGENT_NONCE_STORE_UNAVAILABLE` → HTTP **503** (`agentGatewayV1.ts`)
- n8n JS: consume ≠ `ok` → **503** ou **401** replay (`agentGatewayValidate.n8n.js` L324–328)
- API consume: `STORE_UNAVAILABLE` → **503** (`nonce-consume.ts` L119–125)

**Classificação:** **PASS** (código).

### 3.9 Demo vs gateway definitivo

| Aspecto | Demo local (actual) | Gateway definitivo (desenho) |
|---------|---------------------|--------------------------------|
| Auth entrada agente | **Não** usada | agent-v1 HMAC (`x-agent-*`) |
| Auth n8n → API filhos | HMAC **v1** (`X-Sentinela-*`) | Idem nos workflows `aut-*` |
| API backend | Piloto **3099** in-memory | Vercel `/api/v1/*` + PG |
| Nonce consume | **Inexistente** no piloto | `POST /api/v1/agent-gateway/nonce/consume` |
| NONCE_STORE | **Não configurado** | `persistent` + URL/token ou PG/SQLite no API |
| AUT-2F-001 live | Sem gateway B16 (B17) | Artefato D-P0-1 com **Validate Agent Gateway** |
| Clone dp02b3 | Gateway estrutural importado | Alvo Camada B; **parado** |

**Risco:** confundir demo G7-H-B (v1) com readiness do **agent-v1 webhook** — **IMPORTANTE**.

---

## 4. Auditoria da integração n8n

### 4.1 Endpoints relevantes

| Endpoint | Papel | Fonte |
|----------|-------|-------|
| `POST /webhook/sentinelaaut/aut-2f-001` | Entrada agent-v1 (n8n) | Artefato D-P0-1; path canónico HMAC `/webhook/sentinelaaut/aut-2f-001` |
| `POST /api/v1/agent-gateway/nonce/consume` | Nonce persistente (interno) | `api/v1/_lib/router.ts` L31 |
| `/api/v1/operations/*`, `/api/v1/residents/identify`, etc. | Filhos AUT | `docs/N8N-INTEGRATION-CONTRACT.md` |
| `GET /api/v1/health` | Probe | Piloto + API |

### 4.2 Autenticação HMAC (duas famílias)

| Família | Headers | Uso |
|---------|---------|-----|
| **agent-v1** | `x-agent-key-id`, `x-agent-timestamp`, `x-agent-nonce`, `x-agent-signature` | Webhook AUT-2F-001 pós-gateway |
| **v1 integração** | `X-Sentinela-Client-Id`, `X-Sentinela-Timestamp`, `X-Sentinela-Signature`, tenant headers | Workflows filhos → API |

Implementação v1: `api/v1/_lib/auth/protect.ts` + `hmac.ts`
Implementação agent: `agentGatewayV1.ts` / `agentGatewayValidate.n8n.js`

### 4.3 Timestamp e nonce (agent-v1)

- Timestamp: `api/v1/_lib/auth/timestamp.ts` (harness); inline n8n JS — janela default **300s**; ausente **rejeitado** (4B-A1)
- Nonce: regex 16–128; replay via store — §3

### 4.4 Secrets (sem valores)

| Variável | Onde documentada | Runtime n8n local |
|----------|------------------|---------------------|
| `SENTINELA_AGENT_GATEWAY_SECRETS` | `.env.example` L69 | **Ausente** |
| `SENTINELA_N8N_SECRET` / client id | compose + `.env.example` | **Presente** (piloto) |
| `SENTINELA_AGENT_GATEWAY_INTERNAL_TOKEN` | `.env.example` L75 | **Ausente** |
| `SENTINELA_AGENT_GATEWAY_IDENTITY_REGISTRY` | `.env.example` L78–79 | **NOT VERIFIED** |
| `SENTINELA_AGENT_GATEWAY_ALLOWED_KEY_IDS` | `.env.example` L82 | **NOT VERIFIED** API alvo |

### 4.5 URLs

| URL | Observação |
|-----|------------|
| `WEBHOOK_URL=http://localhost:5678/` | Container local — webhooks relativos a localhost |
| `SENTINELA_API_BASE_URL=http://host.docker.internal:3099` | Piloto host; **não** gateway Vercel |
| Consume URL (definitivo) | Placeholder HTTPS em `.env.example` — **NOT VERIFIED** |

### 4.6 Dependências workflows / Execute

- **25× Execute** reconciliados no clone vs artefato (D-P0-2B-3-A) — **PASS** estrutural
- Filhos incluem **AUT-004** (pickup SENSITIVE), **AUT-008** (cancel SENSITIVE) — classificação **C** para execução real (D-P0-2B-4)
- Negativos gateway **param antes** do Dispatch (estático) — **PASS** análise código

### 4.7 Compatibilidade gateway ↔ contratos AUT

- Gateway faz parse JSON + `stripAgentUntrustedBodyFields` (`agentGatewayRawBody.ts`) — remove tenant forjado do body
- Normalize / allowlist intent no router 2F — contrato `g7l.n8n-workflow-contract.ts` (repo)
- **NOT VERIFIED:** intents reais após import live no volume principal

### 4.8 Estado webhook agent-v1

| Ambiente | rawBody | Nó gateway | active | Classificação |
|----------|---------|------------|--------|---------------|
| Artefato D-P0-1 | **true** | **Sim** | false | **PASS** (spec) |
| Clone dp02b3 (evidência RO) | **true** | **Sim** | 0 | **PASS** estrutural |
| n8n local live (B17) | **false** / bypass | **Não** | **Sim** | **FAIL** |
| Runtime listener webhook | — | — | — | **NOT VERIFIED** (clone parado) |

### 4.9 Harness vs piloto vs definitivo

| Componente | Nonce replay | Agent-v1 | Tenant API v1 |
|------------|--------------|----------|---------------|
| Vitest harness | Memória/SQLite inject | Sim | N/A |
| Piloto 3099 | **Não** | **Não** | Credencial fixa demo |
| API Vercel | Desenho PG/SQLite | **NOT VERIFIED** | `SENTINELA_API_CREDENTIALS` |

---

## 5. Auditoria de segurança (estática)

| Controlo | Evidência | Classificação |
|----------|-----------|---------------|
| Isolamento condomínios | Tenant derivado de credencial HMAC v1 (`protect.ts` + `tenant.ts`) | **PASS** (código) |
| Body agent sem tenant confiável | `FORGED_BODY_KEYS` / strip (`agentGatewayValidate.n8n.js`, `agentGatewayRawBody.ts`) | **PASS** (código) |
| service_role no frontend | Contrato proíbe; piloto strip env LIVE (`run-local-api-pilot.mjs`) | **PASS** (desenho demo) |
| AuthZ operações | `protectedHandler` + G3 maps (repo) | **IMPLEMENTADA; NOT VERIFIED** E2E n8n |
| Idempotência WRITE | Contrato N8N + headers Idempotency-Key | **PASS** documentação; **NOT VERIFIED** n8n live |
| Auditoria eventos | `executeCore` / observability (repo) | **IMPLEMENTADA; NOT VERIFIED** piloto vs prod |
| Erros / indisponibilidade | Fail-closed gateway + consume API | **PASS** (código) |
| Isolamento operacional clone | Rede internal, sem porta host (D-P0-2B-4) | **PASS** desenho; container **Exited** |

**Risco live (B17):** webhook 2F **sem** gateway — **FAIL** segurança entrada agente até reconciliar com D-P0-1.

---

## 6. Estado Docker (observado READ-ONLY)

| Container | Status | Notas |
|-----------|--------|-------|
| `sentinelaaut-n8n-local` | **Up** ~24 min (snapshot sessão) | `:5678` publicado |
| `sentinelaaut-n8n-dp02b3-import` | **Exited (137)** | Clone Camada B |
| `sentinelaaut-n8n-dp02b2-restore` | **Exited (137)** | Referência |

---

## 7. Matriz de classificação por item obrigatório

| # | Pergunta | Classificação |
|---|----------|---------------|
| 1 | Onde NONCE_STORE | **PASS** — §3.1 |
| 2 | Config efectiva | **FAIL** — n8n local sem agent env |
| 3 | Persistência durável | **PASS** (código) / **NOT VERIFIED** (ops) |
| 4 | Sobrevive restart | **NOT VERIFIED** demo; **PASS** desenho PG/SQLite |
| 5 | Anti-replay | **PASS** (código) |
| 6 | Concorrência | **PASS** (código) |
| 7 | Fail-closed default | **PASS** |
| 8 | Erro seguro se store down | **PASS** |
| 9 | Demo vs definitivo | **FAIL** alinhamento — trilhas distintas |

---

## 8. Riscos, pendências, dependências externas

### Riscos

| ID | Risco | Severidade |
|----|-------|------------|
| R1 | AUT-2F-001 live sem gateway B16 | **Crítica** |
| R2 | NONCE_STORE default → 503 ou ausência de anti-replay **após** bypass se gateway omitido | **Crítica** |
| R3 | Piloto 3099 usado como “API” na demo **sem** nonce consume | **Média** (confusão) |
| R4 | Migration 022/023 + env Vercel não comprovados | **Alta** |
| R5 | Identity registry / allowlist não provisionados | **Alta** |
| R6 | Execute AUT-004/008 acessíveis se gateway bypass/manual | **Alta** |

### Pendências

1. Reconciliar volume n8n **local** com artefato D-P0-1 **ou** usar exclusivamente clone dp02b3 para Camada B.
2. Provisionar env agent-gateway + modo `persistent` **ou** `memory_test` **só** em ambiente isolado autorizado.
3. Endpoint consume acessível do n8n (rede Docker → API).
4. Prova runtime webhook (negativos + 1 happy-path controlado) — fase **4B-B**, não esta.
5. Decisão API alvo demo: continuar piloto **vs** Vercel preview com 022 aplicado.

### Dependências externas

- Supabase (PG) para nonce/identity — **NOT VERIFIED** apply
- Vercel deploy + env — **NOT VERIFIED**
- Operador / parceiro (D11) para n8n hospedado — fora do scope local

---

## 9. Veredito

### **`READY WITH CONDITIONS`**

**Interpretação:** o repositório e o clone isolado **permitem** construir a integração definitiva; a infraestrutura **hoje** **não** está pronta para declarar integração gateway **funcional** no n8n local de demo nem no live B17.

**Condições mínimas antes de Camada B operacional:**

1. Ambiente n8n alvo com artefato D-P0-1 (gateway + `rawBody`).
2. `SENTINELA_AGENT_GATEWAY_*` completos incl. `NONCE_STORE` ≠ default silencioso.
3. Backend consume operacional (API com SQLite/PG ou URL interna).
4. Clone isolado **ou** contenção equivalente; **sem** activar AUT-004/008 em demo inicial.
5. Evidência runtime **NOT VERIFIED** → deve ser produzida numa fase **autorizada** separada.

**Se o critério for “pronto agora sem mais passos”:** classificação equivalente a **BLOCKED** para gateway definitivo (R1, R2, R4).

---

## 10. Proposta técnica — integração definitiva (sem implementar)

### A. Persistência e segurança do gateway

1. Escolher backend nonce: **PG (022)** na API Vercel **ou** SQLite dedicado no runtime Node.
2. Configurar `SENTINELA_AGENT_GATEWAY_ALLOWED_KEY_IDS` + identity registry (023 ou env JSON).
3. n8n: `NONCE_STORE=persistent`, `NONCE_CONSUME_URL`, `INTERNAL_TOKEN` (vault).
4. Proibir `memory_test` fora de harness isolado.
5. Importar **Validate Agent Gateway** alinhado a SHA `c2a60e5a…` (D-P0-2B-3-A).

### B. Comunicação n8n → API

1. Manter `SENTINELA_API_BASE_URL` apontando para API **real** ou piloto **consciente**.
2. Credenciais integração por tenant (`SENTINELA_N8N_*` / vault) — **rotacionar** piloto partilhado B17.
3. Validar egress Docker → host/API (smoke HMAC existente: `pilot:n8n-smoke`).

### C. Ativação workflows AUT

1. Ordem: filhos **READ** (ex. aut-3b-001) → depois WRITE → **por último** SENSITIVE (004/008).
2. `aut-2f-001` **active** só após gateway + nonce OK.
3. Manual/Form documentado como **bypass** — não usar em demo pública de segurança.

### D. Integração Supabase

1. Apply **022** (e **023** se registry PG) com backup autorizado.
2. `DATABASE_URL` server-side apenas.
3. **Não** expor nonces ao cliente.

### E. Testes E2E controlados

1. Harness negativos (4B-A) — **feito**.
2. Camada B: webhook clone, negativos runtime, **sem** 004/008.
3. E2E piloto: G7-H-B ou filho READ com piloto/ preview.
4. Regressão tenant + idempotência WRITE.

### F. Integração WhatsApp

1. Trilha separada (`AUT-WA-002`, Meta runbook).
2. **Depois** de 2F gateway + API estável.
3. Manter workflows WA **inactive** até gate PRE-LIVE.

---

## 11. Encerramento

Relatório entregue. **PARAR** conforme instrução D-P0-2B-4B-B0.

**Aguardar autorização expressa** antes de qualquer implementação, alteração de env, import, activação, migrations ou Camada B.

---

*Fim — D-P0-2B-4B-B0.*
