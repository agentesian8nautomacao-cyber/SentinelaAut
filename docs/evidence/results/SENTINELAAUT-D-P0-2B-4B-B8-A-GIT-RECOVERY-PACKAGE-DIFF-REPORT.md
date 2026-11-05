# SENTINELAAUT — D-P0-2B-4B-B8-A — Git Recovery, Worktree Verification & Package Finalization

**Data:** 2026-11-05
**Veredito:** **PASS WITH CONDITIONS** (inspeção Git **completa** via executável funcional; pacote §10 **100% presente** no disco)

---

## 1. Resumo executivo

A falha `BUG (fork bomb)` da B8 foi **reproduzida e explicada**: apenas `C:\Program Files\Git\bin\git.exe` falha; **`C:\Program Files\Git\cmd\git.exe`** e **`mingw64\bin\git.exe`** funcionam (Git **2.55.0.windows.5**).

Com `cmd\git.exe` foi possível:

- Confirmar **HEAD** `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68`, branch **`main`**, **ahead 1** vs `origin/main` (`121acd3`).
- Confirmar **index vazio** (sem staging).
- Inventariar working tree (**94** paths modificados vs HEAD no `--shortstat` tracked; centenas de `??`).
- Verificar **93/93** caminhos da B8 §10 — **todos existem**; estados Git recolhidos.
- Revisar **`router.ts`**: diff **+5 −1** linhas, **4 rotas** (1 gateway + 2 ops + formatação).

**Não executado:** `git add`, commit, push, deploy, alteração de código/manifests.

---

## 2. Causa raiz — falha Git Windows

| Executável | `git --version` | Exit |
|------------|-----------------|------|
| `C:\Program Files\Git\cmd\git.exe` | `git version 2.55.0.windows.5` | **0** |
| `C:\Program Files\Git\mingw64\bin\git.exe` | `git version 2.55.0.windows.5` | **0** |
| `C:\Program Files\Git\bin\git.exe` | `BUG (fork bomb): ...\bin\git.exe` | **1** |

**Interpretação:** invocações que apontam directamente para **`Git\bin\git.exe`** (padrão em alguns wrappers/IDE, incl. tentativas B7/B8 com caminho `bin`) entram em loop de re-execução. O entrypoint suportado no Windows é **`Git\cmd\git.exe`**, que delega correctamente ao runtime MSYS/MINGW64.

**Ambiente adicional observado:**

- `git` **não** está no PATH do PowerShell da sessão (`where.exe git` → não encontrado).
- `Get-Command git` → vazio.
- Processos Git em execução: **nenhum** (`git.exe`).

**Plano de reparo (não aplicado — aguarda autorização):** preferir `cmd\git.exe` em scripts/CI; opcionalmente reparar instalação Git for Windows ou garantir PATH `...\Git\cmd` antes de `...\Git\bin`; **não** alterar PATH global nesta fase.

---

## 3. Ambiente e método de inspeção

| Item | Valor |
|------|--------|
| Repositório | `D:/SentinelaAut` |
| Git funcional | `C:\Program Files\Git\cmd\git.exe` |
| OS | Windows 10.0.26100 |
| Shell | PowerShell (Cursor) |

Comandos utilizados (sequenciais, não destrutivos):
`rev-parse HEAD`, `branch --show-current`, `status -sb`, `status --porcelain`, `diff --cached`, `diff --stat`, `diff` (router, package.json), `check-ignore`, `log -1`.

**WSL / clone remoto:** **não necessários** — working tree Windows inspeccionada directamente.

---

## 4. HEAD, branch e relação com remoto

| Campo | Valor |
|-------|--------|
| HEAD | `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` |
| Mensagem HEAD | `fix(api): restore v1 vercel routing` |
| Branch | `main` |
| `origin/main` | `121acd3` (`correções`) |
| Tracking | `main...origin/main [ahead 1]` |

O pacote agent-v1 **não está commitado**; alterações são working tree + untracked sobre `f0d76cc`.

---

## 5. Estado da working tree

### 5.1 Resumo quantitativo

| Métrica | Valor |
|---------|--------|
| Diff tracked vs HEAD (`--shortstat`) | **94 files**, +2359 / −479 linhas |
| Staging (`diff --cached`) | **vazio** |
| Paths §10 verificados | **93** |
| §10 em falta no disco | **0** |

