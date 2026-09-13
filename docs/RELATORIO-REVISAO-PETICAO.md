# Revisão orientada da petição

Data: 13/09/2026.

## Correção live do bloqueio 409 — resultado mais recente

O pedido mostrado no celular chegou a `/api/chat/jurisbot` e foi encaminhado para `review_revision`, mas retornou 409 antes da geração. Consulta somente de leitura confirmou `draftReady=true` e falha Zod `evidence: too_big`: havia 25 referências acumuladas no caso, enquanto o schema da resposta individual da IA limitava a lista a 20. Não era falha de autenticação nem do envio de e-mail.

Foi separada a validação persistida (até 400 referências, cada item validado) da resposta individual da IA (limite 20 preservado). A revisão não pede que o modelo reproduza o catálogo: o servidor restaura integralmente as referências persistidas na proposta e na nova minuta. Referências arbitrárias sugeridas pela IA continuam rejeitadas. A consulta QA confirmou `persistedSchemaValid=true` sem alterar dados.

O chat agora exibe o motivo seguro retornado pelo servidor junto de Tentar novamente. Foram acrescentados logs de código/status de bloqueio e caminho/código de validação, sem conteúdo de evidências ou credenciais.

Validação atual:

- lint: PASS — exit code 0.
- typecheck: PASS — exit code 0.
- tests: PASS — exit code 0; 231 testes em 17 arquivos, somente mocks para provedores. Incluem catálogos de 25/66 referências, V3/V4, replay, montagem e restauração da proposta.
- build: PASS — exit code 0, reconferido após a última correção do schema.
- A primeira bateria desta subetapa detectou que encadear `.max(400)` ainda preservava o limite anterior; corrigido com novo array validado pelo mesmo schema de item. A bateria completa posterior passou; a falha não foi mascarada.
- Revisão V3/documento/aprovação com OpenAI real: NÃO VALIDADO nesta execução. Não houve nova versão real ou envio acionado pelo agente.

OpenAI Docs orientou a manutenção do contrato estruturado existente; a orientação de persistência influenciou a preservação server-side das evidências, sem migração de modelo/SDK/armazenamento. Nenhuma mudança de design, billing, Git ou deploy.

OPENAI CALLS: 0 reais pelo agente. OPENAI COST: US$ 0. EMAIL CALLS: 0 reais.

## Atualização anterior — correção da revisão pelo chat

Esta seção registra a entrega anterior, que teve a execução dos testes bloqueada. O bloqueio foi superado na subetapa acima, com nova autorização e 231 testes PASS. Os 218 testes e o build PASS nas seções finais são resultados históricos da implementação do botão.

Diagnóstico live somente de leitura: o caso `JF-2026-33442CCB` tinha apenas V1/V2; o chat comum havia atualizado a triagem com o novo nome, mas não havia uma solicitação de aplicação nem V3. Uma orientação sobre R$ 3.000 ficou corretamente bloqueada por composição não esclarecida. Não houve geração real de uma versão revisada pelo agente.

Correção implementada:

- Após existir uma minuta, mensagens do chat são encaminhadas ao mesmo endpoint de revisão usado pelo botão; não passam pela triagem que apenas mesclava dados.
- A proposta e as perguntas são persistidas nas mensagens e reaparecem após refresh. A resposta explicita que o documento ainda não foi alterado.
- O cidadão confirma pelo botão ou escreve `Confirmo a alteração`. A aplicação gera uma nova versão não aprovada, atualiza os dados persistidos e aciona a montagem existente com as evidências retidas.
- V3/V4 e versões sucessivas preservam as versões anteriores. Falha na montagem informa que somente o texto foi salvo; exige retomar a visualização completa, sem afirmar sucesso dos anexos.
- O snapshot da minuta atual prevalece sobre propostas não aplicadas. A revisão de nome deve substituir a identificação da mesma parte, sem incorporar automaticamente alterações anteriores de valores.
- O servidor rejeita uma peça que não contenha os nomes confirmados. O encaminhamento do chat conserva a proposta/versão-base por identificador, protegendo o replay após a versão avançar.

Foram adicionados testes com mocks para pedido/confirmacão no chat, nome no texto e nos dados, V3/V4, replay/conflito de chave, preservação de evidências, montagem e restauração da proposta. A execução dos testes desta atualização está **NÃO VALIDADA**: a autorização adicional para Vitest foi rejeitada pelo revisor automático por limite de uso da conta. O bloqueio não foi contornado e a contagem histórica não é uma contagem da bateria atual.

Validação desta atualização:

- lint: PASS — exit code 0, incluindo os novos testes.
- typecheck: PASS — exit code 0, incluindo os novos testes.
- tests: NÃO VALIDADO — execução bloqueada pelo ambiente.
- build: PASS — exit code 0.
- Browser: tela autenticada aberta, V2 e 66 evidências preservadas; nenhuma confirmação de revisão foi acionada.
- Revisão V3 com OpenAI real / documento completo / aprovação / envio: NÃO VALIDADO nesta atualização.

