# SENTINELAAUT — D-P0-2B-4B-A4 — PostgreSQL nonce (ambiente descartável)

**Data/hora:** 2026-11-05 ~09:52 (UTC-3)
**Escopo:** validar `consumeNoncePg` + handler com `DATABASE_URL` em PostgreSQL 16 **isolado** (Docker loopback).
**Sem:** Supabase produção, migrations 022–023 no Supabase, n8n live alterado, AUT-2F-001, gateway produção, credenciais reais, push/deploy.

---

## 1. Resumo executivo

| Item | Resultado |
|------|-----------|
| Pré-check clone / backup / live | **PASS** |
| PG descartável + migration **022** apenas | **PASS** |
| Vitest integração PG (`8/8`) | **PASS** |
| Persistência após `docker restart` (volume) | **PASS** (evidência `psql`) |
| Concorrência (12× paralelo) | **PASS** (1× ok, 11× replay) |
| Expiração / prune | **PASS** (teste 5) |
| Fail-closed sem `DATABASE_URL` | **PASS** (`withPgTransaction` → `ok: false`) |
| Falha de conexão PG parado | **DIVERGÊNCIA** (`p.connect()` **lança**; handler PG não mapeia para `503 unavailable` como erros SQL internos) |
| Comparação paridade A3 (SQLite sidecar) | **Alinhado** em ok/replay/concorrência/expiração; **diferente** em camada HTTP/rede quando PG indisponível |
| n8n live | **Inalterado** (`sentinelaaut-n8n-local` Up, imagem `n8nio/n8n:latest`) |

### Veredito: **`PASS WITH CONDITIONS`**

**Condições:** endurecer fail-closed em `withPgTransaction`/`nonce-consume` para falhas de conexão (opcional, fora do escopo A4); sidecar HTTP PG não exercitado em runtime (só handler via Vitest); migration **023** não aplicada no descartável (não necessária ao nonce); container PG **parado** ao encerrar; credenciais **100% sintéticas**.

---

## 2. SHA / integridade

| Referência | Valor |
|------------|--------|
| Git `HEAD` (início e fim A4) | `f0d76ccbe6ebe1e6925a34b91e50fc6c0491fd68` |
| Artefato D-P0-1 (preservado) | `1db6bac72ec08fac8f5fd1cafc92c3230aed3278bdfd271e67bde65c69678f96` |
| Gateway JS (preservado) | `c2a60e5af6805c4b0935ffd758e27a6ce51e9c1dc4b72cdec606e26dd376c218` |
| Backup D-P0-2B-1 | `D:\SentinelaAut-Preservation\n8n-quiesced\D-P0-2B-1-20261104-230847` (**presente**) |

### Artefactos A4 (SHA-256)

| Ficheiro | SHA-256 |
|----------|---------|
| `docker/dp02b3-isolated/compose-postgres-nonce-test.yml` | `f2c2239d996e77af13d9d23b032f2bd213a0cac9083498cc28c6dc2879c7bc08` |
| `scripts/n8n-harness/agentGatewayPgNonce.integration.test.ts` | `fa0cf0daa388e199ba8edc84eda0753a956c6024a76fa60d25b96c6f65871114` |
| `supabase/migrations/20261103180000_022_agent_gateway_nonces.sql` | `a19281a1d267daf27d1f2b864ec69ce425742c7351bf76b30879f6eb979a53a9` |

**Relatório A3 consultado:** `SENTINELAAUT-D-P0-2B-4B-A3-NONCE-SIDECAR-RUNTIME-REPORT.md` (baseline SQLite runtime).

---

## 3. Fase 1 — Pré-check

| Verificação | Evidência |
|-------------|-----------|
| n8n live separado | `sentinelaaut-n8n-local` Up; clone `dp02b3-import` permanece parado (A3) |
| AUT-2F-001 / gateway prod | Não activados nesta fase |
| Migration **022** | Tabela `agent_gateway_nonces`, PK `(key_id, nonce)`, índice `expires_at`, **sem RLS** no SQL |
| Migration **023** | Inspeccionada no repo (`agent_gateway_identities`, FKs, CHECK em `key_id`); **não** aplicada no banco A4 |
| Contrato adapter PG | `consumeNoncePg` em `api/v1/_lib/agentGateway/nonceConsumeCore.ts`: validação regex → `DELETE` prune por `expires_at` → `INSERT … ON CONFLICT DO NOTHING` → `ok` \| `replay` \| `unavailable` |
| Pool / transacção | `withPgTransaction` em `api/_lib/db/pgPool.ts`; handler escolhe PG quando `DATABASE_URL` e **sem** `SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH` |

### Dependências SQL (022)

- **Objetos:** `public.agent_gateway_nonces`, índice `idx_agent_gateway_nonces_expires`.
- **Externas:** nenhuma (sem FK, sem extensões Supabase).
- **RLS / grants:** não definidos na migration; owner `nonce_test` no container descartável.

---

## 4. Fase 2 — Banco descartável

| Controlo | Decisão |
|----------|---------|
| Isolamento | `postgres:16-alpine`, container `sentinelaaut-pg-nonce-test-a4`, bind **`127.0.0.1:55440`** (55432/55433 já ocupados no host) |
| Credenciais | `nonce_test` / `nonce_test_local_discard` — **descartáveis** |
| Dados reais | **Nenhum** |
| Migration aplicada | **Só 022** via `psql` no container |
| Rollback | `docker compose -f docker/dp02b3-isolated/compose-postgres-nonce-test.yml down -v` (remove volume `sentinelaaut-pg-nonce-test-a4-data`) |

