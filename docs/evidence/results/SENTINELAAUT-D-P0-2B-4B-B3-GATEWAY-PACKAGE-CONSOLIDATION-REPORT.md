# SENTINELAAUT — D-P0-2B-4B-B3 — Consolidação do pacote Gateway agent-v1

**Data/hora:** 2026-11-05 ~10:32 (UTC-3)
**Referência:** [B2 VERSIONED GATEWAY PACKAGE](./SENTINELAAUT-D-P0-2B-4B-B2-VERSIONED-GATEWAY-PACKAGE-REPORT.md)
**HEAD Git (inalterado por commit):** `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68`

---

## 1. Resumo executivo

A B3 aplicou **saneamento de segurança** no sidecar Docker (remoção de registry JSON inline do YAML), reforçou **gitignore** para env local, manteve **`router.ts`** com rotas gateway **e** operações M5A/M6A, e validou **`pg` + lockfile**. **174 testes Vitest** gateway voltaram a **PASS** após reinstalação de devDependencies.

### Veredito: **`PASS WITH CONDITIONS`**

**Condições:** operador deve criar `docker/dp02b3-isolated/nonce-sidecar.env` a partir do `.example` antes do sidecar (A3/B4); `npm ci` falhou neste host por **EPERM** (ficheiros em uso) — usar `npm install --include=dev` em dev; diff `package.json` inclui scripts piloto **fora** do gateway (documentado, não revertido); E2E clone **ainda não** executado (B4).

---

## 2. Fase 1 — Pré-check

| Item | Resultado |
|------|-----------|
| Branch | `main` |
| HEAD | `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` |
| Relatórios B2, A3, A4, A5, B0, B1 | **Presentes** |
| Lista §9 B2 (~70 paths) | **Confirmada** no disco (+ 2 novos da B3 abaixo) |
| PG A4 `sentinelaaut-pg-nonce-test-a4` | **Exited (0)** — volume **não** removido |
| n8n live | **Up** — **não** alterado nesta fase |
| Alterações pós-B2 | Apenas trabalho **desta B3** (compose, example env, gitignore) |

**Operações proibidas respeitadas:** sem `git add`/`commit`/`push`, migrations, containers, AUT-2F-001, Supabase LIVE.

---

## 3. Fase 2 — Saneamento

### 3.1 `compose-nonce-sidecar.yml`

| Antes | Depois |
|-------|--------|
| `IDENTITY_REGISTRY` JSON **inline** no YAML (token sintético embutido) | `env_file` opcional `nonce-sidecar.env`; registry via **`${SENTINELA_AGENT_GATEWAY_IDENTITY_REGISTRY:-}`** ou ficheiro local |
| `ALLOWED_KEY_IDS` fixo | Default **`${...:-dp03-clone-test-key}`** (identificador clone, não secret) |

**Novos ficheiros:**

| Ficheiro | SHA-256 | Função |
|----------|---------|--------|
| `docker/dp02b3-isolated/nonce-sidecar.env.example` | `34b7d3291728f19e63e4e0473fa4bc569f4651e560e2c2479ba4e783a55f1424` | Template **sem** tokens commitados |
| `compose-nonce-sidecar.yml` (pós-B3) | `f86cab8c9bca97a7a925d6040da7380ab0bc22be5a3355eab7ce2c37301871f8` | Compose saneado |

**Reprodutibilidade A3/B4:** copiar `nonce-sidecar.env.example` → `nonce-sidecar.env` (gitignored), preencher `SENTINELA_AGENT_GATEWAY_IDENTITY_REGISTRY` com tokens **clone-only** alinhados a `SMOKE_INTERNAL_TOKEN` / clone n8n. Smoke `dp02b3-nonce-smoke.mjs` mantém defaults **sintéticos** no script (ops local, não produção).

### 3.2 `router.ts`

**Diff vs HEAD (mantido integralmente, sem restore):**

| Rota adicionada | Finalidade | Decisão |
|-----------------|------------|---------|
| `/operations/reservations/availability` | API ops M6A | **MANTIDA** (pré-existente no working tree) |
| `/operations/areas` | API ops M5A | **MANTIDA** |
| `/agent-gateway/nonce/consume` | Nonce store gateway | **MANTIDA** (pacote gateway) |

Nenhuma linha removida; comportamento anterior preservado.

### 3.3 `package.json` / lockfile

| Item | Estado |
|------|--------|
| `pg` ^8.13.1 (dependencies) | **Presente** |
| `@types/pg` (devDependencies) | **Presente** |
| `node_modules/pg` | **Resolvido** após install |
| `package-lock.json` | **+161 linhas** (entrada `pg` e transitivas) |

**Nota:** diff `package.json` vs HEAD também altera scripts `pilot:api`, `pilot:n8n-smoke`, `demo:n8n-local:check` — **não** revertidos (comportamento piloto legítimo no working tree); **REVISAR** no commit futuro se desejado commit **só** gateway.

**Instalação reproduzível (nesta máquina):**

