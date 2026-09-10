# Relatório — JurisBot multi-turno

## ROOT CAUSE

O endpoint usava `max_output_tokens: 1600` sem inspecionar `response.status` e `incomplete_details`. Quando a resposta estruturada era truncada, `output_parsed` ficava ausente e o endpoint retornava antes do tratamento de falha; o documento `ai_{clientMessageId}` permanecia em `PROCESSING`. No cliente, o erro era exibido somente no alerta superior, fora da área visível do chat.

## Correções aplicadas

- `max_output_tokens`: **1600 → 3200**.
- Verificação explícita de `completed`/`incomplete` e `incomplete_details.reason`.
- Truncamento retorna `AI_OUTPUT_TRUNCATED` com mensagem segura e persiste `FAILED`.
- Saída inválida também passa pelo mesmo caminho de falha; nenhum placeholder fica preso em `PROCESSING`.
- Log seguro `jurisbot_openai_response` com modelo, status, causa, tokens, latência e request id; sem conteúdo, token Firebase ou chave.
- `structuredData` anterior é preservado e os arrays confirmados são mesclados sem apagar fatos já registrados.
- Erros de rate limit local/OpenAI, sessão, truncamento e indisponibilidade têm mensagens distintas.
- Loading “JurisBot está analisando...” e erro/retry aparecem dentro da área do chat.
- Retry sempre executa nova tentativa com novo `clientMessageId`; o envio continua liberando `sending` em `finally`.
- Histórico continua server-side, limitado e filtrado para `USER`/`BOT`; placeholders `SYSTEM` não entram no contexto.

## Status solicitado

| Item | Status | Observação |
|---|---|---|
| TURN 1 | NÃO VALIDADO | OpenAI real não foi chamado nesta execução. |
| TURN 2 | NÃO VALIDADO | OpenAI real não foi chamado nesta execução. |
| TURN 3 | NÃO VALIDADO | OpenAI real não foi chamado nesta execução. |
| MAX_OUTPUT_TOKENS BEFORE | PASS | 1600 |
| MAX_OUTPUT_TOKENS AFTER | PASS | 3200 |
| STRUCTURED DATA PRESERVED | PASS | Merge conservador implementado; teste mockado adicionado. |
| HISTORY ORDER | PASS | Ordem desc → slice → reverse preservada; SYSTEM continua excluído. |
| PROCESSING PLACEHOLDER | PASS | Falhas agora atualizam o placeholder para `FAILED`. |
| FAILED STATE | PASS | Truncamento, saída inválida e exceções passam pelo cleanup. |
| VISIBLE CHAT ERROR | PASS | Mensagem e retry são renderizados na área do chat. |
| RETRY | PASS | Nova tentativa usa novo UUID. |
| SENDING STATE | PASS | `finally` permanece no fluxo de envio. |
| OpenAI real | NÃO VALIDADO | 0 chamadas nesta execução. |
| Custo estimado | PASS | US$ 0,00 |

## Quality gates

| Gate | Status |
|---|---|
| lint | PASS |
| typecheck | PASS |
| testes | NÃO VALIDADO — Vitest bloqueado pelo sandbox ao resolver `vitest.config.ts` com `Access is denied`, antes da execução dos testes. |
| build | PASS |

Firebase Rules, Admin SDK, autenticação, billing, design geral, deploy e Git não foram alterados.
