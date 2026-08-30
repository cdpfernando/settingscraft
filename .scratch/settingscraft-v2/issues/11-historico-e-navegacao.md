# 11 — Histórico: repositório, tela e navegação em Stack

**What to build:** O jogador reencontra consultas que fez antes. O cabeçalho dá acesso a uma tela de histórico que lista as consultas anteriores; abrir uma mostra o resultado completo, sem refazer a busca. O histórico sobrevive ao fechamento do app.

Navegação em Stack com cabeçalho configurado — duas telas em relação hierárquica não justificam abas, e as dependências de abas herdadas do template já saíram no ticket 01.

**Blocked by:** 09 — Cache local persistente como primeira fonte.

**Status:** ready-for-agent

- [ ] Tela de histórico acessível a partir do cabeçalho da tela principal
- [ ] Lista mostra as consultas anteriores com o suficiente para identificá-las
- [ ] Abrir um item exibe o resultado completo, sem nova chamada
- [ ] Histórico persiste entre execuções do app
- [ ] Acesso ao armazenamento atrás do repositório encapsulado
- [ ] Navegação em Stack com cabeçalho configurado; nenhuma navegação por abas
