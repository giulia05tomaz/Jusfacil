# Relatório — autenticação do inspect ZIP

## Correção aplicada

O inspect ZIP agora segue o mesmo padrão de autenticação do JurisBot: exige `Authorization: Bearer <token>`, valida formato JWT, executa `verifyIdToken` pelo Admin já existente e diferencia falha de autenticação, falta de configuração do Admin, ownership, caso inexistente e ZIP inválido. O retry de token continua sendo feito somente no cliente e somente para HTTP 401, uma única vez, com `getIdToken(true)`.

Também foram adicionados logs seguros `zip_auth_debug` com apenas flags e resultado (`true/false/PASS/FAIL`), sem token, e-mail ou credenciais. O FormData continua sem `Content-Type` manual.

## Resultado local observado

Foi feito um request sem Authorization ao endpoint real:

- endpoint: `/api/cases/[caseId]/evidence-package/inspect`
- método: POST
- status: `401`
- resposta: `AUTH_REQUIRED` / `Sua sessão não pôde ser validada. Entre novamente.`

Isso confirma que a rota não mascara uma requisição sem token como erro de ZIP. Não foi possível executar um request autenticado nesta sessão porque o navegador automático está indisponível e o workspace não possui credenciais Admin funcionais para emitir/verificar um usuário QA real.

## Status

| Item | Status |
|---|---|
| ROOT CAUSE live | NÃO VALIDADO — ausência de sessão/credencial real nesta execução |
| ENDPOINT | PASS — inspect identificado |
| CURRENT USER | NÃO VALIDADO |
| TOKEN OBTAINED | NÃO VALIDADO |
| AUTH HEADER | PASS no código; NÃO VALIDADO no browser autenticado |
| BEARER | PASS no código |
| FORMDATA CONTENT-TYPE | PASS — navegador define boundary |
| VERIFY ID TOKEN | NÃO VALIDADO com token real |
| CASE OWNERSHIP | PASS no código; NÃO VALIDADO live |
| FIRST REQUEST | HTTP 401 sem Authorization, conforme esperado |
| FORCE REFRESH REQUIRED | NÃO — só ocorre após 401 |
| RETRY | PASS no código, limitado a uma tentativa |
| FINAL ZIP INSPECT | NÃO VALIDADO autenticado |
| MANIFEST | PASS local — fixture produz 66 |
| EVIDENCE COUNT | 66 local / live não testado |
| OPENAI CALLS | 0 |
| lint | PASS |
| typecheck | PASS |
| tests | NÃO VALIDADO — bloqueio do esbuild/Vitest |
| build | PASS |

Nenhum processamento ZIP confirmado foi iniciado e nenhuma chamada OpenAI foi realizada.

## Diagnóstico definitivo desta rodada

- `NEXT_PUBLIC_FIREBASE_*`: CONFIGURED; projeto cliente confere com `jusfacil-b979b`.
- `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL` e `FIREBASE_ADMIN_PRIVATE_KEY`: ausentes no workspace.
- `GOOGLE_APPLICATION_CREDENTIALS`: variável declarada, mas o arquivo apontado não está disponível neste ambiente.
- Consequência: não foi possível executar `verifyIdToken` com um token real. O 401 observado sem Authorization é esperado; a causa do 401 autenticado não pode ser provada sem o processo Next iniciado com a credencial real.
- O endpoint agora diferencia essa indisponibilidade de configuração como HTTP 503, em vez de mascará-la como sessão expirada.

Para concluir a prova live, é necessário iniciar um novo terminal com a variável `GOOGLE_APPLICATION_CREDENTIALS` funcional (sem expor o valor), autenticar o cidadão QA e repetir apenas **Revisar evidências**. O resultado esperado é HTTP 200 e manifest com 66 itens.
