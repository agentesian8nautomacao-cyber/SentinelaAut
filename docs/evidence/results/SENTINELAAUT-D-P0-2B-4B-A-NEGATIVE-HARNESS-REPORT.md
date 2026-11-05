# SENTINELAAUT — D-P0-2B-4B-A — Execução controlada dos testes negativos do harness

**Data/hora:** 2026-11-05 ~00:08 (UTC-3)
**Tipo:** EXECUÇÃO CONTROLADA — testes locais Vitest (sem n8n, sem Docker start, sem API LIVE)
**Autorização:** expressa pelo responsável (escopo D-P0-2B-4B-A)

---

## 1. Resumo executivo

Foram executados **somente** casos negativos existentes no harness **agent-v1** (`validateAgentGatewayRequest` / matriz D-P0-1), via **Vitest 2.1.9**, com segredos e nonces **sintéticos**. **11 testes** passaram; **0 falhas**. Nenhum pacote foi instalado; SHA-256 dos artefatos relevantes **inalterado** após a execução.

| Item | Resultado |
|------|-----------|
| Matriz D-P0-1 (cenários 02–07) | **6/6 PASS** |
| `agentGatewayV1.test.ts` (negativos selecionados) | **5/5 PASS** |
| Matriz NEG-01…NEG-08 | **6 executados**, **2 parciais**, **0 falhas** |
| Git (branch/commit/status) | **NOT VERIFIED** — `git.exe` retorna `BUG (fork bomb)` neste ambiente |
| Docker/n8n clone | **Não iniciado** nesta sessão; clone `dp02b3-import` permanece **Exited (137)** |
| Paridade runtime n8n | **Não afirmada** — apenas harness TypeScript espelhando lógica do gateway |

### Veredito: **`PASS WITH CONDITIONS`**

**Condições:** (1) metadados Git indisponíveis; (2) NEG-03 *timestamp ausente* e NEG-06 *nonce malformado* sem teste dedicado no harness (cobertura parcial documentada); (3) testes de replay (06 / `nonce repetido`) incluem **uma** validação bem-sucedida prévia **inherentes** ao cenário, não executados como happy-path autônomo.

**Não iniciado:** D-P0-2B-4B-B, ativação de gateway, webhooks, clone n8n.

---

## 2. Autorização e escopo

### Autorizado

- Vitest local (`npx vitest run`).
- `scripts/n8n-harness/agentGatewayValidate.n8n.js` (integridade via hash; **não** executado como runtime n8n).
- Testes de HMAC, timestamp, nonce e replay em:
  - `scripts/n8n-harness/d-p0-1-agent-gateway-matrix.test.ts` (cenários 02–07).
  - `scripts/n8n-harness/agentGatewayV1.test.ts` (subset negativo).

### Excluído (não executado)

- n8n, containers (`docker start`), workflows, webhooks, API LIVE, Supabase, WhatsApp/Meta.
- Happy-path (matriz **01**, V1 testes **1**, **15**, etc.).
- Matriz **08+** (idempotência, tenant, payload malformado, etc.).
- `agentGatewayValidate.n8n.test.ts` (paridade estrutural / fail-closed de *nonce env*, não mapeados à matriz NEG-01–08).
- `npm install` / alteração de código ou lockfile.

---

## 3. Pré-check

| # | Verificação | Resultado |
|---|-------------|-----------|
| 1 | Diretório raiz | `D:\SentinelaAut` confirmado |
| 2 | Branch / commit | **NOT VERIFIED** — Git indisponível (`BUG (fork bomb): C:\Program Files\Git\bin\git.exe`) |
| 3 | `git status --short` | **NOT VERIFIED** (mesmo bloqueio) |
| 4 | Harness / testes | Caminhos reais listados na §4 |
| 5 | Comando Vitest | `package.json`: `"test:run": "vitest run"`; config raiz `vitest.config.ts` inclui `scripts/**/*.test.ts` |
| 6 | Código presente | Arquivos lidos e hashes calculados |
| 7 | Dependência Docker/n8n | **Não** — testes chamam `validateAgentGatewayRequest` in-process |
| 8 | Inspeção HTTP/externos | `agentGatewayV1.test.ts` e matriz **02–07**: sem `fetch`/URL LIVE; matriz **07** usa SQLite temporário em `tmpdir` (sintético) |

**Interrupções por dependência externa:** nenhuma.

---

## 4. Arquivos e testes selecionados

