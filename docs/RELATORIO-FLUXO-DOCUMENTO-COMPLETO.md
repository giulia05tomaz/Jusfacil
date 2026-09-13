# Fluxo do cidadão — documento completo com evidências

Data: 13/09/2026.

## Resultado implementado

O fluxo existente de entrevista e geração textual foi preservado. Após a persistência da minuta, uma montagem separada utiliza o corpo daquela versão e os originais privados das evidências do mesmo caso para gerar PDF e Word. Novas versões reutilizam esses originais, sem exigir novo upload e sem alterar a versão anterior.

- Upload individual e ZIP retêm arquivos originais privados, com identidade de caso/evidência, tamanho e SHA-256 verificados. PDF e imagem equivalentes representam uma única evidência lógica.
- Ordem, referência e título são fornecidos pela pessoa; a revisão do ZIP permite ajustá-los antes da confirmação. A montagem não inventa descrição de provas nem fatos.
- Imagens são anexadas proporcionalmente e todas as páginas de cada PDF são incorporadas. PDF digitalizado sem texto pode ser anexado, mas não é apresentado como analisado por OCR ou IA.
- PDF e DOCX recebem a relação de anexos e os anexos físicos correspondentes, usando um modelo limpo de geometria/estilos, sem conteúdo ou imagens pessoais copiados do documento de referência.
- A tela distingue prévia textual de documento completo e oferece navegação por páginas e acesso direto aos anexos. O navegador interno recebe imagens das páginas do PDF autenticado, evitando o visualizador PDF vazio.
- A aprovação exige a versão atual e o documento completo vinculado ao corpo e às evidências. Arquivo ausente, análise pendente, conteúdo desatualizado ou vínculo incorreto bloqueia, sem fallback para um PDF contendo apenas referências.
- O fluxo de e-mail existente foi preservado. Não houve aprovação ou envio nesta execução.

## Verificação automatizada e local

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| lint | PASS | Exit code 0. |
| typecheck | PASS | Exit code 0. |
| testes | PASS | 178 testes, 16 arquivos, exit code 0; OpenAI e envio de e-mail mockados. |
| build | PASS | Exit code 0; aviso de tracing corrigido, build final sem os avisos anteriores. |
| Montagem Python real | PASS | Fixture fictícia: JPG, PNG e PDF de duas páginas; 3 evidências lógicas, 4 páginas de anexos, PDF de 5 páginas e 4 imagens incorporadas ao DOCX. |
| PDF visual | PASS | As 5 páginas da fixture final foram renderizadas e inspecionadas. |
| DOCX estrutural | PASS | Imagens, ordem e legendas verificadas. |
| DOCX visual da nova montagem | NÃO VALIDADO | O renderizador de Word não encontrou LibreOffice/soffice nesta máquina. Não confundir com a validação histórica do DOCX V2. |
| Negativos Python | PASS | Hash divergente, escape de caminho e formato não visual bloqueados. |
| Auth/ownership/versão/concor­rência | PASS | Cobertura automatizada de token, cross-case, versão, originais ausentes, aprovação e montagem idempotente. Não equivale a uma nova jornada real completa. |
| Empacotamento privado | PASS | Auditoria de 26 manifests nft: 0 entradas correspondentes a .env, artefatos privados, originais ou padrões de credenciais definidos. Os 2 scripts e o modelo exigidos pela rota estão presentes. |

O primeiro npm test no sandbox padrão foi bloqueado pelo esbuild com AccessDenied antes de carregar a configuração. A execução autorizada fora desse bloqueio concluiu os 178 testes. Não houve envio real em testes automatizados.

## Caso real de QA existente

Caso: JF-2026-33442CCB.

- Recuperação dos 66 originais a partir do ZIP fornecido: PASS. Comparação de hashes e metadados, sem duplicar evidências nem alterar sua ordem ou descrição.
- Comparação após a recuperação: caso, minutas, aprovações e tentativas anteriores preservados.
- V1 permanece aprovada; V2 permanece não aprovada, aguardando revisão; nenhuma V3 criada nesta execução.
- Após reiniciar o servidor, downloads autenticados da V2: PDF HTTP 200, 7.691.072 bytes; DOCX HTTP 200, 6.334.619 bytes. Ambos iguais aos arquivos V2 anteriormente revisados e aos hashes persistidos.
- Reconferência final em aba nova do navegador: PASS. Documento V2 com 70 páginas; primeira imagem de anexo carregada na página 5. A aba anterior apresentou erro de conexão, resolvido para esta verificação ao abrir uma nova aba.
- Responsividade da prévia e controles: sem overflow em 375x812, 390x844, 768x1024 e 1440x900, verificados nesta execução antes da build final. Não representa teste exaustivo de todos os estados de todos os botões.
- Os anexos de Nívea são QA de outro objeto, não provas do relato fictício de Marina. A advertência explícita na V2 foi preservada.

## Limitações e pendências

Os originais e artefatos persistem em diretórios privados LOCAIS (.evidence-originals e .artifacts). Não são armazenamento durável compartilhado de produção: migração, múltiplas instâncias ou perda do disco exigem solução privada persistente e backup. Foram excluídos do tracing; nenhuma publicação foi realizada.

Requer Python e as dependências de requirements-docx.txt. A montagem visual suporta JPG/PNG/PDF. Outros formatos de evidência precisam de representação visual apropriada; não são silenciosamente omitidos. Limites: 150 evidências lógicas/200 MiB por caso, 10 MiB por original, até 400 páginas de anexos, PDF até 8 MiB e DOCX até 20 MiB. Documentos acima dos limites bloqueiam.

Jornada nova completa entrevista OpenAI → nova minuta → montagem → revisão → aprovação → e-mail: NÃO VALIDADO em E2E real nesta execução. A cobertura automatizada e a fixture Python não substituem esse teste. A montagem reutiliza a entrevista existente; nenhuma nova chamada paga foi feita para forçar uma validação.

Próximo passo: revisão da usuária no próprio aplicativo, especialmente corpo, ordem e conteúdo dos anexos. Nenhum envio adicional é considerado aprovado ou recebido por este relatório.

OPENAI CALLS: 0

OPENAI COST: US$ 0

NEW EMAILS: 0

APPROVALS: 0

GIT ADD / COMMIT / PUSH / DEPLOY: não realizados.
