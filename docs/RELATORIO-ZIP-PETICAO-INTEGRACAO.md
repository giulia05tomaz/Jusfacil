# Relatório — integração ZIP → caso → petição

## Root cause

O processamento gravava a evidência somente depois da extração. Em pacotes grandes, uma análise lenta/interrompida podia deixar a prévia no React, mas nenhum item persistido no caso. Além disso, o contexto de minuta limitava a consulta a 12 evidências e não garantia a seção documental.

## Correções

- Requisições de inspeção e processamento renovam o Firebase ID Token uma vez (`getIdToken(true)`) quando recebem `401`.
- A API grava cada evidência como `ANALISANDO` antes da extração e atualiza para concluída/erro depois.
- O servidor reconstrói o manifest a partir do ZIP e rejeita divergência do manifest enviado pelo navegador.
- Hash do pacote impede reprocessamento idêntico no mesmo caso.
- Chat e draft consultam todas as evidências processadas no Firestore, em ordem por `order`, usando contexto compacto.
- A minuta recebe instrução e contexto com `order`, `reference`, `title`, `summary` e `relevantFacts`.
- Quando existem evidências, a minuta recebe seção determinística `DOS DOCUMENTOS E EVIDÊNCIAS`, preservando títulos e referências, incluindo `08.10` como string.
- Nova evidência posterior a uma minuta gera aviso na UI; gerar nova versão cria V2 e não sobrescreve V1.

## Status

| Item | Status |
|---|---|
| ROOT CAUSE | PASS |
| SESSION ERROR | PASS — retry com token renovado |
| ZIP INSPECT | PASS |
| MANIFEST | PASS |
| LOGICAL EVIDENCES | PASS — fixture: 66 |
| REVIEW UI | PASS |
| PROCESS ACTION | PASS |
| FIRESTORE EVIDENCES | NÃO VALIDADO em Firebase real nesta execução; código grava antes da análise |
| EVIDENCE TAB COUNT | NÃO VALIDADO em Firebase real; UI lê do Firestore após `loadData()` |
| PERSISTENCE AFTER REFRESH | NÃO VALIDADO em Firebase real |
| JURISBOT EVIDENCE CONTEXT | PASS |
| DRAFT EVIDENCE CONTEXT | PASS |
| ORDER PRESERVED | PASS |
| REFERENCE `08.10` | PASS |
| TITLE PRESERVED | PASS |
| PETITION BODY REFERENCES | PASS — valida referências emitidas pelo modelo |
| DOCUMENTS/EVIDENCE SECTION | PASS |
| EXISTING APPROVED DRAFT PRESERVED | PASS — versões são append-only |
| NEW VERSION | PASS — aviso e geração de V2 |
| PACKAGE IDEMPOTENCY | PASS — SHA-256 do ZIP |
| OPENAI REAL CALLS | 0 |
| COST | US$ 0 |
| lint | PASS |
| typecheck | PASS |
| tests | NÃO VALIDADO — Vitest bloqueado pelo ambiente antes da execução |
| build | PASS |

Storage, billing, Firebase Rules e o fluxo individual não foram alterados.

## Validação live final

Não foi possível concluir a validação E2E real nesta execução: o navegador automático foi bloqueado pelo limite de uso da sessão e o `.env.local` deste workspace não contém credenciais Admin preenchidas nem um arquivo de credenciais disponível. Portanto não foi feita leitura ou escrita no Firestore real, não houve chamada OpenAI e nenhum pacote foi processado novamente.

| Verificação live | Status |
|---|---|
| Firebase user/token/ownership | NÃO VALIDADO |
| 66 evidências no Firestore | NÃO VALIDADO |
| Evidências (66) na UI | NÃO VALIDADO |
| Persistência após F5 | NÃO VALIDADO |
| Idempotência live | NÃO VALIDADO |
| V1 aprovada preservada | NÃO VALIDADO |
| V2 criada com evidências | NÃO VALIDADO |
| PDF V2 | NÃO VALIDADO |
| OpenAI real | 0 chamadas |

Conclusão: **PARCIALMENTE VALIDADO**. O parser local do fixture continua confirmado com 66 evidências lógicas, mas a prova Firebase/UI solicitada depende de uma sessão autenticada e credenciais Admin reais disponíveis.

## Validação manual/local desta rodada

- LIVE ENVIRONMENT: PARCIAL — o servidor existente permaneceu em `http://localhost:3000`; não foi reiniciado para não interromper uma sessão ativa.
- Firebase Web Config: CONFIGURED (variáveis públicas presentes).
- Firebase Admin: FAIL/NÃO CONFIGURADO neste workspace — variáveis Admin vazias e arquivo `GOOGLE_APPLICATION_CREDENTIALS` indisponível.
- OpenAI: CONFIGURED (chave presente, não utilizada).
- ZIP PREVIEW: PASS localmente pelo parser; fixture esperado = 66.
- FIRESTORE EVIDENCES: NÃO VALIDADO — sem credencial Admin/sessão real.
- EVIDENCE TAB: NÃO VALIDADO.
- REFRESH: NÃO VALIDADO.
- PACKAGE IDEMPOTENCY LIVE: NÃO VALIDADO.
- V1 PRESERVED: NÃO VALIDADO.
- V2 CREATED: NÃO VALIDADO.
- V2 EVIDENCE SECTION: NÃO VALIDADO em live.
- REFERENCE 08.10: PASS no parser local; NÃO VALIDADO no Firestore/UI.
- PDF: NÃO VALIDADO para V2 live.
- OPENAI CALLS: 0.

Quality gates desta rodada: lint PASS; typecheck PASS; tests NÃO VALIDADO (Vitest bloqueado pelo esbuild antes de executar); build PASS.

### Roteiro manual curto

1. Abra `http://localhost:3000`, entre com o cidadão QA e abra o caso existente.
2. Em **Evidências**, selecione `Evidencias_Peticao_Nivea_Organizadas.zip` e clique **Revisar evidências**. Confirme `66`, `01`, `01.1`, `08.10` e `16`.
3. Clique **Confirmar e analisar** uma única vez. No Firebase Console, confira `cases/{caseId}/evidences` e registre total/concluídas/erros.
4. Volte à aba e confirme `Evidências (66)`, pressione F5 e confirme novamente.
5. Selecione o mesmo ZIP para conferir a mensagem de idempotência.
6. Confirme V1 aprovada, gere V2, abra o PDF e verifique a seção documental e `08.10`.
