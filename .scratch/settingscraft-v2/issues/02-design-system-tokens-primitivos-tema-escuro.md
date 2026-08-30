# 02 — Design system: tokens, primitivos e tema escuro

**What to build:** O jogador passa a olhar para uma interface escura e coesa em vez das três linguagens visuais concorrentes de hoje (coral, turquesa, card escuro sobre fundo claro). Tema escuro único, derivado do azul-escuro que o card de resultado já usa, com um acento só — legível em ambiente de jogo.

Por baixo, a folha achatada única dá lugar a camadas: tokens (cores, espaçamentos, tipografia, raios) e primitivos reutilizáveis, com as folhas de estilo de tela consumindo os tokens. A tela existente é migrada para essa base no mesmo ticket — o design system só está pronto quando alguém o usa.

A documentação de convenções do projeto descreve hoje a convenção de folha única que este ticket substitui, e é atualizada no mesmo commit. Documentação que contradiz o código é pior que documentação ausente.

**Blocked by:** 01 — Limpeza do template e portões de qualidade.

**Status:** done

- [x] Tokens de cor, espaçamento, tipografia e raio declarados num lugar só
- [x] Primitivos reutilizáveis cobrem os elementos que a tela usa hoje
- [x] Tema escuro único aplicado; nenhuma superfície clara sobrou
- [x] A tela atual renderiza pelos tokens e primitivos, sem estilo inline e sem folha achatada
- [x] `AGENTS.md` e `CLAUDE.md` descrevem a nova camada de estilo, sem menção à convenção antiga
- [x] Lint e verificação de tipos limpos
