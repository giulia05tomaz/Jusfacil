# Segurança antes de publicar

Esta cópia foi preparada sem arquivos locais de ambiente, credenciais, chaves privadas, dependências, builds ou logs.

Antes de executar localmente:

1. Copie `.env.example` para `.env.local`.
2. Preencha as variáveis somente no `.env.local` local.
3. Mantenha credenciais Firebase Admin fora da pasta do projeto e use `GOOGLE_APPLICATION_CREDENTIALS`.
4. Crie uma nova chave OpenAI e salve-a somente como `OPENAI_API_KEY` server-side. Nunca use `NEXT_PUBLIC_OPENAI_API_KEY`.
5. Não reutilize a chave OpenAI anteriormente compartilhada em uma conversa; revogue-a na plataforma.
6. Revise `git status` e execute uma busca de segredos antes de cada push.

Arquivos que nunca devem ser adicionados ao Git incluem `.env.local`, service accounts JSON, arquivos PEM, logs, `node_modules` e `.next`.

