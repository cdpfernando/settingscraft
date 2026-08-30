# 11 — Histórico: repositório, tela e navegação em Stack

**What to build:** O jogador reencontra consultas que fez antes. O cabeçalho dá acesso a uma tela de histórico que lista as consultas anteriores; abrir uma mostra o resultado completo, sem refazer a busca. O histórico sobrevive ao fechamento do app.

Navegação em Stack com cabeçalho configurado — duas telas em relação hierárquica não justificam abas, e as dependências de abas herdadas do template já saíram no ticket 01.

**Blocked by:** 09 — Cache local persistente como primeira fonte.

**Status:** resolved

- [x] Tela de histórico acessível a partir do cabeçalho da tela principal
- [x] Lista mostra as consultas anteriores com o suficiente para identificá-las
- [x] Abrir um item exibe o resultado completo, sem nova chamada
- [x] Histórico persiste entre execuções do app
- [x] Acesso ao armazenamento atrás do repositório encapsulado
- [x] Navegação em Stack com cabeçalho configurado; nenhuma navegação por abas

## Comments

Implementado reaproveitando o mesmo armazenamento do cache local (09): cada registro agora guarda `{ consulta, resultado }` em vez de só `resultado`, e `RepositorioCacheLocal` ganhou `listar()` (via `AsyncStorage.getAllKeys` + `multiGet`, filtrando pelo prefixo de chave). Isso elimina a necessidade de um índice separado — histórico e cache são a mesma fonte de dados, lidos de duas formas.

`app/historico.tsx` é a segunda tela da Stack (título dinâmico via `Stack.Screen options`), acessível pelo botão "Histórico" no `headerRight` de `app/index.tsx`. Abrir um item troca para uma visão de detalhe local (sem navegação em pilha adicional, mantendo as "duas telas" da spec) reaproveitando `ResultadoCard`, extraído de `app/index.tsx` para `components/resultado-card.tsx` para não duplicar a renderização do card entre as duas telas.
