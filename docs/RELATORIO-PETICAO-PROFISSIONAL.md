# Relatório — padrão profissional da petição inicial

## Entrega

O fluxo de minuta foi ajustado para separar a conversa do JurisBot da geração da petição:

`chat → structuredCaseData → rota de minuta → validação de evidências → PDF`

A rota de minuta agora envia ao modelo os dados estruturados do caso e as evidências processadas com rótulos estáveis (`EVIDÊNCIA 01`, `EVIDÊNCIA 02`, ...). Referências a evidências que não existem são rejeitadas; o sistema não inventa anexos, nomes, valores ou fatos. A instrução de geração exige endereçamento, qualificação, título da ação, competência, fatos cronológicos, fundamentos, pedidos numerados, valor da causa e encerramento. O campo opcional `claimValue` foi incluído no schema para suportar o valor calculado quando houver dados suficientes.

O PDF foi reorganizado em formato A4 com cabeçalho, rodapé, hierarquia de títulos, paginação e seção separada de índice probatório. Como a versão atual não retém os arquivos originais (`originalRetained: false`), o PDF registra apenas os documentos efetivamente processados e informa de forma explícita que nenhum anexo visual foi inventado.

## PDF de QA

Foi gerado um caso completamente fictício de Marina Alves, com uma evidência sintética e uma petição de duas páginas. O texto extraído confirmou a presença de `ANEXO PROBATÓRIO - ÍNDICE DAS EVIDÊNCIAS` e do rótulo `EVIDÊNCIA 01`.

## Status técnico

| Item | Status |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm test` | NÃO VALIDADO — o Vitest foi bloqueado pelo ambiente antes de executar os testes (erro de acesso do esbuild ao diretório de configuração). |
| OpenAI real nesta execução | NÃO VALIDADO — 0 chamadas, custo US$ 0 |
| Firebase | NÃO VALIDADO nesta execução; nenhuma configuração, escrita ou dado foi alterado. |

## Testes e proteção adicionados

- teste de geração de PDF com índice probatório separado;
- validação server-side das referências de evidência;
- tratamento explícito de resposta OpenAI incompleta ou sem saída estruturada;
- logs server-side de status, latência, uso e request id, sem registrar segredos;
- manutenção dos testes existentes de fluxo multi-turno do JurisBot.

## Limitações conhecidas

- O índice probatório está pronto, mas anexos visuais completos exigem retenção dos arquivos em Storage ou disponibilização de bytes/URLs persistentes. Isso não foi introduzido para não alterar a arquitetura de armazenamento nesta execução.
- O valor da causa é aceito no schema apenas quando calculável; a validação determinística de cada soma depende de dados estruturados suficientes e deve continuar sendo revisada pelo usuário.
- A referência visual foi usada somente como orientação de organização profissional; nenhum conteúdo, fato ou documento da referência foi copiado para o caso de QA.