| Arquivo | Papel |
|---------|--------|
| `scripts/n8n-harness/agentGatewayValidate.n8n.js` | Fonte n8n (integridade; lógica espelhada em TS) |
| `scripts/n8n-harness/agentGatewayV1.ts` | Implementação harness de validação |
| `scripts/n8n-harness/d-p0-1-agent-gateway-matrix.test.ts` | Matriz D-P0-1 cenários 02–07 |
| `scripts/n8n-harness/agentGatewayV1.test.ts` | Negativos adicionais (assinatura, timestamp, nonce, replay) |

**Segredos de teste (não produção):** `dp01-local-test-secret-not-production`, `b16-local-test-secret-not-production`; `NOW_MS = 1_700_000_000_000` fixo.

---

## 5. Comandos executados

Diretório de trabalho: `D:\SentinelaAut`.

```text
npx vitest run scripts/n8n-harness/d-p0-1-agent-gateway-matrix.test.ts -t "02 —|03 —|04 —|05 —|06 —|07 —" --reporter=verbose

npx vitest run scripts/n8n-harness/agentGatewayV1.test.ts -t "2\. assinatura inválida|7\. timestamp expirado|8\. timestamp futuro|9\. nonce|nonce repetido" --reporter=verbose
```

**Saída agregada:**

- Matriz: **6 passed**, 9 skipped, duração ~4,6 s.
- V1: **5 passed**, 21 skipped, duração ~3,5 s.

---

## 6. Matriz NEG-01 a NEG-08

| ID | Cenário | Mapeamento harness | Execução | Esperado | Observado |
|----|---------|-------------------|----------|----------|-----------|
| **NEG-01** | HMAC ausente | Matriz `03 — assinatura ausente` | **EXECUTADO** | Rejeição | `res.ok === false` (PASS) |
| **NEG-02** | HMAC inválida | Matriz `02`; V1 `2. assinatura inválida` | **EXECUTADO** | Rejeição | `AGENT_SIGNATURE_INVALID`, `AGENT_PUBLIC_AUTH_FAILED` (V1) (PASS) |
| **NEG-03** | Timestamp ausente ou inválido | Matriz `04`, `05`; V1 `7`, `8` cobrem **expirado/futuro** | **PARCIAL** | Rejeição | Inválido fora da janela: PASS. **Timestamp header ausente:** **NÃO IMPLEMENTADO** como teste dedicado |
| **NEG-04** | Timestamp expirado | Matriz `04`; V1 `7. timestamp expirado` | **EXECUTADO** | Rejeição | `AGENT_TIMESTAMP_INVALID` (V1) (PASS) |
| **NEG-05** | Nonce ausente | V1 `9. nonce ausente ou malformado` (header removido) | **EXECUTADO** | Rejeição | `res.ok === false` (PASS) |
| **NEG-06** | Nonce inválido | Título do teste 9 menciona malformado; implementação só **remove** header | **PARCIAL** | Rejeição | Ausente: PASS. **String malformada (NONCE_RE):** **NÃO IMPLEMENTADO** como assert separado |
| **NEG-07** | Nonce reutilizado | Matriz `06`; V1 `nonce repetido (replay)` | **EXECUTADO** | Rejeição | 2ª chamada: `AGENT_NONCE_REPLAY` (V1) (PASS) |
| **NEG-08** | Replay de requisição | Matriz `06`, `07` (concorrência SQLite); V1 replay | **EXECUTADO** | Rejeição | Matriz 07: 1× `ok`, 15× `replay` no store (PASS) |

---

## 7. Resultados individuais

### D-P0-1 — matriz (02–07)

| Nome do teste | Arquivo | Resultado | Evidência de rejeição |
|---------------|---------|-----------|------------------------|
| `02 — assinatura inválida` | `d-p0-1-agent-gateway-matrix.test.ts` | PASS | `res.ok === false`; `public_code === AGENT_PUBLIC_AUTH_FAILED` |
| `03 — assinatura ausente` | idem | PASS | `res.ok === false` |
| `04 — timestamp expirado` | idem | PASS | `res.ok === false` |
| `05 — timestamp futuro fora da janela` | idem | PASS | `res.ok === false` |
| `06 — nonce reutilizado` | idem | PASS | 1ª OK (setup replay); 2ª `res.ok === false` |
| `07 — requisições concorrentes com mesmo nonce (store persistente)` | idem | PASS | 1 consumo `ok`, 15 `replay` |

### agentGatewayV1 (subset)

