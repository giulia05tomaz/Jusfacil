# Relatório — envio de petição por e-mail em modo de teste

## Correção de replay e CC — 13/09/2026

O backend mantinha uma trava de entrega por versão. Uma confirmação com chave nova e CC diferente retornava o registro SENT anterior, e a interface o apresentava como novo envio. Corrigido sem remover a proteção contra duplicidade:

- SENT/PENDING com outro CC: HTTP 409, SUBMISSION_COPY_EMAIL_CONFLICT, mensagem explícita de nenhum novo envio para o endereço informado; sem chamada ao provedor nem nova submission.
- Replay com o mesmo CC: idempotência preservada e indicação de envio anterior, sem banner verde de novo sucesso.
- Interface rejeita resposta SENT/PENDING de outra versão ou CC mesmo com HTTP 200. Histórico identifica data e e-mail de cópia.
- Após a build, aplicativo conferido em aba nova: conteúdo e histórico carregados, sem overlay ou erros de console; sem overflow medido em 375x812 e 1440x900. Nenhum botão de confirmação de envio foi acionado. agent-browser CLI não disponível; conferência realizada pelo navegador conectado.
- 8 testes de regressão adicionados; suíte completa: 186 testes em 16 arquivos, exit code 0. Lint, typecheck e build: exit code 0. A primeira execução direcionada encontrou inconsistência na fixture do histórico do novo teste; fixture ajustada e suíte completa passou.
- Conferência real somente de leitura: V2 aprovada, PDF completo de 7.691.072 bytes/66 anexos, registro SENT às 04:05:19 com TO e cópia iguais. Nenhuma nova aprovação ou tentativa de e-mail executada pelo Codex nesta correção. Originais, artefatos e histórico preservados.

Confirmação manual da usuária nesta conversa: e-mail V2 recebido em giulia05tomaz@gmail.com, 66 anexos presentes, PDF correto abre e pode ser baixado. EMAIL RECEIVED: PASS; PDF RECEIVED: PASS; PDF OPENS: PASS; CORRECT APPROVED VERSION: PASS, para esse teste com destinatários iguais. Não equivale à validação de CC diferente.

CITIZEN CC DIFFERENT FROM TO: NÃO VALIDADO. O remetente onboarding@resend.dev continua sujeito às restrições de destinatário do Resend. Não foi configurado domínio ou provedor novo, removida trava, comprado serviço ou alterado billing para contornar a limitação.

OPENAI CALLS: 0. OPENAI COST: US$ 0. REAL EMAIL CALLS DURING THIS FIX: 0. Sem git add, commit, push ou deploy.

Atualização de 13/09/2026: a montagem automática do documento com evidências foi integrada ao fluxo do cidadão. Consulte [RELATORIO-FLUXO-DOCUMENTO-COMPLETO.md](RELATORIO-FLUXO-DOCUMENTO-COMPLETO.md) para resultados e limitações desta execução. Nenhuma nova aprovação ou tentativa real de e-mail foi realizada. As seções abaixo preservam o histórico anterior, inclusive a revisão documental manual da V2.

Data: 12/09/2026.

## Continuação final — V2 documental, imagens otimizadas e artefato completo

Esta seção substitui as pendências técnicas da continuação histórica abaixo. As três etapas foram autorizadas pela usuária. A revisão foi manual e documental: seção de documentos reformulada, aviso explícito de anexos de QA e versão 2 para revisão. Não houve geração de novos fundamentos jurídicos ou inferência de fatos a partir das imagens.

- V2 registrada no caso QA JF-2026-33442CCB, approved=false, currentDraftVersion=2, AGUARDANDO_REVISAO. V1 continua aprovada; evidências e tentativas SENT/FAILED da V1 preservadas por conferência real no Firestore.
- DOCX final: 6.334.619 bytes. PDF final exportado pelo Microsoft Word autorizado: 7.691.072 bytes, abaixo de 8 MiB. Ambos contêm 70 páginas e 66 imagens na ordem/títulos do índice CSV. Todas as 70 páginas do PDF do Word foram renderizadas e inspecionadas. Originais preservados; compressão aplicada somente às cópias JPEG, máximo 1280 px, qualidade 70, sem recorte ou reconstrução. Nitidez e orientação limitadas de algumas fotografias já pertencem às fontes.
- Os anexos são documentos do pacote de Nívea, relativos a outra pessoa/objeto, utilizados somente para testar a montagem. Não comprovam os fatos fictícios de Marina. A V2 declara essa separação e mantém os documentos de Marina pendentes, sem inventar provas.
- Artefato privado imutável em .artifacts/, com metadados Firestore draftArtifacts/v2. Vinculação por caso, versão, corpo persistido, índice, hashes das evidências, ZIP, PDF e DOCX. Arquivo ausente, corrompido, outra versão/caso ou conteúdo alterado bloqueia entrega; não retorna PDF com apenas índice como fallback.
- Download Word/PDF autenticado funciona após refresh sem selecionar novamente o ZIP. Pela interface, ambos GETs da V2 retornaram 200. Verificação adicional com login cidadão QA confirmou byte a byte e SHA-256 contra os arquivos finais: PDF 7.691.072 e DOCX 6.334.619 bytes. Token validado no servidor; nenhuma aprovação ou POST de e-mail realizado.
- Camada de envio usa exatamente o PDF completo persistido, somente quando a versão estiver aprovada. Testes mockados verificam conteúdo exato, hash/imagens registrados, ausência de artefato sem envio, cross-case, alteração de conteúdo, arquivo ausente FAILED e idempotência. O teste real de entrega da V2 permanece NÃO VALIDADO porque ela ainda aguarda revisão/aprovação da usuária.
- Responsividade dos novos controles conferida em 375x812, 390x844, 768x1024 e 1440x900: sem overflow horizontal, Word/PDF continuam presentes. Console da página sem erros/warnings capturados após servidor com acesso ao Firebase. O primeiro servidor sandboxado retornou 401 ao não conseguir verificar o token; foi reiniciado com acesso autorizado e os mesmos downloads passaram.
- Persistência de arquivos é LOCAL. Um deploy futuro exige armazenamento privado durável; não considerar esse adaptador pronto para filesystem efêmero de produção. Nenhum deploy foi realizado.

