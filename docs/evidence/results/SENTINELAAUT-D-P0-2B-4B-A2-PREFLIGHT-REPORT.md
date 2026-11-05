# SENTINELAAUT — D-P0-2B-4B-A2 — Pré-check do smoke runtime de nonce (clone D-P0-1)

**Data/hora:** 2026-11-05 ~09:35 (UTC-3)
**Modo:** READ-ONLY — **sem** `docker start`, **sem** inject env, **sem** alterar compose/workflows
**Objetivo:** Preparar validação **n8n → sidecar SQLite → `POST /api/v1/agent-gateway/nonce/consume`**, **sem** activar gateway operacional (AUT-2F-001)

**Base:** D-P0-2B-4B-A (persistência), D-P0-2B-4B-B0, D-P0-2B-3-A, `_dp02b3_*`

---

## 1. Resumo executivo

| Área | Resultado |
|------|-----------|
| Clone dp02b3 (identidade, volume, rede) | **PASS** — parado, integridade documentada |
| Sidecar API consume no clone | **NOT VERIFIED** — **não existe** serviço Docker definido no repo |
| Env agent-gateway no clone | **FAIL** — ausente; URLs dummy (`127.0.0.1:1`, webhook `:59999`) |
| Rede isolada | **PASS** — `Internal: true`; exige sidecar **na mesma rede** |
| Conflito portas vs n8n live | **PASS** — clone **sem** bind `:5678`; live em `:5678` |
| Plano de smoke | **Preparado** (§6) — execução **pendente** autorização |

### Veredito: **`READY WITH CONDITIONS`**

**Condições:** (1) criar e autorizar **sidecar** consume na rede `sentinelaaut-n8n-dp02b3-isolated`; (2) inject env **só** no clone (recreate/start autorizado); (3) **não** activar AUT-2F-001 — smoke inicial via **HTTP directo** + opcional **Code/exec** isolado; (4) migrations Supabase **fora** do smoke SQLite.

**BLOCKED** se interpretação for “sidecar já disponível no clone hoje” — **não está**.

---

## 2. Secção 1 — Identificação do ambiente

| Requisito | Evidência | Classificação |
|-----------|-----------|---------------|
| Clone `dp02b3-import` | Nome `sentinelaaut-n8n-dp02b3-import`; ID prefixo `9186c88941dd…` | **PASS** |
| SHA artefato D-P0-1 | `1db6bac72ec08fac8f5fd1cafc92c3230aed3278bdfd271e67bde65c69678f96` (recalc 2026-11-05 + `_dp02b3_artifact_sha256.json`) | **PASS** |
| SHA js gateway importado | `c2a60e5af6805c4b0935ffd758e27a6ce51e9c1dc4b72cdec606e26dd376c218` (`_dp02b3_gateway_security_validation.json`) | **PASS** |
| Estado container | **exited**, ExitCode **137** (`docker inspect` READ-ONLY) | **PASS** |
| Imagem | Digest `sha256:a8c95f75…`; n8n **2.38.7** (inventário D-P0-2B-3) | **PASS** |
| Volume | `sentinelaaut-n8n-dp02b3-work-data` → `/home/node/.n8n` | **PASS** |
| Rede | `sentinelaaut-n8n-dp02b3-isolated`, **Internal=true** | **PASS** |
| Backup D-P0-2B-1 | `D:\SentinelaAut-Preservation\n8n-quiesced\D-P0-2B-1-20261104-230847` — path **existe** | **PASS** |
| Integridade import | nodes/connections/wiring gateway = artefato (D-P0-2B-3-A) | **PASS** |
| Git HEAD | `main` @ `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` | **PASS** |
| Untracked relevante | `CLONE-NONCE-PERSISTENCE-ENV-TEMPLATE.env.example`, relatório 4B-A nonce, ficheiros `??` em `api/…/nonce-*`, `agentGatewayPersistentNonceStore.ts` | **PASS WITH CONDITIONS** |
| n8n live intocado | `sentinelaaut-n8n-local` **Up** `:5678`; clone **sem** porta host publicada | **PASS** |
| `aut-2f-001.active` no clone (evidência histórica) | `imported_active: false` (`_dp02b3_gateway_security_validation.json`) | **PASS** (estático); **NOT VERIFIED** pós-stop sem SQLite RO |

**Nota:** SQLite do volume **não** foi montado nesta fase (proibido iniciar containers efêmeros não autorizados).