| Nome do teste | Arquivo | Resultado | Evidência de rejeição |
|---------------|---------|-----------|------------------------|
| `2. assinatura inválida` | `agentGatewayV1.test.ts` | PASS | `AGENT_SIGNATURE_INVALID`, `AGENT_PUBLIC_AUTH_FAILED` |
| `7. timestamp expirado` | idem | PASS | `AGENT_TIMESTAMP_INVALID` |
| `8. timestamp futuro fora da tolerância` | idem | PASS | `res.ok === false` |
| `9. nonce ausente ou malformado` | idem | PASS | `res.ok === false` (nonce header ausente) |
| `nonce repetido (replay)` | idem | PASS | 2ª: `AGENT_NONCE_REPLAY` |

**Códigos internos relevantes (implementação `agentGatewayV1.ts`, leitura estática):** `AGENT_SIGNATURE_MISSING`, `AGENT_SIGNATURE_INVALID`, `AGENT_TIMESTAMP_INVALID`, `AGENT_NONCE_INVALID`, `AGENT_NONCE_REPLAY`.

---

## 8. Testes não implementados (matriz obrigatória)

| ID | Lacuna |
|----|--------|
| NEG-03 | Cenário **timestamp header ausente** (sem valor / header omitido) — nenhum `it(...)` dedicado encontrado no harness |
| NEG-06 | Cenário **nonce malformado** (valor presente mas fora de `NONCE_RE`) — não assertado explicitamente; apenas nonce ausente no teste 9 |

---

## 9. Evidências de isolamento

| Regra | Evidência |
|-------|-----------|
| Sem segredos de produção | Constantes `*-local-test-secret-not-production` nos testes |
| Sem API LIVE / Supabase / URLs externas | Nenhum `fetch` nos arquivos executados; matriz 07 só SQLite local temporário |
| Sem n8n / webhook | Apenas funções TS in-process |
| Sem `npm install` | Nenhum comando de instalação executado |
| Docker | **Nenhum** `docker start` nesta sessão; `sentinelaaut-n8n-dp02b3-import` **Exited (137)**; `sentinelaaut-n8n-local` já **Up** (pré-existente, não alterado por esta fase) |
| aut-004 / aut-008 / aut-2f-001 runtime | **Não executados** |

---

## 10. Comparação SHA-256 antes / depois

| Arquivo | SHA-256 antes | SHA-256 depois | Match |
|---------|---------------|----------------|-------|
| `agentGatewayValidate.n8n.js` | `c2a60e5af6805c4b0935ffd758e27a6ce51e9c1dc4b72cdec606e26dd376c218` | idem | **SIM** |
| `d-p0-1-agent-gateway-matrix.test.ts` | `9bed1dedb5b2e69eff7355d079f2ace0eb48f209ef29fc0070569cf347856288` | idem | **SIM** |
| `agentGatewayV1.test.ts` | `099a0698e0995c14571fa7306a8aeddfc3b5344d37c37f67fd2bc3faac6b01fe` | idem | **SIM** |

*(Hash pré-run também registrado para `agentGatewayValidate.n8n.test.ts`: `5a0ad9715a60cebd9a4c23dbcd8a4a74d500bcf55882a0f1f52a3697bca5c9b7` — arquivo **não** executado nesta fase.)*

---

## 11. Estado Git antes / depois

| Campo | Antes | Depois |
|-------|-------|--------|
| Branch | NOT VERIFIED | NOT VERIFIED |
| Commit | NOT VERIFIED | NOT VERIFIED |
| `git status --short` | NOT VERIFIED | NOT VERIFIED |

**Nota:** integridade de implementação corroborada por hashes SHA-256 inalterados; este relatório **adiciona** apenas o ficheiro markdown de evidência.

---

## 12. Ocorrências e interrupções

| Ocorrência | Ação |
|------------|------|
| Git `fork bomb` | Registrado; execução de testes **continuou** (escopo permitia hashes + Vitest) |
| Testes de replay com setup válido | **Não interrompido** — comportamento exigido pelo cenário; happy-path isolado **não** contado como teste autorizado |
| Falha de teste | **Nenhuma** |

---

## 13. Veredito final

**`PASS WITH CONDITIONS`**

- **PASS:** todos os testes negativos **selecionados e existentes** para HMAC inválida/ausente, timestamp expirado/futuro, nonce ausente, replay (memória e concorrência SQLite) **passaram** localmente; rejeições comprovadas via `res.ok === false` e códigos internos onde assertados.
- **Condições:** Git não verificado; lacunas NEG-03 (timestamp ausente) e NEG-06 (nonce malformado); sem prova de paridade com o nó Code n8n em runtime.

**Aguardando nova autorização explícita** antes de D-P0-2B-4B-B ou qualquer validação webhook/runtime.

---

*Fim do relatório D-P0-2B-4B-A.*