- `npm ci` → **FALHOU** (`EPERM` unlink esbuild/rollup).
- `npm install --include=dev` → **OK** (restaurou `vitest` em `node_modules`).

---

## 4. Backups B3

| Caminho |
|---------|
| `backups/d-p0-2b-4b-b3-20261105/compose-nonce-sidecar.yml` |
| `backups/d-p0-2b-4b-b3-20261105/router.ts` |
| `backups/d-p0-2b-4b-b3-20261105/package.json` |
| `backups/d-p0-2b-4b-b3-20261105/package-lock.json` (se existia) |

---

## 5. Fase 3 — Integridade do pacote (vs B2 §9)

| Alteração à lista B2 | Decisão |
|----------------------|---------|
| `docker/dp02b3-isolated/nonce-sidecar.env.example` | **INCLUIR** (novo) |
| `.gitignore` (+ `docker/dp02b3-isolated/nonce-sidecar.env`) | **INCLUIR** |
| Demais paths §9 B2 | **INCLUIR** (inalterados na B3) |
| `backups/**`, pilotos G7, admin | **EXCLUIR** (inalterado) |

**BLOQUEADO por política:** credenciais reais em qualquer path versionável — **nenhuma** introduzida.

---

## 6. Fase 4 — Testes

| Execução | Comando | Resultado |
|----------|---------|-----------|
| Suíte B2 (18 ficheiros) | `npx vitest run` (lista B2 + `agentGatewayN8nVmRuntime.test.ts`) | **174/174 PASS** (~5,8s) |
| Integração PG | `agentGatewayPgNonce.integration.test.ts` | **NOT VERIFIED** (requer PG + Docker) |
| Smoke sidecar / clone | `dp02b3-nonce-smoke.mjs` | **NOT VERIFIED** (requer infra) |

**Contratos cobertos pelos testes (código):** HMAC, rawBody, nonce/replay, fail-closed store, HTTP **200/401/409/503** (consume API + gateway agregado).

---

## 7. Manifesto candidato (delta B3 + referência B2)

Lista completa permanece a **§9 do relatório B2**, com **acréscimos**:

```
docker/dp02b3-isolated/nonce-sidecar.env.example
.gitignore   # entrada nonce-sidecar.env
```

**Estado Git típico do pacote:** `??` (não rastreado) + `M` em `router.ts`, `.env.example`, `package.json`, `package-lock.json`, `.gitignore`.

| Ficheiro alterado na B3 | Git | Sensível | Incluir |
|-------------------------|-----|----------|---------|
| `compose-nonce-sidecar.yml` | `??` | Não (sem tokens inline) | Sim |
| `nonce-sidecar.env.example` | `??` | Não | Sim |
| `.gitignore` | `M` | Não | Sim |
| `router.ts` | `M` | Não | Sim |
| `package.json` / `package-lock.json` | `M` | Não | Sim (REVISAR scripts piloto) |

**Não versionar:** `docker/dp02b3-isolated/nonce-sidecar.env` (local).

---

## 8. Riscos remanescentes

1. Sidecar **não arranca** consume identity até `nonce-sidecar.env` preenchido — **esperado** (fail-closed).
2. Pacote ainda **sem commit** no Git.
3. `npm ci` Windows EPERM — CI/Linux deve validar lockfile.
4. Workflow live vs repo — **NOT VERIFIED**.
5. Compose `env_file` `required: false` requer Compose v2 recente; senão criar ficheiro vazio local.

---

## 9. Prontidão para E2E (B4)

| Critério | Estado |
|----------|--------|
| Código coerente + testes locais | **PASS** |
| Sem secrets no YAML versionável | **PASS** (pós-B3) |
| Sidecar + clone playbook (A3) | **PASS** com env local |
| n8n HMAC + persistent nonce HTTP | **READY TO TRY** no clone isolado |
| PostgreSQL no path n8n | **NOT VERIFIED** (opcional B4+) |

---

## 10. Rollback (B3)

```text
copy backups\d-p0-2b-4b-b3-20261105\compose-nonce-sidecar.yml docker\dp02b3-isolated\
# Remover nonce-sidecar.env.example se necessário
# Reverter linha .gitignore manualmente
```

Volumes A3/A4/A5 e backups A5 **não** foram removidos.

---

## 11. Plano B4 / B5 (antecipação)

| Fase | Acção |
|------|--------|
| **B4** | Clone + `nonce-sidecar.env` + smoke HMAC + consume; **sem** live |
| **B5** | Commit atómico pacote §9 B2 + delta B3; CI Vitest + job PG opcional |

---

## 12. SHA e encerramento

| | Valor |
|---|--------|
| SHA Git início / fim | `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` (**sem commit**) |
| Ficheiros criados | `nonce-sidecar.env.example`, relatório B3 |
| Ficheiros modificados | `compose-nonce-sidecar.yml`, `.gitignore` |
| n8n live / Supabase / volumes | **Inalterados** |

---

**PARAR — aguardar autorização para B4 (E2E clone isolado).**