---

## 3. Secção 2 — Auditoria de configuração

### 3.1 Variáveis e URLs (nomes apenas)

| Variável / conceito | Onde definido | Estado clone (inspect) | Classificação |
|---------------------|---------------|------------------------|---------------|
| `SENTINELA_AGENT_GATEWAY_NONCE_CONSUME_URL` | Template `CLONE-NONCE-PERSISTENCE-ENV-TEMPLATE.env.example`; n8n JS L294 | **Ausente** | **FAIL** |
| `SENTINELA_AGENT_GATEWAY_INTERNAL_TOKEN` | Idem; header `x-sentinela-agent-gateway-internal-token` | **Ausente** | **FAIL** |
| `SENTINELA_AGENT_GATEWAY_NONCE_STORE` | `.env.example`, n8n JS | **Ausente** | **FAIL** |
| `SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH` | Handler `nonce-consume.ts` L231 | Sidecar **não** deployado | **NOT VERIFIED** |
| `SENTINELA_AGENT_GATEWAY_ALLOWED_KEY_IDS` | Handler L193–198 | Sidecar **não** deployado | **NOT VERIFIED** |
| `SENTINELA_AGENT_GATEWAY_IDENTITY_REGISTRY` | `identityAuth.ts` | Sidecar **não** deployado | **NOT VERIFIED** |
| `WEBHOOK_URL` | Clone | `http://127.0.0.1:59999/` (dummy anti-colisão) | **PASS** (intencional) |
| `SENTINELA_API_BASE_URL` | Clone | `http://127.0.0.1:1/` (loopback morto) | **PASS** (contenção) |

### 3.2 Endpoint e implementação

| Item | Localização | Classificação |
|------|-------------|---------------|
| Rota API | `api/v1/_lib/router.ts` → `'/agent-gateway/nonce/consume'` | **PASS** |
| Handler | `api/v1/_lib/handlers/agent-gateway/nonce-consume.ts` | **PASS** |
| SQLite | `nonceConsumeSqlite.ts` + `SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH` | **PASS** (código) |
| PG alternativo | `consumeNoncePg` + `DATABASE_URL` + migration **022** | **NOT VERIFIED** apply |
| Auth n8n → sidecar | Header `x-sentinela-agent-gateway-internal-token`; `identityAuth.ts` | **PASS** (código) |
| n8n → consume | `agentGatewayValidate.n8n.js` `consumePersistentNonceViaApi`; `agentGatewayHttpNonceStore.ts` | **PASS** (código) |
| Timeouts | Harness HTTP store: `timeoutMs` opcional → `unavailable`; n8n JS: **sem** timeout explícito (depende `$helpers.httpRequest` / fetch) | **PASS WITH CONDITIONS** |
| Indisponibilidade | HTTP ≠ 200/409/401/403/400 → `unavailable` → gateway **503** | **PASS** |
| Fail-closed | Modo nonce inválido / store down / allowlist ausente → **503** | **PASS** (código + Vitest 4B-A) |

### 3.3 Caminho físico SQLite (planeado sidecar)

| Aspecto | Valor planeado (pós-autorização) | Classificação |
|---------|----------------------------------|---------------|
| Path sugerido | Volume dedicado, ex. `/data/agent-nonces.sqlite` no sidecar | **NOT VERIFIED** |
| Persistência | Volume Docker nomeado (novo, **não** `n8n_data` do live) | **NOT VERIFIED** |
| Piloto host `:3099` | **Sem** rota consume — **inadequado** para este smoke | **FAIL** como sidecar actual |

**Secrets:** valores **não** registados neste relatório; usar vault + paridade registry/token/key_id.

---

## 4. Secção 3 — Compatibilidade de rede

| Requisito | Observação | Classificação |
|-----------|------------|---------------|
| Nome serviço n8n clone | `sentinelaaut-n8n-dp02b3-import` (hostname DNS na rede) | **PASS** |
| Rede | `sentinelaaut-n8n-dp02b3-isolated` | **PASS** |
| Internal | **true** — sem egress Internet; comunicação **entre containers** na rede | **PASS** |
| Porta n8n | **5678** interno; **não** publicado no host | **PASS** |
| n8n live | `0.0.0.0:5678->5678` — **separado** | **PASS** (sem conflito bind clone) |
| `localhost` no clone | Refere-se ao **próprio** container n8n, **não** ao host nem sidecar | **FAIL** se usado como consume URL |
| URL consume correcta (futuro) | `http://<sidecar-service-name>:<port>/api/v1/agent-gateway/nonce/consume` na **mesma** rede | **PASS** (desenho) |
| Sidecar disponível | **Nenhum** container/serviço sidecar listado | **NOT VERIFIED** / **FAIL** |
| `host.docker.internal` desde rede internal | **NOT VERIFIED** — não confiar para smoke; preferir sidecar na rede isolada | **NOT VERIFIED** |