| Campo desta continuação | Resultado |
| --- | --- |
| V2 PARA REVISÃO | PASS — não aprovada |
| WORD COM 66 IMAGENS | PASS |
| PDF CORRESPONDE AO WORD | PASS — exportação nativa, 70 páginas |
| TAMANHO PDF | PASS — abaixo de 8 MiB |
| DOWNLOAD AUTENTICADO PDF/DOCX | PASS — HTTP 200 e bytes/hashes iguais aos arquivos conferidos |
| V1 / EVIDÊNCIAS / SENT / FAILED PRESERVADOS | PASS — leitura real |
| PDF COMPLETO NO PROVIDER | PASS somente em testes mockados |
| E-MAIL REAL V2 / RECEBIMENTO / VERSÃO CORRETA | NÃO VALIDADO — nenhum novo envio |
| SEGREDOS EM CÓDIGO/DOCS/SCRIPTS | PASS — busca de padrões de chave Resend/token Google: zero arquivos; .env.local e .artifacts ignorados |
| lint | PASS — exit code 0 |
| typecheck | PASS — exit code 0 |
| tests | PASS — exit code 0 |
| test count | 152 testes, 14 arquivos; todos os provedores de e-mail/OpenAI mockados |
| build | PASS — exit code 0 |
| OPENAI CALLS | 0 |
| OPENAI COST | US$ 0 |
| NOVOS E-MAILS | 0 |
| GIT ADD / COMMIT / PUSH / DEPLOY | NÃO EXECUTADOS |

Nota de segurança: um diagnóstico auxiliar de criação de custom token falhou por IAM Credentials API desabilitada e o SDK imprimiu um objeto de erro com token temporário do Google nos logs da tarefa. Nenhuma API foi habilitada, segredo Resend exibido ou token gravado em código/relatório. O diagnóstico agora sanitiza erros e utiliza o login QA existente, sem custom token; a verificação de downloads passou. Não compartilhar os logs brutos dessa tentativa. Essa ressalva não deve ser confundida com ausência de vazamentos em todos os logs históricos.

## Continuação — base Marina Alves e correção parcial das exportações

A usuária confirmou Marina Alves como base. Nenhuma chamada OpenAI real, novo envio de e-mail, gravação de minuta/aprovação no Firebase, commit, push ou deploy foi realizado nesta continuação. O envio original SENT e a tentativa anterior FAILED permanecem preservados.

Correções implementadas e verificadas por testes mockados:

- PDF e Word usam a versão selecionada na tela, em vez de exportar silenciosamente a versão mais recente.
- Uma nova entrega de e-mail busca as evidências do caso no servidor, na transação de reserva, e inclui no PDF o índice determinístico dos documentos PROCESSED. Não recebe PDF, conteúdo jurídico ou destino arbitrário do browser.
- Datas não verificáveis, documentos posteriores à criação da minuta ou ausência da seção de documentos bloqueiam a nova entrega com HTTP 409 DRAFT_EVIDENCE_REVISION_REQUIRED. Não geram nova submission nem e-mail.
- Metadados necessários ao índice e seu hash são registrados na nova submission. O hash também participa da chave de idempotência do provedor. Alteração do índice após uma entrega incerta bloqueia retry; replay de SENT/PENDING continua preservando a entrega anterior sem reenvio.
- Documentos apontando a outro caso são recusados. A ordenação tem desempate estável; referências como 08.10 permanecem texto.

**Limites desta correção:** o índice não contém as imagens originais. A geração Word com ZIP continua sendo uma exportação separada, e seu arquivo completo/PDF equivalente ainda não está vinculado como artefato final aprovado do envio. Portanto, a integração do documento completo com imagens NÃO está concluída e NÃO recebeu PASS E2E. O caso real continua com apenas V1 aprovada; nenhuma V2 foi criada ou aprovada automaticamente.

