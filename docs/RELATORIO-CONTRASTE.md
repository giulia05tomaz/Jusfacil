# Relatório de contraste — JusFácil

## Diagnóstico

**Causa raiz:** o projeto usa Tailwind CSS 4 (`@import "tailwindcss"`), mas o CSS global não carregava o `tailwind.config.ts`. As classes `jus-*` usadas pela Home, navegação, botões, cards e JurisBot não eram emitidas no CSS final. O texto branco permanecia renderizado sobre o canvas claro, ficando praticamente invisível até ser selecionado.

Correção aplicada: `@config "../../tailwind.config.ts"` em `src/app/globals.css`. Nenhum layout, rota, API, fluxo de dados, Firebase ou OpenAI foi alterado.

Também foram corrigidos somente contrastes de estados existentes: texto petróleo em superfícies caramelo, variante de texto caramelo escuro para superfícies claras, placeholders/ícones `slate-500/600` e estado disabled/loading visível nos botões.

## Validação visual

| Área | Status | Evidência |
|---|---|---|
| Home cidadão — 375×812 | PASS | `docs/screenshots/contrast-home-mobile.png` |
| Home cidadão — 1440×900 | PASS | `docs/screenshots/contrast-home-desktop.png` |
| Dashboard cidadão | PASS | `docs/screenshots/contrast-dashboard-cidadao.png` |
| Perfil cidadão | PASS | `docs/screenshots/contrast-perfil-cidadao.png` |
| Login | PASS | `docs/screenshots/contrast-login.png` |
| JurisBot — 375×812 | PASS | `docs/screenshots/contrast-jurisbot-mobile.png` |
| JurisBot — 1440×900 | PASS | `docs/screenshots/contrast-jurisbot-desktop.png` |
| Home advogado | NÃO VALIDADO | Sessão de advogado existente não disponível; não foi criado usuário nem alterado Firebase. |
| Dashboard advogado | NÃO VALIDADO | Sessão de advogado existente não disponível; não foi criado usuário nem alterado Firebase. |
| Perfil advogado | NÃO VALIDADO | Sessão de advogado existente não disponível; não foi criado usuário nem alterado Firebase. |
| 390×844 e 768×1024 | NÃO VALIDADO | O navegador atingiu o limite de uso após as capturas acima. |

Medições confirmadas na Home após a correção: gradiente `#002B43 → #001D2E`, texto branco em fundo petróleo e botão com texto petróleo em fundo caramelo. Não há overlay de erro e a página contém conteúdo acessível.

## Gates

| Gate | Status |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | NÃO VALIDADO — o Vitest foi bloqueado pelo sandbox ao resolver `vitest.config.ts` (`Access is denied`); não é falha de teste reportada pelo runner. |
| `npm run build` | PASS |
| `NEXT_PUBLIC_UI_DEV_MODE=false` | PASS — não há uso do modo dev nem valor habilitado no ambiente validado. |

## Escopo protegido

OpenAI calls: **0**  
OpenAI cost: **US$ 0**  
Firebase: **sem alterações**  
Dados/casos: **sem criação ou exclusão**  
Git commit/push/deploy: **não executados**
