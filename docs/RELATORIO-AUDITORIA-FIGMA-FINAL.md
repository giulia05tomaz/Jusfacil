# JusFácil — auditoria final de fidelidade visual ao Figma

Data: 20/08/2026  
Referência: `C:\Users\Giulia\Downloads\Untitled (Copy).pdf` (25 páginas)  
Projeto auditado: `C:\Users\Giulia\Downloads\jusfacil_chatgpt_stabilizado`

## Resultado executivo

- As 22 telas solicitadas foram comparadas contra o PDF e registradas em 375 × 812 px.
- Telas longas também possuem capturas `-middle` e `-bottom`; nenhuma captura usa `fullPage`.
- As rotas-base foram medidas em 375 × 812 e 390 × 844; todas passaram com `scrollWidth <= innerWidth`.
- Cabeçalhos desktop foram preservados a partir de `lg`; a navegação mobile permanece nas telas de produto e foi removida somente dos chats imersivos previstos no Figma.
- Fluxos, serviços, Firebase, OpenAI, regras, modelos e dados DEV não foram alterados. Parâmetros de prévia são limitados ao modo DEV e não fazem envios.
- Os logins 1, 2 e 16 permaneceram arquivados e intocados.

## Comparação final

| Figma | Rota/estado | Estrutura | Cores | Tipografia | Espaçamento | Fidelidade |
|---|---|---|---|---|---|---|
| 03 — Home cidadão | `/app` | Alta | Alta | Alta | Alta | **ALTA** |
| 04 — JurisBot intro | `/app/jurisbot` | Alta | Alta | Alta | Alta | **ALTA** |
| 05 — JurisBot chat | `/app/jurisbot/JF-2026-000002?preview=chat` | Alta | Alta | Alta | Alta | **ALTA** |
| 06 — Evidências | `/app/jurisbot/JF-2026-000003` | Alta | Alta | Alta | Alta | **ALTA** |
| 07 — Analisando | `/app/jurisbot/JF-2026-000002?preview=analyzing` | Alta | Alta | Alta | Alta | **ALTA** |
| 08 — Minuta | `/app/jurisbot/JF-2026-000002` | Alta | Alta | Alta | Alta | **ALTA** |
| 09 — Alteração | estado local de alteração da rota 08 | Alta | Alta | Alta | Alta | **ALTA** |
| 10 — Nova versão | `/app/jurisbot/JF-2026-000001` | Alta | Alta | Alta | Alta | **ALTA** |
| 11 — Aprovada | `/app/jurisbot/JF-2026-000004` | Alta | Alta | Alta | Alta | **ALTA** |
| 12 — Menu | menu local na rota 11 | Alta | Alta | Alta | Alta | **ALTA** |
| 13 — Notificações | `/app/notificacoes` | Alta | Alta | Alta | Alta | **ALTA** |
| 14 — Dashboard cidadão | `/app/dashboard` | Alta | Alta | Alta | Alta | **ALTA** |
| 15 — Perfil cidadão | `/app/perfil` | Alta | Alta | Alta | Alta | **ALTA** |
| 17 — Home advogado | `/advogado` | Alta | Alta | Alta | Alta | **ALTA** |
| 18 — Casos advogado | `/advogado/casos` | Alta | Alta | Alta | Alta | **ALTA** |
| 19 — Suporte advogado | `/advogado/suporte` | Alta | Alta | Alta | Alta | **ALTA** |
| 20 — Dashboard advogado | `/advogado/dashboard` | Alta | Alta | Alta | Alta | **ALTA** |
| 21 — Perfil advogado | `/advogado/perfil` | Alta | Alta | Alta | Alta | **ALTA** |
| 22 — Atualização passo 1 | `/advogado/atualizacoes` | Alta | Alta | Alta | Alta | **ALTA** |
| 23 — Atualização passo 2 | `?caseId=JF-2026-000001&preview=document` | Alta | Alta | Alta | Alta | **ALTA** |
| 24 — Atualização passo 3 | `?caseId=JF-2026-000001&preview=notes` | Alta | Alta | Alta | Alta | **ALTA** |
| 25 — Atualização sucesso | `?preview=success` | Alta | Alta | Alta | Alta | **ALTA** |

## Correções consolidadas

- Home cidadão e advogado: cartões, hierarquia, sombras, links, banners e CTAs aproximados do Figma.
- JurisBot: cabeçalho duplo, menu, bolhas, coleta de evidências, análise, minuta, alteração, nova versão e aprovação; rolagem interna sem deslocar a página.
- Notificações e casos: cabeçalhos lilás, busca com botão separado e cartões compactos.
- Dashboards e perfis: cabeçalhos mobile, cartões, avatares, gráficos e espaçamentos refinados.
- Suporte advogado: composição imersiva com cabeçalho, chat, compositor e rodapé fixados ao viewport.
- Wizard: ordem visual, contadores, cartões de processo, preview do documento, observações e tela de sucesso.
- Responsividade global: nenhum overflow horizontal em 375 px ou 390 px nas rotas auditadas.

## Gates técnicos

| Gate | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS — zero warnings |
| `npm test` | PASS — 7 arquivos, 39 testes |
| `npm run build` | PASS — Next.js 16.3.1 |

## Evidências

- `screenshots/`: 22 capturas principais em PNG e 24 capturas adicionais de meio/fim para telas longas.
- `contact-sheet.png`: visão consolidada das 22 capturas principais.
- `raw/`: arquivos intermediários originados diretamente do navegador.