O ZIP original fornecido tem 66 JPGs, 66 PDFs equivalentes e um CSV de organização. O DOCX existente de Marina contém 66 desenhos/imagens, mas ainda usa o corpo da V1. Esses anexos são materiais de QA fornecidos pela usuária e não foram considerados comprovação factual do caso fictício.

A conferência visual pelo renderizador padrão inicialmente foi bloqueada: FileNotFoundError, LibreOffice soffice.exe was not found on PATH. Depois da autorização explícita da usuária, o Microsoft Word instalado abriu o DOCX original em modo somente leitura e gerou uma prévia local de 70 páginas: quatro páginas do corpo V1 e 66 páginas de imagens. Todas as 70 páginas foram renderizadas e inspecionadas visualmente, sem cortes de layout introduzidos pela montagem. Algumas fotografias originais estão inclinadas, giradas ou com nitidez limitada; foram preservadas, sem inventar ou reconstruir seu conteúdo. O hash do arquivo original permaneceu inalterado após a abertura e exportação. Essa validação é de montagem visual, não de adequação jurídica ou de correspondência factual dos anexos ao caso fictício de Marina.

O PDF completo gerado pelo Word tem 13.030.313 bytes, acima do limite atual de 8 MiB do envio. Não foi enviado nem utilizado para substituir um artefato aprovado; o limite não foi aumentado. O DOCX existente continua sendo V1 com anexos de QA do pacote de Nívea, não uma V2 reformulada/aprovada. A vinculação do documento completo aprovado ao anexo de e-mail e sua adequação de tamanho permanecem pendentes. Nenhum novo e-mail, chamada OpenAI ou alteração no Firebase foi realizado nessa conferência.

| Verificação desta continuação | Resultado |
| --- | --- |
| lint | PASS — exit code 0 |
| typecheck | PASS — exit code 0 |
| tests | PASS — exit code 0 |
| test count | 138 testes, 13 arquivos; provedor/rede mockados |
| build | PASS — exit code 0; retomado após a janela de liberação do limite que bloqueou a tentativa anterior |
| página local | PASS — caso aberto no navegador integrado, conteúdo presente, sem erros/warnings de console capturados |
| Word — inspeção visual | PASS — Microsoft Word autorizado; 70 páginas conferidas, 66 imagens; original preservado |
| PDF completo — limite do envio | FAIL — 13.030.313 bytes; excede o limite atual de 8 MiB; nenhum envio realizado |
| documento completo aprovado → PDF do e-mail | NÃO VALIDADO — vinculação de artefato completo ainda pendente |
| nova versão reformulada | NÃO VALIDADO — nenhuma V2 criada nesta continuação |
| novo e-mail | NÃO EXECUTADO — zero tentativas adicionais |

Servidor de desenvolvimento reposto na porta 3000 e página do caso mantida aberta para revisão. A versão enviada anteriormente não foi substituída nem reenviada.

OPENAI CALLS: 0

OPENAI COST: US$ 0

## Resultado atual — única tentativa real concluída

Envio técnico concluído pela interface em 12/09/2026, às 17:14 (horário local). A usuária confirmou recebimento do e-mail, PDF anexado e abertura normal, mas informou que o documento é antigo, sem as evidências e a reformulação esperada. Portanto, a validação E2E do documento final NÃO PASSOU. Nenhuma segunda tentativa, smoke e-mail ou script de envio foi executado.

