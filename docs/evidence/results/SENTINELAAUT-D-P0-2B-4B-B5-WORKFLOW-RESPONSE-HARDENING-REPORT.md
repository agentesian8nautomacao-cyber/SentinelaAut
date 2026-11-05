# SENTINELAAUT — D-P0-2B-4B-B5 — AUT-2F-001 response branch hardening (isolado)

**Data:** 2026-11-05
**Escopo:** clone `sentinelaaut-n8n-dp02b3-import`, rede `sentinelaaut-n8n-dp02b3-isolated`, sidecar nonce, PG A4 descartável.
**Referência B4:** `docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-B4-E2E-INTEGRATION-REPORT.md`
**Proibido cumprido:** n8n live (`sentinelaaut-n8n-local`) **não** importado/alterado; sem commit/push/deploy/migrations prod/Supabase LIVE; volumes A3/A4 **preservados**.

---

## 1. Pré-check (Fase 1)

| Item | Resultado |
|------|-----------|
| SHA Git (working tree, sem commit B5) | `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` |
| Relatório B4 | Presente |
| Matriz | `scripts/n8n-harness/dp04-b4-e2e-matrix.mjs` |
| n8n live | **Up** durante toda a fase |
| Clone / sidecar / PG A4 | Utilizados só no isolado; **parados** ao encerrar B5 (PG A4 pode permanecer Up — volume intacto) |
| Rede isolada | `sentinelaaut-n8n-dp02b3-isolated` |

---

## 2. Backup (Fase 2)

| Artefacto | Caminho |
|-----------|---------|
| Export clone **pré** patch | `backups/d-p0-2b-4b-b5-20261105-b5/AUT-2F-001-clone-pre-b5.json` |
| Export clone **pós** patch | `backups/d-p0-2b-4b-b5-20261105-b5/AUT-2F-001-clone-post-b5.json` |
| JSON patcheado (repo-aligned) | `backups/d-p0-2b-4b-b5-20261105-b5/AUT-2F-001-clone-b5-patched-tmp.json` |
| Matriz E2E (corrida final) | `backups/d-p0-2b-4b-b5-20261105-b5/matrix-b5-run.json` (corrida intermédia); evidência principal na §6 |

| Ficheiro | SHA-256 |
|----------|---------|
| `AUT-2F-001-clone-pre-b5.json` | `7BEE371B653CE2C20E7A17626ED2906BAABA8CC8ADE7852FADCCD5DC0440C498` |
| `AUT-2F-001-clone-post-b5.json` | `B3AA7C56E8236F09ABA40152F7F14109F34A712B9B7FA5CBB8C2F467CBA827FA` |
| `AUT-2F-001-clone-b5-patched-tmp.json` (última iteração) | `ECB981AD7E557AED7C393152C581E74728C0A68B05E655B1E8499A207019D40D` |

**IDs de nós tocados (inalterados em identidade):** `aut-2f-001-webhook`, `aut-2f-001-agent-gateway`, `aut-2f-001-out` (Final Output), **novo** `aut-2f-001-respond-webhook` (Respond Webhook).

---

## 3. Causa raiz

### 3.1 B4 — ramo de rejeição gateway (objectivo principal B5)

No ramo **gateway negado** → `Invalid Input Output` → `Observability` → **Final Output**, o código referenciava `$('Validate + Normalize').item.json` para `intent` / `dispatched_aut`. Esse nó **não executa** quando o Agent Gateway bloqueia, o que provocava excepção n8n e resposta HTTP **500** `Error in workflow` em vez de **401** / envelope `user_safe`.

### 3.2 Descobertas adicionais no clone (necessárias para E2E honesto)

1. **rawBody:** n8n **2.38.7** expõe o corpo do webhook em `binary.data` (base64), não só em `json.rawBody`. Sem leitura via `$('Webhook Trigger').first()`, HMAC válido falhava como **401** `AGENT_AUTH_FAILED`.
2. **Consume persistente:** `$helpers.httpRequest` no script estava **indisponível** no sandbox real; o accessor correcto é **`helpers.httpRequest`** (objecto injectado pelo `getSandboxContext`).
3. **Status HTTP do consume:** com `json: true`, a resposta do helper devolve sobretudo o **body**; sem `returnFullResponse: true`, `statusCode` ficava **0** → mapeamento `unavailable` → **503** `AGENT_GATEWAY_UNAVAILABLE` mesmo com sidecar saudável.

### 3.3 LIST_EVENTS (fora do patch B4/B5 de ramo rejeição)

Com gateway + nonce **OK**, intent allowlist **LIST_EVENTS** dispara workflow filho e falha com **`Missing Sentinela n8n credential env vars`** no clone (credenciais API n8n não configuradas no ambiente B4). Isso ainda produz **500** genérico n8n — **não** é regressão do fix Final Output; é lacuna de **dependências downstream** do piloto isolado (documentada já na B4 §8).

---

## 4. Correção mínima (Fase 4)

| Área | Alteração |
|------|-----------|
| **Final Output** | `safeValidateNormalize()` em try/catch; `http_status` derivado de `result.httpStatus` / `user_safe`; sem referência directa obrigatória a Validate + Normalize |
| **Webhook** | `responseMode: responseNode`, `rawBody: true` preservado |
| **Respond Webhook** | Nó `Respond Webhook` com `responseCode: {{ $json.http_status \|\| 200 }}` e corpo JSON do envelope |
| **Agent Gateway JS** | `extractRawBody` + item do Webhook Trigger; `resolveHttpRequestFn()` (`helpers` + fallback `$helpers`); `consumePersistentNonceViaApi` com `returnFullResponse: true` |

**Ferramentas (working tree, não commitadas):**