**Estado ao encerrar:** container **Stopped**; volume preservado até operador executar rollback.

---

## 5. Fase 3 — Integração (testes)

**Comando:**

```text
SENTINELA_PG_NONCE_TEST_URL=postgresql://nonce_test:nonce_test_local_discard@127.0.0.1:55440/nonce_test
npx vitest run scripts/n8n-harness/agentGatewayPgNonce.integration.test.ts
```

**Resultado:** `8 passed (8)` (~1,2s testes, run total ~5s).

| # | Cenário | Resultado PG |
|---|---------|--------------|
| 1 | Nonce novo | `ok` |
| 2 | Replay | 2.º consume → `replay` |
| 3 | Concorrência (12×) | **1×** `ok`, **11×** `replay` |
| 4 | Separação por `key_id` | Mesmo `nonce`, keys diferentes → ambos `ok`; replay só na key original |
| 5 | Expiração | Após janela de retenção, nonce reutilizável → `ok` |
| 6 | `key_id` inválido | `unavailable` (fail-closed lógico) |
| 7 | Handler HTTP + `DATABASE_URL` | **200** depois **409** (`NONCE_REPLAY`) |
| 8 | Sem `DATABASE_URL` | `withPgTransaction` → `{ ok: false, error: 'DATABASE_URL não configurada…' }` |

### Evidência persistência (restart PostgreSQL)

Antes/depois de `docker restart sentinelaaut-pg-nonce-test-a4`:

```text
SELECT ... WHERE nonce='dp04-pg-first-nonce-abcdef01';
→ dp04-pg-test-key-id | dp04-pg-first-nonce-abcdef01  (mantido)
```

Comportamento funcional equivalente ao A3 (replay **409** no sidecar após restart).

### Evidência concorrência

Teste 3 (Vitest): exclusão mútua via PK + transacções serializadas — alinhado ao A3 (1×200 / N×409).

### Falha de conexão / recuperação

| Passo | Observação |
|-------|------------|
| `docker stop sentinelaaut-pg-nonce-test-a4` | Vitest directo: **`connect ECONNREFUSED`** em `pgPool.connect()` (excepção não convertida em `unavailable`) |
| Handler com PG parado | Teste manual interrompido: mesma excepção em `fetch` (não **503** controlado) |
| `docker start` + Vitest completo | **8/8 PASS** (recuperação) |

**Nota de segurança:** erros SQL dentro de `consumeNoncePg` devolvem `unavailable`; falhas **antes** da transacção (pool/connect) comportam-se diferente — documentar para hardening pré-produção.

---

## 6. Fase 4 — Comparação A3 (SQLite) vs A4 (PostgreSQL)

| Comportamento | A3 SQLite sidecar | A4 PostgreSQL |
|---------------|-------------------|---------------|
| Primeiro consume | HTTP **200** | `ok` / HTTP **200** (teste 7) |
| Replay | HTTP **409** | `replay` / HTTP **409** |
| Concorrência | 8× → 1×200, 7×409 | 12× → 1× ok, 11× replay |
| Persistência pós-restart | **409** após restart sidecar | Linha mantida no volume PG; replay lógico confirmado |
| Expiração / prune | Não smoke dedicado A3 | **PASS** teste 5 (core partilhado) |
| Store indisponível | Rede `EAI_AGAIN` / sidecar down | PG down → **excepção** no pool (gap HTTP) |
| Allowlist / identity | Clone env sintético | Env registry JSON sintético (teste 7) |
| n8n → store | Validado A3 | **Fora de escopo** A4 (sem sidecar PG) |

**Conclusão:** núcleo `nonceConsumeCore` **paritário**; diferença operacional na **superfície HTTP** quando PostgreSQL não aceita ligações.

---

## 7. Limitações

1. Sem deploy sidecar PG nem smoke n8n→PG (preparação gateway definitivo fica para fase posterior).
2. Migration **023** não aplicada no descartável (identity registry PG não integrado neste harness).
3. Guard de teste exige URL com `nonce_test_local_discard` + localhost — evita corrida acidental com Supabase.
4. Porta **55440** escolhida por conflito em 55432/55433 no host Windows.
5. `TRUNCATE agent_gateway_nonces` no `beforeAll` dos testes — aceitável **só** no banco descartável.

---

## 8. Rollback

```powershell
Set-Location D:\SentinelaAut
docker compose -f docker/dp02b3-isolated/compose-postgres-nonce-test.yml down -v
```

Remove container, rede compose project e volume `dp02b3-isolated_sentinelaaut-pg-nonce-test-a4-data`. **Não** afecta n8n live, clone dp02b3, nem Supabase.

Rollback SQL (se migration tivesse sido aplicada manualmente em outro PG descartável):
`supabase/migrations/20261103180000_022_agent_gateway_nonces.rollback.sql`

---

## 9. Encerramento

- Container **`sentinelaaut-pg-nonce-test-a4`:** **Stopped**
- **n8n live:** inalterado
- **Supabase produção:** migrations **022/023 não aplicadas**
- **AUT-2F-001 / gateway produção:** não activados

---

**PARAR AQUI — aguardar autorização do operador para próxima fase.**