| Campo | Resultado |
| --- | --- |
| EMAIL PROVIDER | RESEND |
| RESEND PLAN | FREE — confirmado na conta, sem mudança de billing |
| RESEND API KEY | CONFIGURED — checagem somente de presença; valor não exibido |
| RESEND FROM | CONFIGURED — sender de desenvolvimento permitido pela conta |
| SECRET LEAK CHECK | PASS — nenhum padrão de chave encontrado nos arquivos atuais de código/docs/configuração/log pesquisados; `.env.local` explicitamente ignorado |
| SERVER RESTARTED AFTER ENV | YES — instância anterior encerrada com Ctrl+C; novo processo iniciado na porta 3000 |
| TEST MODE | PASS — test, sem modo de protocolo real |
| EXPECTED RECIPIENT | giulia05tomaz@gmail.com — exclusivamente QA |
| PRIMARY RECIPIENT | PASS — TO confirmado nos detalhes da mensagem no Resend |
| APPROVED DRAFT | PASS — caso JF-2026-33442CCB, draft v1, versão 1 atualmente aprovada; confirmação por leitura real no Firestore |
| PDF GENERATED/LOADED | PASS — gerado no servidor a partir do conteúdo persistido aprovado, com validação de assinatura e tamanho antes do envio |
| PDF ATTACHED | PASS técnico — um único anexo `peticao-inicial-JF-2026-33442CCB-v1.pdf`, confirmado no dashboard; recebimento/abertura manual ainda pendentes |
| EMAIL REQUEST | PASS — único POST da UI retornou HTTP 200 |
| RESEND MESSAGE ID | PRESENT — identificador real do dashboard corresponde ao providerMessageId persistido no Firestore |
| RESEND DASHBOARD STATUS | delivered — eventos sent e delivered às 17:14; não equivale à confirmação manual de recebimento |
| SUBMISSION FIRESTORE | PASS — nova submission SENT, provider=resend, providerMessageId e sentAt presentes; conferência real somente por leitura |
| SUBMISSION STATUS | SENT |
| PREVIOUS FAILED SUBMISSION PRESERVED | PASS — registro anterior continua FAILED com EMAIL_NOT_CONFIGURED, sem sentAt ou providerMessageId; aparece no histórico junto à nova tentativa |
| IDEMPOTENCY | PASS técnico — chave do provedor e transação/trava por versão preservadas; testes de replay/concor­rência passaram. Nenhum double submit real realizado |
| CITIZEN CC | PASS — copyEmail confirmado igual ao TO; CC omitido e copyRecipientDeduplicated=true persistido |
| NO GMAIL CREDENTIALS | PASS — nenhum SMTP, senha pessoal ou App Password utilizado |
| NO PAID PLAN | PASS — nenhuma contratação, cartão, upgrade, domínio comprado ou mudança de cobrança |
| REAL EMAIL ATTEMPTS | 1 |
| EMAIL RECEIVED | PASS — confirmação manual da usuária |
| PDF RECEIVED | PASS — confirmação manual da usuária |
| PDF OPENS | PASS — confirmação manual da usuária |
| CORRECT APPROVED VERSION | FAIL para o documento final esperado — foi enviada a V1 aprovada persistida, mas não a versão reformulada/com evidências desejada pela usuária |

### Diagnóstico após a confirmação manual

Checagem real somente por leitura: neste caso existe apenas draft v1, approved=true, currentDraftVersion=1 e approvedVersion=1. O conteúdo da V1 não contém a seção nova DOS DOCUMENTOS E EVIDÊNCIAS. Há 66 evidências com status PROCESSED, mas nenhuma V2 persistida neste caso.

A geração Word com ZIP é um download separado: a rota evidence-package/docx devolve o arquivo gerado, sem registrá-lo como nova versão aprovada. O endpoint de envio utiliza generateDraftPdf(case,draft) sem fornecer evidências; o botão Baixar PDF utiliza generateDraftPdf(case,draft,evidences), que inclui o índice probatório. Há, portanto, separação entre o documento exportado com evidências e o PDF utilizado no envio. Não houve falha de entrega do Resend; a origem/documento final esperado não foi conectado a este envio.

Nenhum código, draft, evidência, aprovação ou anexo foi alterado nesta checagem. Nenhum novo e-mail ou chamada OpenAI foi executado. Correção e novo envio dependem de nova direção/autorização da usuária; o limite anterior de um único envio permanece respeitado.

OPENAI CALLS: 0

OPENAI COST: US$ 0

### Quality — reexecutado antes do envio

| Comando | Resultado |
| --- | --- |
| npm run lint | PASS — exit code 0 |
| npm run typecheck | PASS — exit code 0 |
| npm test | PASS — exit code 0 |
| test count | 124 testes, 12 arquivos |
| npm run build | PASS — exit code 0 |

Testes Resend/transport/provider usam SDK/rede mockados. Nenhum teste automatizado enviou e-mail real. Logs OpenAI de testes são de mocks; nenhuma chamada OpenAI real ocorreu nesta execução.

### Evidência do fluxo real

- Presença das cinco variáveis obrigatórias confirmada sem imprimir segredos; provider, sender, modo e destino esperados conferidos por comparações booleanas.
- A checagem de porta dentro do sandbox não enxergou a instância antiga. A primeira inicialização detectou o PID 3896 e encerrou sem disponibilizar outra instância concorrente. A sessão antiga foi então finalizada de forma limpa com Ctrl+C; novo `npm run dev -- --hostname 0.0.0.0` ficou ativo na porta 3000, carregando `.env.local` atualizado.
- CLI agent-browser indisponível; usado navegador integrado. `/app` carregou com cidadão QA autenticado, sem página vazia, overlay ou erros/warnings de console registrados. Navegação ao caso aprovado funcionou.
- Interface percorreu alteração → Não, continuar → confirmação de e-mail → checkbox → Confirmar envio de teste. Nenhuma alteração de petição, versão, evidência ou status jurídico foi feita.
- Estado Enviando documento... observado imediatamente após o único clique; a resposta HTTP 200 veio em 822 ms. Interface exibiu Envio de teste realizado e o histórico mostrou nova tentativa Enviado, mantendo a anterior Falhou.
- Assunto confirmado: `[JusFácil — TESTE] Petição Inicial — JF-2026-33442CCB`. Corpo e preview informam versão 1, ambiente de teste e ausência de protocolo judicial real. Dashboard confirma exatamente um anexo PDF e não mostra CC duplicado.
- Leitura real do Firestore confirmou case.status=MINUTA_APROVADA, currentDraftVersion=1, approvedVersion=1, draft aprovado e pertencente ao caso. A nova submission tem status SENT e a anterior permanece FAILED. O providerMessageId real coincide com o identificador do Resend.
- Nenhum dado jurídico, evidência, conta, projeto, chave anterior ou tentativa antiga foi excluído. Nenhum git add, commit, push, deploy ou ajuste de billing. Servidor permanece rodando para revisão local.