- `scripts/n8n-harness/patch-aut-2f-001-webhook-response.mjs` (+ `.test.ts`)
- `scripts/n8n-harness/agentGatewayValidate.n8n.js` (espelhado no workflow via `patch-aut-2f-001-agent-gateway.mjs`)
- `n8n/workflows/AUT-2F-001-INTENT-ROUTER.json` (artefacto repo alinhado; **live não importado**)

**Diff lógico (resumo):**

- Final Output: substituir leituras directas `$('Validate + Normalize')…` por helper defensivo + campos já presentes em `$json` no ramo de erro.
- Conexão: `Final Output` → `Respond Webhook` (em vez de terminar só em lastNode sem código HTTP).
- Gateway: três linhas de compatibilidade runtime n8n (body binário, `helpers.httpRequest`, `returnFullResponse`).

---

## 5. Aplicação no clone

1. Export pré → `node scripts/n8n-harness/patch-aut-2f-001-webhook-response.mjs <export.json>`
2. `docker cp` → `n8n import:workflow` → `n8n publish:workflow --id=aut-2f-001`
3. **`docker restart`** clone (publish avisa que requer restart)
4. Aguardar log `Activated workflow "… AUT-2F-001 …"` antes da matriz (senão **404** webhook)

---

## 6. Matriz E2E HTTP (Fase 5)

Execução: `docker run --rm --network sentinelaaut-n8n-dp02b3-isolated -v … node scripts/n8n-harness/dp04-b4-e2e-matrix.mjs`
Credenciais **sintéticas** `b4-e2e-*` (omitidas aqui).

| Cenário (script) | HTTP | `error_code` / notas | Efeito colateral |
|------------------|------|----------------------|------------------|
| `consume_health` | **200** | — | — |
| `consume_new_nonce` | **200** | `consumed: true` | linha PG |
| `consume_replay` | **409** | `NONCE_REPLAY` | — |
| `webhook_bad_signature` | **401** | `AGENT_AUTH_FAILED` | **Sem 500**; Final Output OK |
| `webhook_stale_timestamp` | **401** | `AGENT_AUTH_FAILED` | idem |
| `webhook_replay_same_nonce` (intent unsupported) | **400** then **401** | 1.º `WORKFLOW_UNSUPPORTED_INTENT`; 2.º `AGENT_AUTH_FAILED` (replay nonce) | Filho **não** exigido no 1.º (rejeição negócio); replay auth OK |
| `webhook_valid_list_events` | **500** | `Error in workflow` (n8n) | Gateway/nonce **atingidos**; falha **downstream** credenciais n8n filho |

**Critério B4 corrigido:** rejeições de autenticação deixam de mascarar **401** como **500**.

**Matriz completa B5 (12 cenários do enunciado):** o script `dp04-b4-e2e-matrix.mjs` cobre subconjunto; PG down/recovery/concorrência/idempotência/tenant continuam validados na B4 (consume API) + suíte A5 Vitest. Cenários extra não reexecutados neste script único — **NOT VERIFIED** como matriz única de 12 linhas.

---

## 7. Regressão (Fase 6)

| Suíte | Resultado |
|-------|-----------|
| Gateway B2/B3 + B5 patch + VM runtime | **177/177 PASS** (`npx vitest run` — 19 ficheiros, incl. `patch-aut-2f-001-webhook-response.test.ts`, `agentGatewayN8nVmRuntime.test.ts` +1 teste) |
| PostgreSQL A5 | **11/11 PASS** (`SENTINELA_PG_NONCE_TEST_URL=postgresql://nonce_test:nonce_test_local_discard@127.0.0.1:55440/nonce_test?sslmode=disable`) |

Sem regressão detectada nos contratos automatizados.

---

## 8. Isolamento e encerramento (Fase 7)

| Verificação | Estado |
|-------------|--------|
| n8n live | **Up**, não usado para tráfego B5 |
| Clone + sidecar B5 | **Stopped** após validação |
| Volumes A3/A4 | **Não removidos** |
| Logs | Sanitizados — sem HMAC/secrets/tokens reais |

---

## 9. Rollback

1. Repor workflow no clone a partir de `AUT-2F-001-clone-pre-b5.json` (SHA `7BEE371B…`).
2. `import:workflow` + `publish:workflow --id=aut-2f-001` + restart clone.
3. Repor ficheiros repo locais a partir do mesmo backup ou `git checkout -- n8n/workflows/AUT-2F-001-INTENT-ROUTER.json` **quando** commit baseline existir (hoje: working tree).

---

## 10. Veredito

**PASS WITH CONDITIONS**

| Critério | Estado |
|----------|--------|
| Ramo rejeição gateway → **401** HTTP real (não 500 por Final Output) | **PASS** |
| Replay nonce após auth OK → **401** | **PASS** (via intent unsupported + segundo POST) |
| HMAC / rawBody / nonce persistente / sidecar | **PASS** (401/400/409/200 conforme caso) |
| **503** store indisponível na **borda webhook** | **NOT VERIFIED** nesta corrida (A5 + B4 consume **PASS**) |
| `webhook_valid_list_events` → resposta de sucesso negócio | **FAIL** (**500** credenciais filho — ambiente clone, não regressão do fix B4) |
| E2E funcional LIST_EVENTS → API | **BLOCKED** (igual B4 §8, até credenciais piloto no clone ou intent stub) |
| Regressão Vitest | **PASS** |

**Conclusão:** o defeito **B4** (referência inválida a Validate + Normalize no ramo de rejeição) está **corrigido** no clone, com respostas HTTP **401**/**400** contratuais e autenticação agent-v1 **íntegra**. A fase seguinte (fora de B5) pode configurar credenciais/tenant do piloto para fechar **LIST_EVENTS** e completar a matriz de 12 cenários num único harness.

**Aguardando autorização** para a próxima fase.
