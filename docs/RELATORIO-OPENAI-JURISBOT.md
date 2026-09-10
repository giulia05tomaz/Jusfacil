# Relatório de validação — OpenAI + JurisBot

Data: 06/09/2026  
Ambiente: desenvolvimento local  
Caso: dados integralmente sintéticos

> Este relatório registra a validação real realizada na fase OpenAI original. O hardening posterior passou a construir o histórico no servidor a partir do Firestore, adotou schema estrito para o payload do cliente, idempotência transacional e limites separados para chat, minuta e evidência. A validação final do hardening não realizou novas chamadas reais à OpenAI e teve custo US$ 0.

## Configuração OpenAI

| Verificação | Estado |
|---|---|
| Projeto OpenAI existente (Default project) | PASS |
| Chave restrita salva somente em `.env.local` | PASS |
| Modelo de chat `gpt-5.6-luna` | PASS |
| Modelo de minuta `gpt-5.6-luna` | PASS |
| Responses API | PASS |
| Structured Outputs validado por Zod | PASS |
| Fallback jurídico fictício ausente | PASS |

Uma chave anterior retornou HTTP 401 e não gerou uso cobrado. Foi criada uma única chave restrita para desenvolvimento local, sem apagar ou revogar chaves existentes e sem alterar billing.

## Uso real e custo

| Métrica | Resultado | Estado |
|---|---:|---|
| Requisições reais concluídas | 7 | PASS |
| Tokens de entrada | 14.715 | PASS |
| Tokens de saída | 7.903 | PASS |
| Tokens totais contabilizados localmente | 22.618 | PASS |
| Custo estimado | US$ 0,0124266 | PASS |
| Orçamento máximo | US$ 0,50 | PASS |

O painel da OpenAI confirmou 7 requisições e 14.715 tokens de entrada. A estimativa usa os tokens retornados em cada resposta e os preços do modelo. Nenhum saldo, segredo ou valor de billing foi registrado neste relatório.

## JurisBot e persistência

| Verificação | Estado |
|---|---|
| Cidadã autenticada com Firebase real | PASS |
| Firebase ID Token enviado pela interface | PASS |
| `verifyIdToken` no servidor | PASS |
| Autorização do proprietário antes da OpenAI | PASS |
| Caso alheio bloqueado antes da OpenAI | PASS |
| Perguntas complementares, de uma a três por turno | PASS |
| Contexto lembrado entre mensagens | PASS |
| `structuredData` atualizado e persistido | PASS |
| `draftReady` somente após dados suficientes | PASS |
| Mensagens reaparecem após recarregar | PASS |

Estado final conferido diretamente no Firestore: caso existente, `draftReady = true`, 10 mensagens persistidas (7 da cidadã e 3 do JurisBot) e status `MINUTA_APROVADA`.

## Evidências sem Firebase Storage

| Verificação | Estado |
|---|---|
| TXT processado ponta a ponta com OpenAI real | PASS |
| Metadados e análise estruturada persistidos | PASS |
| Arquivo original descartado após processamento | PASS |
| Texto bruto não persistido | PASS |
| Limite de 8 MB por arquivo | PASS |
| Limite de 5 arquivos e 20 MB por caso | PASS |
| PDF/DOCX/CSV/XLSX/PNG/JPG em teste real | NÃO VALIDADO |

O suporte de código para os formatos listados permanece implementado e coberto por testes locais quando aplicável. Não houve OCR pesado novo.

## Minuta

| Verificação | Estado |
|---|---|
| Minuta de petição inicial V1 | PASS |
| Solicitação de alteração | PASS |
| Nova geração V2 | PASS |
| V1 preservada no histórico | PASS |
| V2 aprovada e persistida | PASS |
| PDF A4 de V2 | PASS |
| Aviso de revisão e campos não confirmados | PASS |

O PDF possui três páginas, não contém Markdown residual, JavaScript nem objetos serializados indevidamente. O texto deixa explícito que se trata de minuta para revisão, não de documento pronto para protocolo.

## Segurança factual

| Verificação | Estado |
|---|---|
| Datas limitadas aos dados sintéticos fornecidos | PASS |
| Valores limitados aos dados sintéticos fornecidos | PASS |
| Nomes, documentos e endereços limitados aos dados fornecidos | PASS |
| Ausências marcadas como informação a confirmar | PASS |
| Jurisprudência inventada | PASS |
| Pesquisa web pelo JurisBot | PASS |

Em `Jurisprudência inventada` e `Pesquisa web`, PASS significa ausência do comportamento proibido.

## Regressão Firebase

| Verificação | Estado |
|---|---|
| Cadastro/autenticação real | PASS |
| Perfil cidadão carregado | PASS |
| Criação e recarga do caso | PASS |
| Atualização do advogado em navegador nesta rodada | NÃO VALIDADO |

## Gates finais

| Comando | Estado |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` — 7 arquivos, 49/49 | PASS |
| `npm run build` | PASS |
| `npm run test:rules` nesta validação final | NÃO EXECUTADO — JAVA INCOMPATÍVEL |

Os testes automatizados usam mock da OpenAI e não geram custo real. As 7 chamadas descritas em “Uso real e custo” pertencem exclusivamente à fase OpenAI original; nenhuma foi repetida durante o hardening ou sua validação final.

## Pendências

| Item | Estado |
|---|---|
| Teste real dos formatos de evidência além de TXT | NÃO VALIDADO |
| OCR de documentos exclusivamente digitalizados | NÃO VALIDADO |
| Portal do advogado completo | NÃO VALIDADO |
| Admin | NÃO VALIDADO |
| Deploy público | NÃO VALIDADO |