OPENAI CALLS: 0 reais pelo agente nesta atualização. OPENAI COST: US$ 0. EMAIL CALLS: 0 reais. Sem commit, push ou deploy.

## Entrega

O botão **Solicitar alteração** usa o endpoint existente de minuta em duas etapas:

1. `review_revision`: orientação preliminar, perguntas de esclarecimento e proposta persistidas server-side, sem alterar a petição.
2. `revise`: confirmação explícita da proposta persistida, geração e gravação de uma nova versão não aprovada e atualização dos dados estruturados do caso.

O cidadão complementa as respostas no campo de revisão ou no chat quando houver perguntas. Editar o pedido invalida a proposta anterior na interface. O chat usa o mesmo backend e exige confirmação explícita da proposta antes de alterar o documento.

A orientação não promete um valor universalmente melhor da causa. Deve conferir os pedidos e a composição informada, perguntar sobre conflitos e não criar danos ou valores para preencher diferenças. O aviso de revisão por advogado permanece visível.

Se um valor confirmado mudar, o servidor verifica também se a seção de valor da causa da nova peça contém esse valor. Texto que ainda contenha o valor antigo nesse campo é rejeitado sem salvar nova versão.

Versões aprovadas, evidências/originais, artefatos anteriores e histórico de e-mails não são sobrescritos. A montagem existente reaproveita os arquivos do caso para o PDF/Word da nova versão. Falhas de montagem permanecem erros; não são substituídas por anexos fictícios. O envio fica indisponível até a aprovação da versão atual.

## Correção do acesso HTTP pelo celular

O log do servidor confirmou `TypeError: crypto.randomUUID is not a function` no início de `sendMessage`, antes de chamar a API. Chat, evidência individual, geração e revisão passaram a usar UUID baseado em `crypto.getRandomValues`, compatível com o HTTP do IP local. Revisão/geração renovam o token uma vez após 401, conservando o corpo da solicitação.

## Validação automatizada — somente mocks

| Verificação | Resultado |
| --- | --- |
| Firebase ID Token/ownership/caso inexistente | PASS |
| Orientação sem modificar peça/aprovação/arquivos/envio | PASS |
| Perguntas em pedido ambíguo; aplicação bloqueada | PASS |
| Confirmação obrigatória e pedido igual ao revisado | PASS |
| V3 salva, dados estruturados atualizados, V2 intacta | PASS |
| Valor antigo no texto da peça bloqueado | PASS |
| Dados/evidências alterados e corrida durante geração | PASS |
| Idempotência/replay/conflito de chave/double submit | PASS |
| Falha de AI persistida sem fallback jurídico | PASS |
| UUID sem randomUUID e renovação única após 401 | PASS |
| Interface de revisão/perguntas/loading/double click | PASS |
| Montagem acionada para a nova versão com evidências | PASS |
| V3 só enviada depois de aprovada; envio V2 preservado | PASS |

Orientações utilizam o limite de triagem existente; geração/aplicação utilizam o limite de minutas existente. Ambos continuam limitados e ainda são in-memory para desenvolvimento, conforme a limitação anterior. Não houve mudança de modelo ou migração de SDK.

## Conferência live somente de leitura

Caso `JF-2026-33442CCB`: tela autenticada carregada, V2 aprovada e 66 evidências presentes. Campo de revisão e aviso de preservação de versões visíveis. Sem overlay ou erros de execução observados.

Sem overflow horizontal nas resoluções 375x812, 390x844, 768x1024 e 1440x900. Estados de orientação/aplicação/falha foram exercitados com mocks nos testes de componente, não com chamadas reais no navegador.

REVISÃO E2E COM OPENAI REAL: NÃO VALIDADO nesta execução.

NOVO E-MAIL/PDF REVISADO RECEBIDO: NÃO VALIDADO nesta execução.

Nenhuma V3 real foi gerada, aprovada ou enviada pelo agente. A confirmação manual anterior de recebimento da V2 não valida este novo fluxo de revisão.

## Quality gates

- lint: PASS — exit code 0.
- typecheck: PASS — exit code 0.
- tests: PASS — exit code 0; 218 testes em 17 arquivos.
- build: PASS — exit code 0.
- Tracing: PASS — 26 manifests, 0 entradas privadas, assets obrigatórios presentes.

A primeira execução restrita do Vitest encontrou bloqueio de leitura do esbuild no Windows. A bateria foi executada depois com a permissão adicional; o bloqueio não foi mascarado. O teste de contrato antigo foi atualizado para exigir orientação e confirmação, preservando a rejeição de revisão incompleta.

OPENAI CALLS: 0 reais.

OPENAI COST: US$ 0 nesta execução.

EMAIL CALLS: 0 reais.

Sem alteração de billing, credenciais, destinatário QA, remetente, design, marketplace de advogados, Git ou deploy.