### Próximo passo único: confirmação da usuária

Verificar giulia05tomaz@gmail.com (incluindo Spam/Lixo eletrônico, se necessário) e confirmar: o e-mail chegou; assunto contém TESTE; PDF anexado; PDF abre; arquivo corresponde à versão 1 APPROVED do caso JF-2026-33442CCB. Não reenviar enquanto aguarda. Mesmo delivered no Resend não autoriza marcar EMAIL RECEIVED/PDF OPENS como PASS sem essa confirmação.

## Histórico das etapas anteriores — estados abaixo não são o resultado atual

## Última execução — bloqueada antes do envio

Após a solicitação de continuar, a checagem somente de presença no workspace `work/jusfacil` encontrou RESEND_API_KEY_PRESENT = false. A leitura de ambiente pelo loader do Next e a checagem da atribuição salva em disco concordaram: há uma atribuição RESEND_API_KEY, mas ela está vazia. Não foi mostrado, copiado ou movido qualquer valor de chave. Não há uma chave salva no `.env.example`.

EMAIL_PROVIDER_PRESENT: YES

RESEND_API_KEY_PRESENT: NO

RESEND_FROM_PRESENT: YES

FORUM_SUBMISSION_MODE_PRESENT: YES

FORUM_TEST_RECIPIENT_PRESENT: YES

Provider resend, sender esperado, modo test e destinatário giulia05tomaz@gmail.com foram confirmados por comparações booleanas. Pacote oficial instalado e `.env.local` explicitamente ignorado pelo Git. Auditoria de padrões de chaves em arquivos de código/documentação/configuração/log pesquisados: SECRET LEAK CHECK: PASS, sem imprimir conteúdo ou valores encontrados.

SERVER RESTARTED AFTER ENV: NO — bloqueado antes do início; nenhuma instância escutava na porta 3000 na checagem.

REAL EMAIL ATTEMPTS: 0

EMAIL REQUEST: FAIL — configuração necessária ausente; nenhum request de envio executado.

RESEND MESSAGE ID: ABSENT

RESEND DASHBOARD STATUS: NÃO VALIDADO nesta execução.

SUBMISSION FIRESTORE: NÃO VALIDADO nesta execução — nenhuma nova tentativa criada, nenhuma tentativa anterior alterada/excluída.

SUBMISSION STATUS: NÃO APLICÁVEL — sem nova tentativa real; não foi inventado SENT ou FAILED.

EMAIL RECEIVED / PDF RECEIVED / PDF OPENS / CORRECT APPROVED VERSION: AGUARDANDO CONFIRMAÇÃO MANUAL, somente após desbloquear e realizar o único envio autorizado.

OPENAI CALLS: 0

OPENAI COST: US$ 0

Quality gates: não reexecutados nesta execução bloqueada; os resultados PASS e 124 testes abaixo pertencem à validação técnica anterior. Nenhum código, API, tela, PDF, evidência, aprovação, billing, Git ou serviço de e-mail foi alterado nesta execução. Próximo passo: salvar manualmente RESEND_API_KEY no `.env.local` exato deste workspace e confirmar; depois reiniciar servidor, executar os gates e realizar somente uma tentativa pela interface.

## Atualização — conexão ao SDK oficial Resend

SDK oficial `resend` 6.28.0 instalado; package.json e lockfile atualizados. Abstração existente preservada. Nenhuma tela, etapa de confirmação, regra de aprovação, geração de PDF, evidência, chamada JurisBot ou botão advogado foi redesenhado/refeito.

A conta Resend foi autenticada pela usuária e verificada no Chrome como giulia05tomaz@gmail.com. Settings/Usage identifica o plano transacional Free. O onboarding oferece onboarding@resend.dev para o envio de teste à própria conta. Foi criada uma única chave `JusFacil Local Development`, com permissão Sending access, sem excluir chaves ou alterar billing. A chave foi copiada pelo botão do Resend e a janela View API Key foi mantida aberta para a usuária salvar manualmente em `.env.local`; seu valor não foi impresso nem fotografado. RESEND_FROM foi configurado como `JusFácil <onboarding@resend.dev>`. Não foi executado smoke e-mail, script de envio ou tentativa real pela UI.