**Serviços a iniciar (fase posterior, autorizada):**

1. **Sidecar consume** (novo container) — rede `sentinelaaut-n8n-dp02b3-isolated`, **sem** publicar porta no host.
2. **`docker start sentinelaaut-n8n-dp02b3-import`** — **apenas** após env consume apontando para sidecar (recreate container se necessário).
3. **Opcional:** container efêmero `curlimages/curl` na mesma rede para probes.

**Proibido:** `docker start` / alterar `sentinelaaut-n8n-local`.

---

## 5. Secção 4 — Plano de testes runtime (comandos para execução posterior)

**Pré-requisitos autorizados:** sidecar a correr; env clone + sidecar configurados (nomes abaixo); tokens em vault; **AUT-2F-001 permanece inactive**; smoke **não** usa webhook 2F na fase 1.

### 5.0 Fase 0 — Sidecar (exemplo; ajustar imagem/comando na autorização)

```powershell
# EXEMPLO — não executar nesta fase A2
# Volume novo para SQLite sidecar (não misturar com n8n_data live)
docker volume create sentinelaaut-agent-nonces-clone-data

# Sidecar: Node com handler consume (vite-node entry autorizado) OU imagem mínima
# Rede: sentinelaaut-n8n-dp02b3-isolated
# Env (nomes): SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH, ALLOWED_KEY_IDS, IDENTITY_REGISTRY
# Escutar: 0.0.0.0:3098 (apenas rede Docker)
```

### 5.1 Inicialização controlada

```powershell
docker start sentinelaaut-n8n-dp02b3-import
docker ps --filter name=dp02b3
docker ps --filter name=agent-nonces   # sidecar — nome a definir na autorização
```

**Critério PASS:** clone **Up**; sidecar **Up**; live **unchanged**.

### 5.2 Health check (sidecar)

```powershell
docker run --rm --network sentinelaaut-n8n-dp02b3-isolated curlimages/curl:latest -sS -o NUL -w "%{http_code}" http://<SIDECAR_HOST>:3098/api/v1/health
```

**Critério:** **200** se health exposto; se não existir health dedicado, usar consume com body inválido → **400/401** (não **000**).

**Alternativa host (só se sidecar publicado em loopback autorizado):** evitar na rede internal — preferir curl na rede Docker.

### 5.3 Consumo nonce novo

```powershell
docker run --rm --network sentinelaaut-n8n-dp02b3-isolated curlimages/curl:latest -sS -X POST `
  http://<SIDECAR_HOST>:3098/api/v1/agent-gateway/nonce/consume `
  -H "Content-Type: application/json" `
  -H "x-sentinela-agent-gateway-internal-token: <REDACTED>" `
  -d "{\"key_id\":\"<KEY_ID>\",\"nonce\":\"smoke-new-nonce-00000001\",\"consumed_ms\":1700000000000}"
