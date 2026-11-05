# SENTINELAAUT — D-P0-2B-4B-A1 — Auditoria READ-ONLY (Git, timestamp, nonce)

**Data/hora:** 2026-11-05 ~00:25 (UTC-3)
**Tipo:** READ-ONLY — investigação técnica
**Base:** D-P0-2B-4B-A, D-P0-2B-4A, D-P0-2B-4 PREPARATION
**Autorização:** inspeção e diagnóstico apenas — **sem** testes, **sem** mutações, **sem** Docker start

---

## 1. Resumo executivo

Esta auditoria esclarece três pendências do relatório **D-P0-2B-4B-A**:

| Tema | Conclusão principal |
|------|---------------------|
| **Git `BUG (fork bomb)`** | **Ambiental / integração de launcher:** `C:\Program Files\Git\bin\git.exe` (29 696 bytes, igual a `bash.exe`) falha antes de reportar versão. O Git real em `C:\Program Files\Git\mingw64\bin\git.exe` responde **`git version 2.55.0.windows.5`** e consultas read-only funcionam. **Não** é falha do repositório `.git`. |
| **Timestamp ausente** | **REJEITADO EXPLICITAMENTE** no harness (`checkTimestamp` → `reason: 'missing'`) e **REJEITADO INDIRETAMENTE** no n8n JS (`checkTimestamp` → `false`). **Lacuna:** nenhum teste Vitest omite só o header `x-agent-timestamp`. |
| **Nonce** | **Validação de formato** (`NONCE_RE`, 16–128 caracteres `[A-Za-z0-9_.:-]`) **IMPLEMENTADA E EVIDENCIADA** no código; replay **IMPLEMENTADA** via store (memória, SQLite, HTTP/PG no harness; `memory_test` / `persistent` no n8n JS). **Lacuna de teste:** nonce malformado (valor presente, regex falha) e timestamp ausente. |
| **Camada B (webhook n8n)** | Lógica criptográfica **não bloqueada** pelas lacunas de teste. **IMPORTANTE:** no runtime n8n, replay **depende** de `SENTINELA_AGENT_GATEWAY_NONCE_STORE` + envs auxiliares; default **`unavailable` → 503** após checks de assinatura (fail-closed, mas **sem** consumo de nonce). Paridade harness ↔ n8n **NÃO VERIFICADA** em execução. |

### Veredito: **`PASS WITH CONDITIONS`**

Condições: (1) usar executável Git em `mingw64\bin` ou corrigir PATH/wrapper **fora** desta fase; (2) Camada B exige plano explícito de **modo nonce** no clone; (3) testes adicionais recomendados antes de tratar cobertura como fechada — **não** implicam bug de implementação para timestamp ausente / nonce malformado.

**Esta conclusão não autoriza correções, Vitest, Docker start nem Camada B.**

---

## 2. Escopo e autorização

### Realizado

- Leitura de relatórios de referência, `agentGatewayValidate.n8n.js`, `agentGatewayV1.ts`, `api/v1/_lib/auth/timestamp.ts`, testes citados.
- Diagnóstico Git: comandos **individuais**, read-only, via `mingw64\bin\git.exe` após falha do launcher `bin\git.exe`.
- Comparação estática harness ↔ n8n JS.

### Não realizado (proibido ou fora do escopo)

- Vitest, alteração de código, `npm install`, Docker start/stop, webhooks, API LIVE, Supabase, reparo automático do Git.

---

## 3. Confirmação READ-ONLY

- Nenhum ficheiro de implementação ou configuração foi editado nesta fase (excepto **criação** deste relatório).
- Nenhum container foi iniciado ou parado.
- Nenhum teste automatizado foi executado.

---

## 4. Diagnóstico Git

### 4.1 Ocorrência observada

Chamada típica do ambiente Cursor/shell:

```text
& "C:\Program Files\Git\bin\git.exe" --version
→ BUG (fork bomb): C:\Program Files\Git\bin\git.exe
```

