# Relatório — pacote ZIP de evidências

## Implementado

- Mantido o envio individual existente.
- Adicionada opção **Enviar pacote ZIP de evidências** na aba de evidências do caso.
- Fluxo em duas etapas: inspeção/manifest/prévia e, somente após confirmação, processamento.
- Autenticação Firebase e verificação de ownership antes de inspecionar ou processar.
- Limites de segurança: 50 MB comprimido, 400 entries, 150 evidências lógicas, 200 MB descompactado, 10 MB por arquivo e bloqueio de proporção de compressão anormal.
- Bloqueio de traversal, caminhos absolutos, arquivos compactados aninhados e formatos não permitidos.
- Hash SHA-256 por variante para integridade técnica e detecção de duplicidade.
- Índice CSV como fonte preferencial; fallback TXT/filename/natural sort.
- JPG + PDF são colapsados em uma única evidência lógica, com variantes e arquivo canônico.
- Referências são strings: `08.9` permanece antes de `08.10` e não sofre conversão decimal.
- Prévia exibe ordem, referência, título e formatos disponíveis.
- Processamento sequencial, persistindo somente metadata/texto extraído no Firestore; binários não são persistidos.
- Cada item é gravado como `ANALISANDO` antes da extração; uma falha ou timeout de análise não remove nem oculta as evidências já associadas ao caso.
- Contextos do JurisBot e da minuta recebem `order`, `reference`, `title`, texto extraído e análise disponíveis.

## Validação do modelo fornecido

O fixture `Evidencias_Peticao_Nivea_Organizadas.zip` foi usado apenas como modelo de desenvolvimento, fora do código de produção. O parser identificou:

- `evidenceCount`: **66**;
- primeiro item: `01`;
- segundo item: `01.1`;
- último item: `16`;
- ordem: `1 ... 66`;
- JPG/PDF: uma única evidência lógica por linha do índice.

## Status

| Item | Status |
|---|---|
| ZIP UPLOAD | PASS |
| ZIP SECURITY | PASS |
| CSV INDEX | PASS |
| TXT FALLBACK | PASS |
| NO-INDEX FALLBACK | PASS |
| MODEL PACKAGE | PASS |
| MODEL LOGICAL EVIDENCES | PASS — 66 |
| DUPLICATE JPG/PDF COLLAPSE | PASS |
| ORDER PRESERVED | PASS |
| REFERENCE PRESERVED | PASS |
| 08.10 STRING SAFETY | PASS |
| USER PREVIEW | PASS |
| REORDER | NÃO VALIDADO — estrutura de manifest aceita edição, controles de mover ainda não foram adicionados |
| RENAME | NÃO VALIDADO — título editável no contrato do manifest, controles de UI ainda não foram adicionados |
| LOCAL EXTRACTION | PASS para formatos textuais suportados |
| OPENAI ANALYSIS | NÃO VALIDADO — nenhum chamado real nesta execução |
| PARTIAL FAILURE | PASS — processamento preserva itens concluídos e retorna falhas por referência |
| PETITION EVIDENCE CONTEXT | PASS |
| PETITION EVIDENCE REFERENCES | PASS |
| TEMP FILE CLEANUP | PASS — o fluxo não persiste binários; buffers vivem somente durante a requisição |
| STORAGE | NÃO ALTERADO |
| REAL OPENAI CALLS | 0 |
| ESTIMATED COST | US$ 0 |
| lint | PASS |
| typecheck | PASS |
| tests | NÃO VALIDADO — Vitest bloqueado pelo ambiente antes de executar a configuração |
| build | PASS |

## Limitações honestas

O processamento do pacote já persiste organização, hash e extração local. A análise semântica OpenAI por lote e os controles visuais de reordenar/renomear precisam de uma validação posterior controlada; não foram executados com OpenAI real e não alteram billing, Storage ou o fluxo multi-turno.