```

**Critério:** HTTP **200**, body `success: true`.

### 5.4 Nonce repetido

Repetir **exactamente** o mesmo POST.

**Critério:** HTTP **409**, código `NONCE_REPLAY`.

### 5.5 Concorrência (duas requisições)

```powershell
# PowerShell: Start-Job duplo ou script node autorizado com Promise.all
# Mesmo key_id + nonce, paralelo
```

**Critério:** exactamente **1×** 200, **1×** 409 (ou 409+409 após first wins).

### 5.6 Reinicialização serviço

```powershell
docker restart <SIDECAR_CONTAINER_NAME>
```

**Critério:** sidecar **Up**; health OK.

### 5.7 Persistência após reinício

Repetir POST **mesmo** nonce (ainda dentro TTL).

**Critério:** **409** (nonce ainda consumido no ficheiro SQLite do volume).

### 5.8 Falha de armazenamento

Parar sidecar ou apontar `NONCE_SQLITE_PATH` inválido (env **só** com autorização).

**Critério:** **503** `STORE_UNAVAILABLE` / `STORE_NOT_CONFIGURED`; gateway n8n (se invocado) **503** — **sem** bypass.

### 5.9 Recuperação

Restaurar path SQLite válido; restart sidecar.

**Critério:** novo nonce → **200**; replay antigo → **409**.

### 5.10 n8n → sidecar (sem activar AUT-2F-001)

**Opção A (preferida):** `docker exec sentinelaaut-n8n-dp02b3-import` script Node mínimo que chama `$helpers.httpRequest` ou fetch para `NONCE_CONSUME_URL` — **sem** activar workflow.

**Opção B:** Vitest `createHttpAgentNonceStore` com `fetchImpl` apontando para URL resolvível **de dentro** da rede (container de teste na mesma rede).

**Critério:** paridade status map (`mapNonceConsumeHttpStatus`) com §5.3–5.4.

### 5.11 Logs

```powershell
docker logs sentinelaaut-n8n-dp02b3-import --tail 200 2>&1 | Select-String -NotMatch "secret|token|signature"
docker logs <SIDECAR_CONTAINER_NAME> --tail 200 2>&1 | Select-String -NotMatch "secret|token"
```

**Critério:** sem vazamento de headers sensíveis nos artefactos arquivados.

---

## 6. Secção 5 — Restrições (cumprimento)

| Restrição | Cumprido |
|-----------|----------|
| Não iniciar containers | **Sim** |
| Não inject env / compose / workflows | **Sim** |
| Não activar AUT-2F-001 | **Sim** |
| Sem migrations / Supabase / push / live n8n | **Sim** |

---

## 7. Riscos

| ID | Risco | Severidade |
|----|-------|------------|
| R1 | Sidecar inexistente → smoke bloqueado | **Alta** |
| R2 | Rede **internal** — URL errada (`localhost`) → falso negativo | **Alta** |
| R3 | Recreate clone com env errado → tocar volume | **Média** |
| R4 | Confundir piloto `:3099` com consume API | **Média** |
| R5 | Activar AUT-2F-001 por engano durante smoke | **Crítica** |
| R6 | n8n JS sem timeout → hang vs fail-closed | **Baixa** |

---

## 8. Rollback (fase smoke futura)

1. `docker stop sentinelaaut-n8n-dp02b3-import` (+ sidecar se criado).
2. **Não** remover volume `sentinelaaut-n8n-dp02b3-work-data` sem autorização.
3. Remover sidecar + volume nonce **só** se criados para teste (`docker volume rm sentinelaaut-agent-nonces-clone-data`).
4. Revalidar `sentinelaaut-n8n-local` HTTP 200.
5. Restaurar env clone dummy (`WEBHOOK_URL :59999`, API `127.0.0.1:1`) via recreate **autorizado**.

---

## 9. Matriz PASS / FAIL / NOT VERIFIED (consolidada)

| ID | Requisito | Status |
|----|-----------|--------|
| E1 | Clone identificado e íntegro | **PASS** |
| E2 | Sidecar consume deployado no clone | **FAIL** |
| E3 | Env NONCE_CONSUME configurado no clone | **FAIL** |
| E4 | Endpoint handler alinhado ao router | **PASS** |
| E5 | SQLite path + volume persistência | **NOT VERIFIED** |
| E6 | Auth interna definida (código) | **PASS** |
| E7 | Rede isolada compatível sidecar+n8n | **PASS** |
| E8 | Sem conflito porta 5678 host | **PASS** |
| E9 | Backup D-P0-2B-1 disponível | **PASS** |
| E10 | Plano smoke documentado | **PASS** |
| E11 | AUT-2F-001 inactive (evidência import) | **PASS** / **NOT VERIFIED** runtime |
| E12 | n8n live intocado | **PASS** |

---

## 10. Veredito final

### **`READY WITH CONDITIONS`**

O clone **está pronto estruturalmente** e a rede **suporta** smoke isolado, mas **falta** sidecar API + env `NONCE_CONSUME_URL` / token / SQLite no clone. **Não** iniciar containers até autorização explícita da fase smoke runtime.

---

## 11. Encerramento

**PARAR** — aguardar autorização para:

- criar/iniciar sidecar na rede `sentinelaaut-n8n-dp02b3-isolated`;
- inject env no clone (recreate se necessário);
- executar §5.1–5.11 **sem** activar AUT-2F-001.

---

*Fim — D-P0-2B-4B-A2.*