| Campo solicitado | Resultado atual |
| --- | --- |
| EMAIL PROVIDER | RESEND |
| RESEND PLAN | FREE — confirmado em Settings/Usage, sem alteração de plano |
| RESEND API KEY | NOT CONFIGURED |
| RESEND FROM | CONFIGURED — remetente de desenvolvimento oferecido pelo onboarding da conta |
| TEST MODE | PASS — ambiente configurado test; demais modos bloqueados nos testes |
| EXPECTED RECIPIENT | giulia05tomaz@gmail.com — exclusivamente QA |
| PRIMARY RECIPIENT | PASS técnico — TO server-side e contrato do SDK testados; envio real pendente |
| APPROVED PDF | PASS técnico — versão persistida, atual e aprovada; conteúdo/validações testados com mocks |
| PDF ATTACHED | PASS técnico — um único PDF, Buffer não vazio; contrato do SDK testado. Anexo real não validado |
| EMAIL REQUEST | FAIL — nenhuma requisição real de envio foi executada; bloqueado por configuração segura |
| RESEND MESSAGE ID | ABSENT — nenhum ID real |
| SUBMISSION FIRESTORE | FAIL para envio real — SENT/FAILED/PENDING passaram com mocks; nova gravação real não executada |
| SUBMISSION STATUS | NÃO VALIDADO — nenhuma nova tentativa real criada; não seria correto inventar SENT ou FAILED |
| PREVIOUS FAILED SUBMISSION PRESERVED | PASS técnico — nenhuma exclusão/mutação real realizada; teste confirma que retry cria nova submission e conserva FAILED. Registro anterior específico não conferido nesta execução |
| IDEMPOTENCY | PASS técnico — preservada no Firestore e passada como opção idempotencyKey do SDK |
| NO GMAIL CREDENTIALS | PASS — nenhum SMTP, senha pessoal ou App Password utilizado |
| NO PAID PLAN | PASS — nenhuma contratação, cartão, domínio comprado ou alteração de billing |
| EMAIL DASHBOARD STATUS | NÃO VALIDADO — conta autenticada, mas nenhuma mensagem real criada |
| EMAIL RECEIVED | AGUARDANDO CONFIRMAÇÃO MANUAL — envio ainda bloqueado; nenhum recebimento afirmado |
| PDF RECEIVED | AGUARDANDO CONFIRMAÇÃO MANUAL — envio ainda bloqueado |
| PDF OPENS | AGUARDANDO CONFIRMAÇÃO MANUAL — a usuária deverá abrir o anexo recebido |
| CORRECT APPROVED VERSION | AGUARDANDO CONFIRMAÇÃO MANUAL — comparar o anexo recebido à versão APPROVED |

OPENAI CALLS: 0

OPENAI COST: US$ 0

### Configuração segura e restrição de desenvolvimento

Variáveis de servidor utilizadas: EMAIL_PROVIDER, RESEND_API_KEY, RESEND_FROM, FORUM_SUBMISSION_MODE e FORUM_TEST_RECIPIENT. O exemplo contém somente placeholders, e `.env.local` está explicitamente no `.gitignore`. RESEND_API_KEY ainda está vazio, aguardando cópia manual pela usuária; remetente, modo e destinatário QA estão configurados. Não há fallback para EMAIL_FROM antigo nem remetente inventado.

O [sender de desenvolvimento resend.dev](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain) restringe destinatários ao e-mail associado à conta Resend. Para usar `JusFácil <onboarding@resend.dev>` neste teste, deve ser confirmado que a conta permite envio para giulia05tomaz@gmail.com. Se exigir domínio próprio verificado ou bloquear esse destino, parar com BLOCKED — RESEND SENDER/DOMAIN RESTRICTION / BLOCKED — VERIFIED DOMAIN REQUIRED, conforme o motivo. Nenhuma tentativa de contorno, compra de domínio ou migração para Gmail autorizada.

CC igual ao TO é omitido pelo provider, comparando sem diferença de maiúsculas/minúsculas. O registro server-side inclui copyRecipientDeduplicated e provider=resend. CC diferente continua utilizando o endereço confirmado na interface. Não alterar a conta Firebase QA para realizar esse ajuste.

O SDK fornece a serialização e `emails.send` com attachment Buffer, text/html e idempotencyKey. O transporte público do SDK é especializado para manter timeout de 20 segundos e impedir o logging de respostas brutas que a versão atual faz em desenvolvimento. Erros de sender/domínio são sanitizados e não geram retry/fallback automático. A mensagem de falha é “Não foi possível enviar o e-mail de teste.”

Testes do adapter mockam o SDK Resend. Testes do transporte também mockam SDK e fetch. Todos os testes automatizados permanecem sem envio real; nenhuma credencial real é carregada por eles. Estados Enviando/Enviado/Falhou continuam cobertos pelos testes de componentes existentes, sem mudança de layout. As quatro medições de responsividade da validação anterior permanecem documentadas abaixo; não houve validação visual de um resultado SENT real nesta atualização.

### Auditoria e próximo passo

Auditoria local sem imprimir valores: nenhum padrão de chave Resend encontrado em arquivos de código/documentação/configuração versionáveis pesquisados; `.env.local` ignorado. Nenhuma credencial foi salva no Git, README, relatório, logs ou screenshot.

O npm install informou 24 vulnerabilidades no conjunto de dependências (19 moderate, 4 high, 1 critical). Não foi aplicado npm audit fix/force nem feita atualização ampla fora do escopo; esse aviso não significa que todas as vulnerabilidades sejam do Resend.