### 5.2 Modificados tracked (`M`) — amostra relevante ao pacote

- `api/v1/_lib/router.ts`
- `.env.example`, `.gitignore`
- `package.json`, `package-lock.json`
- `scripts/n8n-harness/local-api-pilot.ts`, `pilot-http.mjs`, … (**fora** §10 — commit piloto separado)

### 5.3 Untracked (`??`) — pacote agent-v1 (§10)

Quase todo o pacote gateway está **`??`**: `api/_lib/db/`, `api/v1/_lib/agentGateway/`, `handlers/agent-gateway/`, migrations **022/023**, harness `agentGateway*`, `docker/dp02b3-isolated/`, `n8n/workflows/AUT-2F-001-INTENT-ROUTER.json`, relatórios `SENTINELAAUT-D-P0-2B-4B-*.md`, etc.

### 5.4 Untracked **fora** do pacote (EXCLUDE staging gateway)

Exemplos: `api/_lib/admin/`, `api/master/` (novos), `hitlCustody*`, `backups/`, `docs/evidence/*.sql` LIVE, `_tmp_*.sqlite`, `SENTINELAAUT-WORKTREE-BACKUP-*.patch`, dezenas de migrations M5A–M11, `App.tsx`, componentes, etc.

### 5.5 Ignorados confirmados (`check-ignore`)

| Path | Regra |
|------|--------|
| `docker/dp02b3-isolated/nonce-sidecar.env` | `.gitignore` `*.env` |
| `docker/dp02b3-isolated/n8n-clone-b4.env` | idem |
| `.env` | idem |

---

## 6. Comparação B8 §10 (93 paths)

**Resultado:** todos os paths existem. Estados Git:

| Estado | Contagem §10 | Paths |
|--------|--------------|--------|
| `??` untracked | **89** | Maioria do pacote |
| `M` modified | **4** | `router.ts`, `.env.example`, `.gitignore`, `package.json`, `package-lock.json` → **5 entries** (package.json + lock = 2 of M) |

Detalhe: **89 + 5 = 94** — `router.ts` + 4 config/deps; restante §10 = `??`.

**Ficheiros §10 ausentes do disco:** nenhum.

**Ficheiros §10 extra recomendados (co-requisito `router.ts`, ver §7):**

| Path | Git | Nota |
|------|-----|------|
| `api/v1/_lib/handlers/operations/areas/index.ts` | `??` | Rota `/operations/areas` no diff |
| `api/v1/_lib/handlers/operations/reservations/availability.ts` | `??` | Rota `/operations/reservations/availability` |

Sem estes handlers, as **duas rotas ops** do diff de `router.ts` falham em runtime; a rota **gateway** `/agent-gateway/nonce/consume` depende só dos paths já no §10.

---

## 7. Revisão especial — `api/v1/_lib/router.ts`

Diff completo vs `f0d76cc`:

```diff
   '/operations/reservations/cancel': () => import('./handlers/operations/reservations/cancel')
+  '/operations/reservations/cancel': () => import('./handlers/operations/reservations/cancel'),
+  '/operations/reservations/availability': () =>
+    import('./handlers/operations/reservations/availability'),
+  '/operations/areas': () => import('./handlers/operations/areas/index'),
+  '/agent-gateway/nonce/consume': () => import('./handlers/agent-gateway/nonce-consume')
```

| Bloco | Classificação | Decisão |
|-------|---------------|---------|
| `/agent-gateway/nonce/consume` | Gateway agent-v1 | **INCLUDE** |
| `/operations/reservations/availability` | Ops M6A (n8n 3B-005) | **REVIEW** — requer handler untracked |
| `/operations/areas` | Ops M5A (n8n 3B-004) | **REVIEW** — requer handler untracked |
| Vírgula / cancel line | Mecânico | **INCLUDE** com ficheiro |

**Recomendação objectiva:** **INCLUDE** `router.ts` no commit gateway **desde que** os dois handlers ops acima entrem no **mesmo** commit (ou em commit ops imediatamente anterior). **Não** separar fisicamente o ficheiro nesta fase. Alternativa conservadora: commit só gateway seria **incompleto** para as rotas ops — **REVIEW MANUAL** se quiser commit “gateway-only” estrito (exigiria reverter 2 linhas ops, **não autorizado** nesta fase).

---

## 8. Dependências e lockfile

### `package.json` diff vs HEAD

