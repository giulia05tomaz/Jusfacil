# Relatório final — Hardening OpenAI

Data: 06/09/2026  
Ambiente: desenvolvimento local  
Escopo: validação técnica e documental, sem chamada real à OpenAI

## Resultado

| Verificação | Estado |
|---|---|
| CLIENT-SUPPLIED HISTORY | REMOVED |
| SERVER FIRESTORE HISTORY | PASS |
| STRICT REQUEST SCHEMA | PASS |
| IDEMPOTENCY | PASS |
| CHAT RATE LIMIT | PASS |
| DRAFT RATE LIMIT | PASS |
| EVIDENCE RATE LIMIT | PASS |
| RATE LIMIT BEFORE OPENAI | PASS |
| GITIGNORE | PASS |
| GEMINI METADATA | REMOVED |
| SECRET SCAN | PASS |
| OPENAI SMOKE GUARD | PASS |
| REAL OPENAI CALLS THIS EXECUTION | 0 |
| REAL OPENAI COST THIS EXECUTION | US$ 0 |

## Evidências do hardening

- O navegador envia somente `caseId`, `clientMessageId` e `message`.
- O servidor valida token e autorização antes de buscar `structuredData`, evidências e as mensagens USER/BOT persistidas no Firestore.
- Mensagens SYSTEM são ignoradas no contexto e o histórico é limitado por quantidade e tamanho.
- O schema estrito rejeita `messages`, `role`, histórico de assistant e campos extras enviados pelo navegador.
- A reserva transacional `ai_{clientMessageId}` bloqueia double-submit concorrente antes da chamada paga.
- Minutas usam uma reserva por `clientRequestId`; evidências usam `evidenceId` idempotente.
- Os limites padrão são 12 chats por minuto por usuário, 3 minutas por hora por usuário/caso e 5 evidências por hora por usuário/caso.
- Testes confirmam que chat, minuta e evidência bloqueados pelo rate limit não chamam o cliente OpenAI mockado.
- O rate limit é em memória e está identificado no código e README como exclusivo para desenvolvimento.
- Logs mantêm modelo, latência, tokens, custo estimado e request ID quando disponível, sem mensagens, evidências ou identificadores de usuário/caso.

## Gitignore e limpeza

Todos os padrões exigidos foram encontrados:

- `.env`
- `.env.local`
- `.env*.local`
- `serviceAccount*.json`
- `service-account*.json`
- `firebase-admin*.json`
- `credentials*.json`
- `*.pem`
- `output/`
- `*.zip`

O PDF sintético gerado anteriormente foi removido de `output/pdf/`. A varredura dos arquivos compartilháveis, excluindo ambientes locais deliberadamente ignorados, dependências, caches e binários gerados, não encontrou chave OpenAI, bloco de chave privada ou credencial de service account.

## Smoke test

`scripts/openai-smoke.mjs` agora encerra antes de criar o cliente ou chamar a API quando `ALLOW_REAL_OPENAI_SMOKE` não for exatamente `1`. `.env.example` define o valor seguro `0`. O script não foi executado nesta validação.

O estimador de custo permanece específico para `gpt-5.6-luna`, conforme os modelos atuais de chat e minuta. O comentário no helper registra que ele precisa ser atualizado se o modelo configurado mudar.

## Quality

| Comando | Estado |
|---|---|
| `npm ci` | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS |
| Arquivos de teste Vitest | 7 |
| Testes Vitest | 49/49 |
| `npm run build` | PASS |
| `npm run test:rules` | NÃO EXECUTADO — JAVA INCOMPATÍVEL |

O ambiente possui Java 8. Java não foi instalado ou alterado nesta execução.

## Pendências

- Migrar o rate limit em memória para Firestore, Redis ou equivalente antes de deploy multi-instance.
- Executar `npm run test:rules` em ambiente com Java 21 ou superior.
- Revisar separadamente as 16 vulnerabilidades transitivas reportadas por `npm ci` (15 moderadas e 1 alta), sem aplicar atualização forçada nesta fase.
- Manter o portal do advogado como “Em desenvolvimento” até auditoria específica.
- Permanecem fora do escopo: novos testes E2E reais da OpenAI, deploy e push.

Nenhum `git add`, commit, push ou deploy foi realizado.