Próximo passo obrigatório: a usuária salva a chave já criada manualmente somente em `.env.local`, no campo RESEND_API_KEY. Nenhuma chave deve ser enviada pelo chat. Após configuração segura, realizar UMA tentativa pela interface, confirmar status técnico no dashboard e pedir confirmação manual do e-mail, assunto TESTE, PDF anexado, abertura e versão correta. Não reenviar automaticamente se não aparecer na caixa principal; verificar Spam.

## Validação técnica do fluxo existente

Implementação técnica concluída. Teste de envio real bloqueado por ausência de configuração segura do provedor e de endereço válido para a cópia do cidadão QA. Nenhum e-mail real foi enviado nesta execução.

## Critério de evidência

PASS técnico significa implementação verificada por testes automatizados com provedor de e-mail mockado. Não significa entrega real de e-mail ou gravação real de uma tentativa de envio no Firestore. A validação interativa utilizou o caso QA existente `JF-2026-33442CCB`, versão aprovada 1, sem modificar minutas ou evidências.

| Item | Resultado | Evidência / limite |
| --- | --- | --- |
| CTA AFTER APPROVAL | PASS | Seção persistente e versão atualmente aprovada; confirmada ao reabrir o caso real. |
| JURISBOT CTA | PASS | Mensagem determinada pela aplicação; ações acionam o mesmo componente, sem chamada OpenAI. Teste de integração da interface. |
| CHANGE BEFORE SENDING | PASS | Encaminha ao campo de revisão existente; foco em `draft-feedback` confirmado no navegador. Não modifica a versão aprovada nem envia e-mail. Nova geração não executada nesta validação. |
| EMAIL CONFIRMATION | PASS | E-mail inicial da conta Firebase, edição, trim, obrigatoriedade, formato e limite de 254 caracteres; validação cliente e servidor. |
| TEST DISCLAIMER | PASS | Aviso completo na confirmação e ressalva explícita de que não há protocolo judicial. |
| ACKNOWLEDGMENT | PASS | Checkbox obrigatório; bloqueio confirmado no navegador e validação estrita no servidor testada. |
| FIREBASE AUTH | PASS | Bearer e verifyIdToken; GET de histórico autenticado retornou 200 no ambiente Firebase real. POST sem token/credencial inválida testado com mocks. |
| CASE OWNERSHIP | PASS | Validação server-side de cidadão responsável e role CITIZEN; usuário errado e cross-case bloqueados nos testes. GET real autorizado para o cidadão QA. |
| APPROVED DRAFT | PASS | Busca server-side no Firestore; exige pertencimento ao caso e versão atualmente aprovada. Modelo existente: `approved === true`. Bloqueios testados com mocks. |
| PDF | PASS | PDF não vazio, assinatura PDF e limite de 8 MiB; gerado pelo gerador existente a partir da versão persistida. Conteúdo correto V2 testado; nenhum arquivo individual de evidência anexado. Entrega real não validada. |
| SUBMISSION API | PASS | POST e GET em `/api/cases/[caseId]/submission/test-email`; body estrito, sem destino, PDF ou conteúdo jurídico arbitrário fornecido pelo cliente. |
| SUBMISSION FIRESTORE | FAIL | PENDING/SENT/FAILED e leitura do histórico passaram com Firestore mockado. GET real passou, mas nenhuma tentativa real foi criada: persistência de envio real permanece não validada. |
| TEST MODE | PASS | Qualquer modo diferente de `test` é recusado com SUBMISSION_MODE_DISABLED. Nenhum modo de protocolo real implementado. |
| TEST RECIPIENT | CONFIGURED | Configurado somente como destinatário QA em variável server-side de `.env.local`. |
| EXPECTED TEST RECIPIENT | giulia05tomaz@gmail.com | Endereço de teste; não pertence nem representa instituição judicial. |
| CITIZEN CC | PASS | CC utiliza o e-mail confirmado e validado; contrato do provedor testado com mocks. Recebimento real não validado. |
| EMAIL PROVIDER | Resend — CONFIGURAÇÃO PARCIAL | Adaptador central com SDK oficial; remetente configurado, API key ainda pendente de cópia manual. Nenhum serviço contratado ou plano alterado. |
| EMAIL SENT | FAIL | BLOQUEADO POR CONFIGURAÇÃO SEGURA DO PROVEDOR. Zero envios reais; não houve resposta real do provedor. |
| EMAIL RECEIVED | AGUARDANDO CONFIRMAÇÃO MANUAL | Não enviado; recebimento não validado. O envio real precisa ser desbloqueado primeiro. |
| COPY RECEIVED | AGUARDANDO CONFIRMAÇÃO MANUAL | Não enviado; confirmar um e-mail válido na UI. Se for igual ao TO, CC é omitido sem erro. |
| IDEMPOTENCY | PASS | Transação Firestore, vínculo da chave ao payload e trava por versão; replay e tentativas concorrentes com chaves iguais/diferentes testados. |
| DOUBLE CLICK | PASS | Trava síncrona na interface, loading e botão desabilitado; backend deduplica independentemente da UI. Testes automatizados. |
| FAILED STATE | PASS | Falha do provedor persiste FAILED e nunca exibe SENT; mensagens não expõem credenciais ou resposta bruta do provedor. Testes com mocks. |
| RETRY | PASS | Nova tentativa explícita gera nova chave e preserva a anterior. Entrega incerta exige as restrições de segurança descritas abaixo. Testes com mocks. |
| NO REAL COURT RECIPIENT | PASS | Nenhuma pesquisa, integração ou envio judicial. Destino vem exclusivamente do servidor, com modo de teste obrigatório. |
| LAWYER BUTTON | PASS | Visível com badge Em breve; clique mostra apenas informação, sem backend. Testado na interface e no navegador. |
| LAWYER FEATURE | NOT IMPLEMENTED — EM BREVE | Nenhum marketplace, busca, contratação, pagamento ou perfil novo. |