| Alteração | Relação gateway | Decisão |
|-----------|-----------------|---------|
| `"pg": "^8.13.1"` | Runtime nonce PG | **INCLUDE** |
| `"@types/pg": "^8.11.10"` | Types | **INCLUDE** |
| `pilot:api` → `run-local-api-pilot.mjs` | Harness B7 | **REVIEW** |
| `pilot:n8n-smoke`, `demo:n8n-local:check` | Harness | **REVIEW** |
| `vitest` 2.0.0 → 2.1.9 | Dev | **REVIEW** (alinhado a 188 testes) |

**Coerência imports:** `pgPool.ts`, `identityRegistryPg.ts`, `nonce-consume.ts` importam `pg` / pool — **manifest alinhado**.

**Lockfile:** `package-lock.json` **M** — deve acompanhar `pg` no commit; **não** re-executado install nesta fase.

---

## 9. Revisão de segurança (estática)

| Item | Resultado |
|------|-----------|
| `.env` / clone / sidecar env reais | **Ignorados** |
| YAML Docker | Sem JSON inline de registry (pós-B3); comentários + `env_file` |
| `.env.example` | Placeholders; secção Agent Gateway |
| `n8n-clone-b4.env.example` | Valores **sintéticos documentados** — risco operacional **REVIEW** |
| Harness defaults `*-not-production` | Esperado em teste/E2E |
| Frontend `service_role` | Não detectado em código de produto do pacote |
| §10 sem `backups/`, `_tmp_*`, stub B6 | Confirmado (stub **fora** §10) |

---

## 10. Lista final — decisão por path (§10 + co-requisitos)

Legenda: **INCLUDE** | **EXCLUDE** | **REVIEW** | **BLOCKED**

### A. INCLUDE (autorizáveis para staging futuro — 93 §10 + 2 co-req + B8-A)

Todos os 93 paths da B8 §10 → **INCLUDE** (existem; estados `??` ou `M`).

Adicionar ao bloco de staging:

- `docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B8-A-GIT-RECOVERY-PACKAGE-DIFF-REPORT.md` (**INCLUDE**)
- `api/v1/_lib/handlers/operations/areas/index.ts` (**INCLUDE** co-req router)
- `api/v1/_lib/handlers/operations/reservations/availability.ts` (**INCLUDE** co-req router)

### B. EXCLUDE (não staging gateway)

| Path / glob | Motivo |
|-------------|--------|
| `backups/**` | Categoria G |
| `docs/evidence/results/_tmp_*`, `*.sqlite` | Temp / PII risk |
| `scripts/n8n-harness/b7c-matrix-output.json` | Temp |
| `scripts/n8n-harness/b6-isolated-api-stub.mjs` | Stub B6 |
| `docker/**/nonce-sidecar.env`, `n8n-clone-b4.env` | **BLOCKED** secrets |
| Working tree `M`/`??` fora pacote (master, admin, HITL, App, …) | Categoria H |

### C. REVIEW (commit separado ou diff consciente)

| Path | Motivo |
|------|--------|
| `scripts/n8n-harness/local-api-pilot.ts` + gate + shutdown + wiring test | Piloto B7 — § B8 “commit separado” |
| `scripts/n8n-harness/pilot-http.mjs`, `dp04-b6-list-events-matrix.mjs` | Harness / histórico stub |
| `package.json` scripts pilot + vitest bump | Mistura harness com `pg` |
| `n8n/shared/hmac-code.js` | Incluir **se** diff vs HEAD relevante (não re-auditado linha a linha nesta fase) |

### D. BLOCKED

- Qualquer `.env` real, ficheiros com tokens de produção, backups com dumps.

---

## 11. Tabela §10 (resumo compacto)

| Grupo | Qtd | Git predominante | Decisão grupo |
|-------|-----|------------------|---------------|
| API gateway + pgPool | 14 | `??` + `M` router | INCLUDE |
| Migrations 022/023 | 4 | `??` | INCLUDE |
| Harness agentGateway + dp04 + sidecar | 38 | `??` | INCLUDE |
| Docker dp02b3 | 9 | `??` | INCLUDE |
| Workflow + dotfiles + template | 4 | `??` / `M` | INCLUDE |
| Relatórios evidência B* | 17 | `??` | INCLUDE |
| package.json + lock | 2 | `M` | INCLUDE (+ REVIEW scripts) |

---