`Get-Command git` **não** resolve comando no PowerShell (Git **não** está no `PATH` efectivo; apenas `C:\Program Files\GitHub CLI\` aparece relacionado a GitHub).

### 4.2 Executáveis e instalações

| Caminho | Tamanho | `--version` |
|---------|---------|-------------|
| `C:\Program Files\Git\bin\git.exe` | 29 696 | **Falha** (`BUG (fork bomb)`) |
| `C:\Program Files\Git\bin\bash.exe` | 29 696 | Não invocado (mesmo tamanho → launcher MSYS) |
| `C:\Program Files\Git\mingw64\bin\git.exe` | (binário real) | **OK** — `git version 2.55.0.windows.5` |

**Múltiplas instalações:** apenas evidência de **uma** árvore `C:\Program Files\Git\` com **dois** pontos de entrada (`bin` stub vs `mingw64` real). `where.exe git` no PATH default: **não encontrado**.

### 4.3 Momento da falha

A mensagem aparece **ao iniciar** `bin\git.exe`, **antes** de qualquer operação de repositório (incluso `--version`). Indica **recursão / re-exec** detectada no launcher, não corrupção do `.git` em `D:\SentinelaAut`.

### 4.4 Evidência de recursão

- `bin\git.exe` e `bin\bash.exe` com **tamanho idêntico** (padrão de wrapper MSYS2/Git for Windows que re-invoca o shell).
- Falha consistente em relatórios anteriores (B19, B20, D-P0-2B-4B-A) no **mesmo** caminho `bin\git.exe`.
- **Hipótese técnica (evidenciada, não reparada):** integração Cursor/sandbox + launcher `bin\` dispara protecção “fork bomb”; **`mingw64\bin\git.exe` contorna o launcher**.

**Classificação:** problema **ambiental / PATH / wrapper**, **não** indeterminado quanto à existência de Git funcional no host.

### 4.5 Metadados do repositório (read-only via `mingw64\bin\git.exe`)

| Campo | Valor |
|-------|--------|
| Branch | `main` |
| HEAD | `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` |
| Commit mais recente | `fix(api): restore v1 vercel routing` — 2026-11-04 11:05:34 -0300 |
| Working tree (resumo) | **601** entradas em `status --short`: **94** modificados (` M`), **507** não rastreados (`??`) |

**Corroboração sem Git:** `.git/HEAD` → `ref: refs/heads/main`; `.git/refs/heads/main` → `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` (consistente).

**Ficheiros do gateway/harness (estado Git):**

| Ficheiro | Estado |
|----------|--------|
| `scripts/n8n-harness/agentGatewayValidate.n8n.js` | `??` (não rastreado) |
| `scripts/n8n-harness/agentGatewayV1.ts` | `??` |
| `scripts/n8n-harness/d-p0-1-agent-gateway-matrix.test.ts` | `??` |
| `scripts/n8n-harness/agentGatewayV1.test.ts` | `??` |
| `docs/evidence/results/SENTINELAAUT-D-P0-2B-4B-A-NEGATIVE-HARNESS-REPORT.md` | `??` |

**NOT VERIFIED via `bin\git.exe`:** branch, HEAD e status pelo caminho default do Cursor — falha sistemática.

---

## 5. Análise de timestamp

### 5.1 Implementações

| Camada | Ficheiro | Função | Campo HTTP |
|--------|----------|--------|------------|
| Harness / Vitest | `api/v1/_lib/auth/timestamp.ts` | `checkTimestamp()` | Consumido via `agentGatewayV1.ts` → header `x-agent-timestamp` (`AGENT_HEADER_TIMESTAMP`) |
| n8n Code node | `scripts/n8n-harness/agentGatewayValidate.n8n.js` | `checkTimestamp()` (inline L84–94) | `x-agent-timestamp` (`HDR_TS`) |

**Unidade:** Unix **segundos** (string numérica). Valores com **≥ 13 dígitos** tratados como milissegundos prováveis → rejeição.

**Tolerância (janela simétrica):**

| Runtime | Variável de ambiente | Default | Limites clamp |
|---------|---------------------|---------|---------------|
| Harness | `SENTINELA_API_TIMESTAMP_WINDOW_SECONDS` | **300** s | 30–3600 (`getTimestampWindowSeconds`) |
| n8n JS | `SENTINELA_AGENT_GATEWAY_TIMESTAMP_WINDOW_SECONDS` | **300** s | 30–3600 (L244–246) |

**Ordem no fluxo (ambos):** após `key_id`, `nonce` e `signature`; **antes** de verificar segredo/HMAC e consumir nonce.

### 5.2 Comportamentos (fluxo real)

Extração: `headerLookup` devolve `''` se header ausente ou valor só whitespace.

#### Harness — `checkTimestamp` (`timestamp.ts` L22–41)

| Entrada | Resultado |
|---------|-----------|
| Ausente / `null` / `undefined` | `{ ok: false, reason: 'missing' }` |
| String vazia / só espaços | `{ ok: false, reason: 'missing' }` |
| Não só dígitos (`/^\d+$/` falha) | `{ ok: false, reason: 'invalid' }` |
| Número ≤ 0 ou não finito | `{ ok: false, reason: 'invalid' }` |
| Comprimento ≥ 13 | `{ ok: false, reason: 'invalid' }` |
| `skew < -windowSeconds` | `{ ok: false, reason: 'expired' }` |
| `skew > windowSeconds` | `{ ok: false, reason: 'future' }` |
| Dentro da janela | `{ ok: true, skewSeconds }` |

`validateAgentGatewayRequest` (L285–286): se `tsCheck.ok === false` → `authFail('AGENT_TIMESTAMP_INVALID')`.

#### n8n JS — `checkTimestamp` (L84–94)

| Entrada | Resultado |
|---------|-----------|
| Ausente / vazio / não-dígitos / ms / fora da janela | **`false`** → `fail(401, 'AGENT_AUTH_FAILED')` (L262) |
| Válido | **`true`** |

### 5.3 Resposta obrigatória

**Um timestamp ausente é rejeitado pelo código actual ou pode passar?**

**Rejeitado.** Não passa a validação HMAC nem ao consumo de nonce.

**Classificação:** **REJEITADO EXPLICITAMENTE** (harness, `reason: 'missing'`) e **REJEITADO INDIRETAMENTE** (n8n JS, boolean `false` sem distinção de motivo no código público).

Evidência harness:

```27:28:api/v1/_lib/auth/timestamp.ts
  const raw = (timestampHeader || '').trim();
  if (!raw) return { ok: false, reason: 'missing' };
```

```285:286:scripts/n8n-harness/agentGatewayV1.ts
  const tsCheck = checkTimestamp(timestamp, nowMs, windowSeconds);
  if (tsCheck.ok === false) return authFail('AGENT_TIMESTAMP_INVALID');
```

Evidência n8n:

```84:86:scripts/n8n-harness/agentGatewayValidate.n8n.js
function checkTimestamp(tsRaw, nowMs, windowSec) {
  const raw = String(tsRaw || '').trim();
  if (!raw || !/^\d+$/.test(raw)) return false;
```

```262:262:scripts/n8n-harness/agentGatewayValidate.n8n.js
  if (!checkTimestamp(timestamp, Date.now(), windowSec)) return fail(401, 'AGENT_AUTH_FAILED');
```

---

## 6. Análise de nonce

### 6.1 Formato e presença

| Propriedade | Harness (`agentGatewayV1.ts`) | n8n JS |
|-------------|------------------------------|--------|
| Header | `x-agent-nonce` | `x-agent-nonce` |
| Regex | `NONCE_RE = /^[A-Za-z0-9_.:-]{16,128}$/` (L114) | Idem (L187) |
| Ausente / vazio | `authFail('AGENT_NONCE_INVALID')` (L282) | `fail(401, 'AGENT_AUTH_FAILED')` (L260) |
| Ordem vs timestamp | **Nonce validado antes** do timestamp (L281–285) | Idem (L259–262) |

### 6.2 Respostas às perguntas (implementação estática)

| # | Pergunta | Resposta | Classificação |
|---|----------|----------|---------------|
| 1 | Validado só por presença? | **Não** — presença **e** regex | **IMPLEMENTADA E EVIDENCIADA** |
| 2 | Validação de formato? | **Sim** — `NONCE_RE` | **IMPLEMENTADA E EVIDENCIADA** |
| 3 | Limite de tamanho? | **Sim** — 16–128 chars | **IMPLEMENTADA E EVIDENCIADA** |
| 4 | Proteção replay? | **Sim** — após HMAC, `nonceStore.consume` / static data / API | **IMPLEMENTADA E EVIDENCIADA** (harness); n8n **IMPLEMENTADA, MAS NÃO COMPROVADA** em runtime |
| 5 | Persistente ou memória? | **Depende do modo** | Ver §6.3 |
| 6 | Entre execuções diferentes? | Memória de processo / `memory_test` global n8n: **limitada**; SQLite/PG/HTTP: **desenhado persistente** | **IMPLEMENTADA** no código persistente; **NÃO VERIFICADA** no clone n8n |
| 7 | Depende do runtime n8n? | **Sim** para modo de store e env gates (`resolveNonceMode`, produção bloqueia `memory_test`) | **IMPLEMENTADA E EVIDENCIADA** (JS n8n) |

### 6.3 Mecanismos de store

**Harness (`validateAgentGatewayRequest`):**

- Store injectado (`createMemoryAgentNonceStore`, SQLite, HTTP, etc.).
- `createMemoryAgentNonceStore`: `Set` in-process; chave `keyId:nonce`; 2ª chamada → `'replay'` → `AGENT_NONCE_REPLAY` (L316–317).
- `requirePersistentNonce !== false` (default): se store devolve `'unavailable'` → **503** `AGENT_NONCE_STORE_UNAVAILABLE` (L327–329).

**n8n JS (após JSON parse):**

- `resolveNonceMode` — default **`unavailable`** → **503** `AGENT_GATEWAY_UNAVAILABLE` **antes** de aceitar pedido (L297–298).
- `memory_test`: exige `ALLOW_MEMORY_TEST=1`, `TEST_ENV=1`, harness runtime permitido; replay via `$getWorkflowStaticData('global')._agentNonces` (L301–307).
- `persistent`: HTTP POST para `SENTINELA_AGENT_GATEWAY_NONCE_CONSUME_URL` + token; `'replay'` → 401 (L309–328).

**Retenção (persistente API/SQLite):** `nonceRetentionMs(window) = (window*2 + 60) * 1000` em `nonceConsumeCore.ts` — alinhada à janela de timestamp.

**Falha de armazenamento:** harness → 503 fail-closed; n8n → 503 nos ramos `unavailable` / consume não-ok.

---

## 7. Reconciliação implementação / testes

Legenda lacuna: **T** = teste ausente; **I** = implementação ausente; **—** = sem lacuna relevante.

| Controle | Implementação | Teste existente | Lacuna |
|----------|---------------|-----------------|--------|
| HMAC ausente | `AGENT_SIGNATURE_MISSING` (V1 L283); n8n `!signature` (L261) | Matriz `03 — assinatura ausente` | **T** — matriz não asserta `internal_code` |
| HMAC inválida | `AGENT_SIGNATURE_INVALID` | Matriz `02`; V1 `2. assinatura inválida` | **—** |
| Timestamp ausente | `checkTimestamp` → missing / false | **Nenhum** (`delete` só em `SIGNATURE` / `NONCE`) | **T** apenas (implementação **existe**) |
| Timestamp inválido (não numérico / ms) | `invalid` / false | **Nenhum dedicado** | **T** |
| Timestamp expirado | `expired` / skew negativo | Matriz `04`; V1 `7` | **—** |
| Timestamp futuro | `future` / skew positivo | Matriz `05`; V1 `8` | **—** |
| Nonce ausente | `AGENT_NONCE_INVALID` | V1 `9` (remove header) | **—** |
| Nonce vazio | Mesmo ramo `!nonce` | **Nenhum dedicado** | **T** |
| Nonce malformado | `NONCE_RE` falha | Título do teste 9 sugere, mas **só** remove header | **T** |
| Nonce repetido | `AGENT_NONCE_REPLAY` | Matriz `06`; V1 `nonce repetido` | **—** (inclui 1× OK de setup) |
| Replay (concorrência) | SQLite `consume` atómico | Matriz `07` | **—** (harness; não prova n8n) |

**Nota D-P0-2B-4B-A:** a matriz NEG-03 foi classificada como “NÃO IMPLEMENTADO” **no sentido de teste**, não de código — esta auditoria **corrige** essa leitura para **timestamp ausente: implementado, teste ausente**.

---

## 8. Impacto na futura Camada B (webhook n8n)

| Lacuna / tema | Classificação | Justificação |
|---------------|---------------|--------------|
| Timestamp ausente sem teste Vitest | **INFORMATIVA** | Código n8n e harness rejeitam; risco é **documentação/cobertura**, não bypass conhecido |
| Timestamp inválido (formato) sem teste | **INFORMATIVA** | Mesma lógica `checkTimestamp` |
| Nonce malformado sem teste | **INFORMATIVA** | Regex já aplicada antes do HMAC |
| Proteção replay no **webhook** | **IMPORTANTE** | Sem `NONCE_STORE` válido, gateway n8n **recusa com 503** após cripto — negativos de replay **exigem** env planeado (`memory_test` isolado ou `persistent` + URL/token) |
| Persistência entre reinícios / multi-instância | **IMPORTANTE** | `memory_test` usa static data **por instância n8n**; paridade com SQLite/API **NÃO VERIFICADA** em runtime |
| Divergência harness ↔ n8n (códigos públicos, env window) | **IMPORTANTE** | Harness: `AGENT_TIMESTAMP_INVALID` vs n8n: `AGENT_AUTH_FAILED`; env **`SENTINELA_API_*` vs `SENTINELA_AGENT_GATEWAY_*`** |
| Git indisponível via `bin\git.exe` | **INFORMATIVA** para Camada B; **IMPORTANTE** para governança de evidências | Não bloqueia webhook; bloqueia trilha de auditoria no shell default |
| Ficheiros gateway **não rastreados** no Git | **IMPORTANTE** | HEAD commitado **não** inclui necessariamente o JS/TS actual do harness — rastreabilidade release vs disco |

**Nenhuma lacuna acima foi classificada como BLOQUEANTE** para *iniciar planeamento* da Camada B, desde que o plano exija configuração nonce + testes runtime negativos **não** substituídos por ausência de teste Vitest.

---

## 9. Riscos e pendências

1. **Launcher Git `bin\`:** relatórios futuros podem repetir “NOT VERIFIED” se só se usar `bin\git.exe`.
2. **Nonce store no clone:** estado real de env no container **NÃO VERIFICADO** nesta fase (sem `docker start`).
3. **Paridade n8n:** ficheiro `agentGatewayValidate.n8n.js` no disco ≠ garantia de bytes no SQLite do workflow importado — reconciliação estrutural já feita em D-P0-2B-3-A; **execução** continua **NOT VERIFIED**.
4. **Replay “sucesso” embutido** nos testes 06/replay — aceitável para prova de replay, mas distinto de “só negativos”.

---

## 10. Recomendação técnica

| Pergunta | Decisão |
|----------|---------|
| O código actual rejeita timestamp ausente? | **Sim** (harness e n8n JS) — **REJEITADO EXPLICITAMENTE / INDIRETAMENTE** |
| Nonce possui validação de formato? | **Sim** — regex 16–128 |
| Proteção replay adequada **na implementação**? | **Sim**, com store configurado; **fail-closed** se store indisponível (503). **Adequação operacional** no n8n: **NÃO COMPROVADA** |
| Lacunas que precisam **correção** de código? | **Nenhuma** identificada por leitura estática para timestamp ausente ou nonce malformado |
| Lacunas que precisam **só testes**? | Timestamp ausente; timestamp inválido (não numérico/ms); nonce vazio; nonce malformado; asserts de `internal_code` na matriz 03 |
| Problema Git | **Ambiental** (launcher `bin\git.exe`); Git **2.55.0.windows.5** funcional em `mingw64\bin` |
| Camada B pode prosseguir **sem correções** de código? | **Condicionalmente sim** — com plano de **env nonce**, negativos runtime, e **sem** assumir paridade só pelo harness |
| Condições antes de runtime | (1) Definir `NONCE_STORE` + credenciais consume; (2) negativos webhook no clone isolado; (3) opcionalmente normalizar PATH Git para evidências; (4) testes Vitest adicionais **autorizados** numa fase separada |

---

## 11. Itens NÃO VERIFICADOS

- Execução do nó Code n8n com headers reais (Camada B).
- Variáveis de ambiente efectivas no container `sentinelaaut-n8n-dp02b3-import` (parado).
- Comportamento do launcher `bin\git.exe` **dentro** da UI Git do Cursor (não instrumentado).
- Equivalência byte-a-byte entre `agentGatewayValidate.n8n.js` no repo e `jsCode` no SQLite do clone (auditoria anterior foi estrutural/nós).
- Lista completa dos **507** ficheiros não rastreados (apenas contagem).

---

## 12. Veredito

**`PASS WITH CONDITIONS`**

A auditoria READ-ONLY **fecha** a ambiguidade do relatório 4B-A: timestamp ausente **não** é lacuna de implementação; nonce **tem** formato e replay no código; Git **é** consultável por caminho alternativo; Camada B depende sobretudo de **configuração nonce + prova runtime**, não de alteração imediata da lógica timestamp/nonce.

**Não autoriza:** correções, novos testes, Docker, webhooks ou D-P0-2B-4B-B.

---

*Fim do relatório D-P0-2B-4B-A1.*
