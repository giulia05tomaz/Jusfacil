# Relatório — recuperação do Firebase Admin

## Diagnóstico

O processo Next antigo não estava usando uma credencial Admin acessível. A variável persistente do Windows estava disponível no novo processo, enquanto o caminho declarado no `.env.local` apontava para um arquivo inexistente. O servidor antigo foi encerrado e um novo `npm run dev` foi iniciado, herdando a variável persistente correta. Nenhuma variável foi alterada e nenhuma chave foi gerada.

## Resultado

| Item | Status |
|---|---|
| GOOGLE_APPLICATION_CREDENTIALS | PRESENT |
| CREDENTIAL FILE | FOUND |
| FILE EXISTS | YES |
| NEW KEY GENERATED | NO |
| ADMIN INITIALIZATION | PASS — confirmado no processo Next novo (`adminInitialized: true`) |
| ADMIN PROJECT | `jusfacil-b979b` — arquivo de credencial confere com o projeto cliente |
| CURRENT USER | NÃO VALIDADO — automação do navegador indisponível |
| TOKEN | NÃO VALIDADO com usuário QA real |
| VERIFY ID TOKEN | NÃO VALIDADO com token real; token sintético foi corretamente rejeitado |
| CASE OWNERSHIP | NÃO CHEGOU |
| ZIP INSPECT | HTTP 401 com token sintético inválido (comportamento esperado) |
| MANIFEST | NÃO CHEGOU |
| SESSION ERROR | NÃO VALIDADO no browser autenticado |
| OPENAI CALLS | 0 |
| COST | US$ 0 |

## Evidência segura do servidor

No request de diagnóstico, o novo processo registrou somente flags:

`authHeaderPresent=true`, `bearerPrefixValid=true`, `adminProjectConfigured=true`, `googleApplicationCredentialsPresent=true`, `adminInitialized=true`, `verifyIdToken=FAIL`, `errorCategory=TOKEN_INVALID`.

Isso prova que o header chega ao endpoint e que a inicialização Admin não está mais falhando por ausência de credencial. O token sintético não pode passar por `verifyIdToken`, como esperado.

## Próximo passo manual

Com o servidor novo em [http://localhost:3000](http://localhost:3000):

1. Faça login com o cidadão QA.
2. Abra o caso existente e vá para **Evidências**.
3. Selecione `Evidencias_Peticao_Nivea_Organizadas.zip`.
4. Clique apenas em **Revisar evidências**.
5. Confirme HTTP 200 e manifest com 66 itens (`01`, `01.1`, `08.10`, `16`). Não clique em **Confirmar e analisar** ainda.

## Quality gates

- lint: PASS
- typecheck: PASS
- tests: NÃO VALIDADO — Vitest bloqueado pelo erro de acesso do esbuild antes da execução
- build: PASS