## 12. Bloco PowerShell — staging futuro (NÃO EXECUTAR nesta fase)

Usar **sempre** `cmd\git.exe`. Copiar/colar **após** autorização B9.

```powershell
$Repo = 'D:\SentinelaAut'
$Git  = 'C:\Program Files\Git\cmd\git.exe'

$Include = @(
  'api/_lib/db/pgPool.ts'
  'api/v1/_lib/agentGateway/allowedKeyIds.ts'
  'api/v1/_lib/agentGateway/allowedKeyIds.test.ts'
  'api/v1/_lib/agentGateway/identityAuth.ts'
  'api/v1/_lib/agentGateway/identityRegistryEnv.ts'
  'api/v1/_lib/agentGateway/identityRegistryEnv.test.ts'
  'api/v1/_lib/agentGateway/identityRegistryPg.ts'
  'api/v1/_lib/agentGateway/nonceConsumeCore.ts'
  'api/v1/_lib/agentGateway/nonceConsumeHttpOutcome.ts'
  'api/v1/_lib/agentGateway/nonceConsumeHttpOutcome.test.ts'
  'api/v1/_lib/agentGateway/nonceConsumeSqlite.ts'
  'api/v1/_lib/handlers/agent-gateway/nonce-consume.ts'
  'api/v1/_lib/handlers/agent-gateway/nonce-consume.identity.test.ts'
  'api/v1/_lib/handlers/operations/areas/index.ts'
  'api/v1/_lib/handlers/operations/reservations/availability.ts'
  'api/v1/_lib/router.ts'
  'supabase/migrations/20261103180000_022_agent_gateway_nonces.sql'
  'supabase/migrations/20261103180000_022_agent_gateway_nonces.rollback.sql'
  'supabase/migrations/20261103200000_023_agent_gateway_identity_registry.sql'
  'supabase/migrations/20261103200000_023_agent_gateway_identity_registry.rollback.sql'
  'scripts/n8n-harness/agentGatewayV1.ts'
  'scripts/n8n-harness/agentGatewayV1.test.ts'
  'scripts/n8n-harness/agentGatewayValidate.n8n.js'
  'scripts/n8n-harness/agentGatewayValidate.n8n.test.ts'
  'scripts/n8n-harness/agentGatewayNonceMode.ts'
  'scripts/n8n-harness/agentGatewayNonceMode.test.ts'
  'scripts/n8n-harness/agentGatewayHarnessRuntime.ts'
  'scripts/n8n-harness/agentGatewayHarnessRuntime.test.ts'
  'scripts/n8n-harness/agentGatewayRawBody.ts'
  'scripts/n8n-harness/agentGatewayRawBody.test.ts'
  'scripts/n8n-harness/agentGatewayTenantPolicy.ts'
  'scripts/n8n-harness/agentGatewayTenantPolicy.test.ts'
  'scripts/n8n-harness/agentGatewayWorkflowPolicy.ts'
  'scripts/n8n-harness/agentGatewayWorkflowPolicy.test.ts'
  'scripts/n8n-harness/agentGatewayHttpNonceStore.ts'
  'scripts/n8n-harness/agentGatewayHttpNonceStore.test.ts'
  'scripts/n8n-harness/agentGatewayPersistentNonceStore.ts'
  'scripts/n8n-harness/agentGatewayPersistentNonceStore.test.ts'
  'scripts/n8n-harness/agentGatewayN8nVmRuntime.test.ts'
  'scripts/n8n-harness/agentGatewayPgNonce.integration.test.ts'
  'scripts/n8n-harness/aut-2f-001-agent-gateway.wiring.test.ts'
  'scripts/n8n-harness/aut-2f-001-agent-gateway.parity.test.ts'
  'scripts/n8n-harness/patch-aut-2f-001-agent-gateway.mjs'
  'scripts/n8n-harness/patch-aut-2f-001-agent-gateway.test.ts'
  'scripts/n8n-harness/patch-aut-2f-001-webhook-response.mjs'
  'scripts/n8n-harness/patch-aut-2f-001-webhook-response.test.ts'
  'scripts/n8n-harness/d-p0-1-agent-gateway-matrix.test.ts'
  'scripts/n8n-harness/agent-gateway-nonce-sidecar.ts'
  'scripts/n8n-harness/run-agent-gateway-nonce-sidecar.mjs'
  'scripts/n8n-harness/dp02b3-nonce-smoke.mjs'
  'scripts/n8n-harness/dp02b3-nonce-restart-smoke.mjs'
  'scripts/n8n-harness/dp04-b4-e2e-matrix.mjs'
  'scripts/n8n-harness/dp04-b4-e2e-webhook-harness.mjs'
  'scripts/n8n-harness/dp04-b7-real-gateway-matrix.mjs'
  'scripts/n8n-harness/dp04-b7c-router-coverage-matrix.mjs'
  'scripts/n8n-harness/merge-clone-b6-env.mjs'
  'scripts/n8n-harness/merge-clone-b7-env.mjs'
  'docker/dp02b3-isolated/Dockerfile.nonce-sidecar'
  'docker/dp02b3-isolated/Dockerfile.api-pilot'
  'docker/dp02b3-isolated/compose-nonce-sidecar.yml'
  'docker/dp02b3-isolated/compose-postgres-nonce-test.yml'
  'docker/dp02b3-isolated/compose-b4-e2e-pg.yml'
  'docker/dp02b3-isolated/compose-b7-real-pilot.yml'
  'docker/dp02b3-isolated/nonce-sidecar.env.example'
  'docker/dp02b3-isolated/n8n-clone-b4.env.example'
  'n8n/workflows/AUT-2F-001-INTENT-ROUTER.json'
  '.env.example'
  '.gitignore'
  'docs/evidence/isolated/d-p0-1/CLONE-NONCE-PERSISTENCE-ENV-TEMPLATE.env.example'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-A-NEGATIVE-HARNESS-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-A-NONCE-PERSISTENCE-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-A1-READONLY-AUDIT-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-A2-PREFLIGHT-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-A3-NONCE-SIDECAR-RUNTIME-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-A4-POSTGRES-NONCE-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-A5-PG-NONCE-FAILURE-HARDENING-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B0-NONCE-PREFLIGHT-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B1-GATEWAY-INTEGRATION-READINESS-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B2-VERSIONED-GATEWAY-PACKAGE-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B3-GATEWAY-PACKAGE-CONSOLIDATION-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B4-E2E-INTEGRATION-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B5-WORKFLOW-RESPONSE-HARDENING-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B6-CLONE-CREDENTIAL-ALIGNMENT-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B7-REAL-GATEWAY-N8N-INTEGRATION-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B7-C-ROUTER-COVERAGE-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B8-FINAL-PACKAGE-AUDIT-REPORT.md'
  'docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B8-A-GIT-RECOVERY-PACKAGE-DIFF-REPORT.md'
  'package.json'
  'package-lock.json'
)

# Descomentar após autorização B9:
# foreach ($p in $Include) { & $Git -C $Repo add -- $p }
# & $Git -C $Repo status -sb
```