OPENAI CALLS: 0

OPENAI COST: US$ 0

## Quality

| Comando | Resultado |
| --- | --- |
| npm run lint | PASS — exit code 0 |
| npm run typecheck | PASS — exit code 0 |
| npm test | PASS — exit code 0 |
| test count | 124 testes, 12 arquivos; 8 testes adicionais nesta atualização Resend |
| npm run build | PASS — exit code 0 |

O esbuild não conseguiu iniciar os testes dentro do sandbox. Os mesmos testes foram executados com permissão ampliada e passaram; o bloqueio inicial não foi ocultado. Todos os testes de e-mail utilizaram mocks. Nenhum teste automatizado enviou e-mail real ou chamou OpenAI real.

## Responsividade e navegador

Seção de escolha e confirmação verificadas no navegador com sessão Firebase real. Medidas DOM não apresentaram elementos horizontais excedendo a viewport.

| Viewport | Resultado | Largura do documento |
| --- | --- | --- |
| 375 × 812 | PASS | 370 px |
| 390 × 844 | PASS | 385 px |
| 768 × 1024 | PASS | 762 px |
| 1440 × 900 | PASS | 1434 px |

Também verificados: identidade visual preservada, checkbox habilitando/desabilitando confirmação, botão advogado informativo, retorno ao campo de revisão e persistência dos CTAs após reabrir o caso. A viewport temporária de teste foi restaurada. Loading, double click, falha, retry e remount do histórico foram verificados nos testes de componentes. Não foi clicado o botão final de envio no ambiente real.

## Segurança de entrega e idempotência

- Há uma trava server-side por versão para impedir novos envios após SENT, inclusive com outra chave, aba ou dispositivo.
- PENDING é reservado antes da chamada ao provedor; tentativas concorrentes retornam o registro existente.
- Falha confirmada permite nova tentativa explícita, sem apagar o histórico.
- Falha com entrega incerta só permite retry com o mesmo payload e chave do provedor dentro de uma janela conservadora de 23 horas. Fora dessa janela, ou se o payload mudar, exige confirmação manual. A [documentação do Resend](https://resend.com/docs/dashboard/emails/idempotency-keys) informa retenção de chaves por 24 horas.
- Se o provedor aceitar o e-mail e a gravação final falhar, o registro permanece PENDING; não há reenvio automático. É necessária reconciliação manual antes de qualquer nova entrega.
- PDF estabilizado para retries seguros; somente a petição aprovada é anexada, não as evidências individuais.
- Segredos ficam somente server-side em `.env.local`, ignorado pelo Git. Nenhuma chave foi adicionada ao código, relatório ou exemplo de ambiente.

## Pendências para o único teste real autorizado

1. Autenticar a conta Resend gratuita; confirmar o sender permitido e configurar RESEND_FROM e RESEND_API_KEY exclusivamente no ambiente local server-side. Não enviar segredos pelo chat. EMAIL_PROVIDER está definido como resend. Caso seja necessário contratar serviço ou alterar billing, parar essa etapa.
2. Confirmar um endereço válido para CC do cidadão QA; o e-mail example.com atual não é uma caixa de recebimento de teste. Pode confirmar giulia05tomaz@gmail.com na UI: nesse caso, o provider omite CC duplicado e mantém TO como o destino obrigatório.
3. Após a configuração e os mocks já aprovados, realizar somente uma entrega da petição aprovada do caso QA ao destinatário de teste configurado. Se funcionar, não repetir.
4. Confirmar TO, CC, anexo da versão correta e registro SENT real no Firestore. Somente então marcar EMAIL SENT como PASS.
5. Confirmar recebimento real no destino e na cópia. Sem acesso à caixa de entrada, registrar AGUARDANDO CONFIRMAÇÃO MANUAL; resposta do provedor não comprova recebimento.

Nenhum commit, git add, push ou deploy realizado. Nenhum status jurídico do caso alterado por envio de teste. Nenhuma conta, chave, projeto, evidência, minuta ou dado QA foi excluído. Nenhuma alteração de billing.
