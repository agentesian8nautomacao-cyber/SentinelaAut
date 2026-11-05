# SENTINELAAUT — D-P0-2B-4B-A3 — Nonce sidecar SQLite (runtime clone)

**Data/hora:** 2026-11-05 ~09:55 (UTC-3)
**Escopo:** clone `dp02b3-import` + sidecar `sentinelaaut-agent-nonce-sidecar-dp02b3`
**Sem:** Supabase/migrations 022–023, AUT-2F-001 activo, n8n live alterado, push/deploy

---

## 1. Resumo executivo

| Item | Resultado |
|------|-----------|
| Sidecar SQLite consume | **Implementado** e **operacional** na rede isolada |
| Smoke health / consume / replay / concorrência | **PASS** |
| Persistência após `docker restart` sidecar | **PASS** (409 replay) |
| n8n clone → sidecar (DNS Docker) | **PASS** (health + 200/409) |
| Sidecar indisponível | **Fail-closed** (fetch `EAI_AGAIN` no n8n; smoke aborta) |
| n8n live | **Inalterado** (Up `:5678`) |
| AUT-2F-001 | **Não activado** nesta fase |

### Veredito: **`PASS WITH CONDITIONS`**

**Condições:** tokens/keys são **sintéticos clone-only** (`dp03-clone-*`); sidecar e clone **parados** ao encerrar; `npm ci` ocorreu **dentro da imagem Docker** (build Linux); PG/migrations **pendentes**; gateway operacional (webhook 2F) **não** validado.

---

## 2. Pré-check (Fase 1)

| Verificação | Evidência | Status |
|-------------|-----------|--------|
| Container clone | `sentinelaaut-n8n-dp02b3-import` existia **Exited (137)** | **PASS** |
| Exit 137 / OOM | `OOMKilled=false`; logs: **SIGTERM**, telemetry DNS na rede internal | **PASS** (stop controlado, não OOM) |
| Artefato SHA | `1db6bac72ec08fac8f5fd1cafc92c3230aed3278bdfd271e67bde65c69678f96` | **PASS** |
| Gateway JS import | `c2a60e5af6805c4b0935ffd758e27a6ce51e9c1dc4b72cdec606e26dd376c218` | **PASS** (evidência D-P0-2B-3) |
| Backup D-P0-2B-1 | `D:\SentinelaAut-Preservation\n8n-quiesced\D-P0-2B-1-20261104-230847` | **PASS** |
| Volume / rede | `sentinelaaut-n8n-dp02b3-work-data`; `sentinelaaut-n8n-dp02b3-isolated` **Internal=true** | **PASS** |
| n8n live separado | `sentinelaaut-n8n-local` Up; clone sem bind `:5678` | **PASS** |

---

## 3. Implementação (Fase 2–3)

### 3.1 Código reutilizado

- Handler: `api/v1/_lib/handlers/agent-gateway/nonce-consume.ts`
- SQLite: `api/v1/_lib/agentGateway/nonceConsumeSqlite.ts`, `nonceConsumeCore.ts`

### 3.2 Artefactos novos

| Ficheiro | Função |
|----------|--------|
| `scripts/n8n-harness/agent-gateway-nonce-sidecar.ts` | HTTP `:3098`, `/api/v1/health`, `/api/v1/agent-gateway/nonce/consume` |
| `scripts/n8n-harness/run-agent-gateway-nonce-sidecar.mjs` | Launcher (strip LIVE env) |
| `docker/dp02b3-isolated/Dockerfile.nonce-sidecar` | Imagem Linux + `npm ci` |
| `docker/dp02b3-isolated/compose-nonce-sidecar.yml` | Sidecar + volume SQLite |
| `scripts/n8n-harness/dp02b3-nonce-smoke.mjs` | Smoke automatizado |
| `scripts/n8n-harness/dp02b3-nonce-restart-smoke.mjs` | Persistência pós-restart |

### 3.3 SHA-256 (implementação sidecar)

| Ficheiro | SHA-256 |
|----------|---------|
| `agent-gateway-nonce-sidecar.ts` | `b0d781c95abbd1469bf7df723ad32c2e9168c0e96ab34f5d4fccacf99dc48835` |
| `compose-nonce-sidecar.yml` | `21a5821dad46ddcc591884a82197e33365a794bb9c96f9c571fd075e73465dc4` |
| `Dockerfile.nonce-sidecar` | `e81c89b9d72b2d44ac7505125f1a1b9a0a7091fa000f2631e8ea0e46f97538b1` |

**Imagem:** `sentinelaaut-agent-nonce-sidecar-dp02b3:local` (build 2026-11-05).

### 3.4 Infra Docker criada

| Recurso | Nome |
|---------|------|
| Container sidecar | `sentinelaaut-agent-nonce-sidecar-dp02b3` |
| Volume SQLite | `dp02b3-isolated_sentinelaaut-agent-nonces-clone-data` (compose project) |
| Rede | `sentinelaaut-n8n-dp02b3-isolated` (external) |
| Porta | **3098** — **apenas** rede Docker (**sem** publish host) |