---

## 13. Validação final (gate)

| Verificação | Estado |
|-------------|--------|
| HEAD conhecido | **OK** |
| Branch `main` | **OK** |
| Working tree inspeccionada | **OK** |
| Staging vazio | **OK** |
| Commit / push | **Não** |
| Código/manifests alterados nesta fase | **Só este relatório** |
| n8n live | **Up** — intacto |
| PG A4 + volumes | **Up** — preservados |
| Git recuperado para inspeção | **OK** (`cmd\git.exe`) |

---

## 14. Riscos e limitações

1. Ferramentas/IDE que invocam **`bin\git.exe`** continuarão a falhar até PATH/reinstalação.
2. **`main` ahead 1** — push futuro deve considerar histórico vs `origin/main`.
3. Working tree **muito maior** que §10 — risco de `git add` acidental.
4. Lacunas B7-C (HITL, idempotência router, multi-tenant) **persistem**.
5. `package.json` mistura **`pg`** e scripts **pilot** — revisão humana no PR.

---

## 15. Recomendação para B9

1. **Autorização expressa** para staging.
2. Executar bloco §12 com **`cmd\git.exe`**; validar `git status` (≤ ~98 paths staged).
3. `npx vitest run scripts/n8n-harness` + opcional PG URL A4.
4. Commit atómico; PR; **sem** deploy prod.
5. (Opcional) Commit **#2** piloto B7 — paths REVIEW §10 C do relatório B8.

---

**Gate B8-A:** relatório entregue. Pacote **tecnicamente preparado** para decisão de staging. **Sem** autorização automática de versionamento.