### 3.5 Configuração clone (n8n) — nomes apenas

Recriado `sentinelaaut-n8n-dp02b3-import` (mesmo volume, mesma imagem digest):

- `SENTINELA_AGENT_GATEWAY_NONCE_CONSUME_URL=http://sentinelaaut-agent-nonce-sidecar-dp02b3:3098/api/v1/agent-gateway/nonce/consume`
- `SENTINELA_AGENT_GATEWAY_INTERNAL_TOKEN` → token sintético clone (valor **omitido**)
- **Não** definido: `SENTINELA_AGENT_GATEWAY_ENABLED`, `NONCE_STORE`, `SECRETS` (gateway operacional **off**)

---

## 4. Smoke runtime (Fase 4)

### 4.1 Sidecar (rede isolada)

```text
docker run --rm --network sentinelaaut-n8n-dp02b3-isolated -v .../dp02b3-nonce-smoke.mjs:/smoke.mjs:ro node:22-bookworm-slim node /smoke.mjs
```

| # | Teste | Resultado |
|---|-------|-----------|
| 1 | Health | **200** `agent-gateway-nonce-sidecar` |
| 3 | Nonce novo | **200** |
| 4 | Replay | **409** `NONCE_REPLAY` |
| 5 | 8× concorrentes | **1×200**, **7×409** |
| 6–7 | Restart sidecar + mesmo nonce | **409** (`dp02b3-nonce-restart-smoke.mjs`) |
| 8 | Sidecar parado | fetch **failed** / health **FAIL** (esperado) |
| 9 | Sidecar reiniciado | smoke completo **PASS** |

### 4.2 n8n clone → sidecar

```text
docker exec sentinelaaut-n8n-dp02b3-import node -e "fetch(.../health)..."
docker exec ... POST consume (200 depois 409)
```

| Teste | HTTP |
|-------|------|
| Health | OK (`agent-gateway-nonce-sidecar`) |
| 1º consume | **200** |
| 2º consume (mesmo nonce) | **409** |
| Sidecar parado | **EAI_AGAIN** (fail-closed na camada rede) |

### 4.3 n8n live

| Verificação | Resultado |
|-------------|-----------|
| Estado pós-smoke | **Up** ~57 min (inalterado) |
| Env agent inject no live | **Não** |

---

## 5. Segurança (Fase 5)

| Regra | Cumprimento |
|-------|-------------|
| Sem Supabase / migrations | **Sim** |
| Sem service_role / prod secrets | **Sim** (registry/allowlist sintéticos no compose) |
| AUT-2F-001 não activado | **Sim** |
| Sem push/deploy | **Sim** |

---

## 6. Backup e rollback

### 6.1 Backup pré-implementação

- Relatórios D-P0-2B-* e volume clone **não** removidos.
- Ficheiros novos versionados no repo (sem secrets em claro no relatório).

### 6.2 Rollback

```powershell
docker stop sentinelaaut-n8n-dp02b3-import sentinelaaut-agent-nonce-sidecar-dp02b3
cd D:\SentinelaAut\docker\dp02b3-isolated
docker compose -f compose-nonce-sidecar.yml down
# Não apagar sentinelaaut-n8n-dp02b3-work-data nem volume nonces sem autorização
# Recriar clone sem env AGENT_* se necessário (imagem digest a8c95f75...)
```

**Estado ao encerrar A3:** clone e sidecar **Stopped** (preservar volumes).

---

## 7. Pendências e riscos

| Pendência | Notas |
|-----------|-------|
| Migration 022 PG | Definitivo produção |
| Testes Vitest PG | Sem integração PG real |
| Gateway webhook 2F | Próxima autorização |
| Tokens clone | Rotacionar antes de qualquer exposição |
| Build sidecar `npm ci` | Imagem local; vulnerabilidades npm audit no build log |

---

## 8. Comandos úteis (reprise)

```powershell
cd D:\SentinelaAut\docker\dp02b3-isolated
docker compose -f compose-nonce-sidecar.yml build
docker compose -f compose-nonce-sidecar.yml up -d
docker start sentinelaaut-n8n-dp02b3-import
docker run --rm --network sentinelaaut-n8n-dp02b3-isolated -v D:/SentinelaAut/scripts/n8n-harness/dp02b3-nonce-smoke.mjs:/smoke.mjs:ro node:22-bookworm-slim node /smoke.mjs
```

---

## 9. Veredito final

### **`PASS WITH CONDITIONS`**

Sidecar SQLite + consume API **funcionam** no clone isolado; n8n clone **alcança** o sidecar; replay e persistência **comprovados**. Condições: credenciais de teste, serviços **parados** no encerramento, gateway **não** operacional.

**PARAR** — sem gateway definitivo, AUT-2F-001, PostgreSQL ou WhatsApp até nova autorização.

---

*Fim — D-P0-2B-4B-A3.*
