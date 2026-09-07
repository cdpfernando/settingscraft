# 02 — Política de correspondência do título do jogo

**What to decide:** até onde afrouxar a comparação de títulos de jogo contra o catálogo do FPSHQ. A regra atual exige igualdade do `name` normalizado, e o FPSHQ registra vários jogos pelo nome com a expansão anexada — o título que o jogador digita nunca casa, mesmo com o jogo estando no catálogo.

Junto com isso, o que fazer com as 6 sugestões de hardware do app que continuam sem correspondência mesmo depois da issue `01`, por divergência entre o catálogo do app e o do serviço.

**Blocked by:** Nenhum — mas a issue `01` resolve um problema independente e não precisa esperar por esta.

**Status:** resolved

## O que foi observado

Contra a API real em 2026-09-06:

| Termo informado | Resultados | `name` do slug canônico | Igualdade estrita |
| --- | --- | --- | --- |
| `Cyberpunk 2077` | 7 | `Cyberpunk 2077: Phantom Liberty` (slug `cyberpunk-2077`) | não casa |
| `The Witcher 3` | 1 | `The Witcher 3: Wild Hunt` | não casa |
| `The Witcher 3: Wild Hunt` | 1 | `The Witcher 3: Wild Hunt` | casa |
| `God of War` | 2 | `God of War`, `God of War Ragnarok` | casa, e corretamente |
| `Elden Ring` | 3 | `Elden Ring`, `: Shadow of the Erdtree`, `: Nightreign` | casa, e corretamente |
| `Counter-Strike 2` | 1 | `Counter-Strike 2` (slug `cs2`) | casa |

O padrão é o FPSHQ guardar o título base acrescido de um sufixo de edição ou expansão. `God of War` e `Elden Ring` mostram o outro lado: afrouxar demais passa a casar com uma sequência ou expansão que é outro jogo, com outro desempenho.

## Divergência de catálogo em hardware

Medido em 2026-09-06 rodando as 99 sugestões de `assets/data/hardware.ts` contra `/search`. Removendo o fabricante do termo (o que a issue `01` faz), **48 de 49 placas de vídeo** e **45 de 50 processadores** passam a resolver. Os 6 restantes não são problema de prefixo, e sim de catálogo — a issue `01` não os alcança:

| Sugestão do app | O que o FPSHQ tem | Natureza |
| --- | --- | --- |
| `NVIDIA GeForce GTX 1060` | `GeForce GTX 1060 6GB`, `GeForce GTX 1060 3GB`, `GeForce GTX 1060 Laptop` | existe, dividido por uma spec que o app não pergunta |
| `AMD Ryzen 3 4100` | nada (`count: 0` até buscando só `4100`) | ausente do catálogo |
| `AMD Ryzen 5 4500` | nada | ausente do catálogo |
| `AMD Ryzen 5 8600G` | nada | ausente do catálogo |
| `AMD Ryzen 7 5700G` | nada | ausente do catálogo |
| `AMD Ryzen 7 8700G` | nada | ausente do catálogo |

São dois problemas distintos e nenhum deles se resolve afrouxando a comparação de nome:

- Os 5 Ryzen simplesmente não existem no FPSHQ. Qualquer regra de correspondência continua devolvendo nada. As saídas reais são aceitar a correspondência `parcial` (o que já acontece hoje) ou alinhar o catálogo do app ao do serviço.
- A GTX 1060 existe, mas separada por memória de vídeo — 3GB e 6GB rendem números diferentes, e o app não coleta essa informação. Escolher uma das duas por conta própria seria inventar dado; descartar mantém o comportamento atual.

Vale notar que as 6 Intel Arc que funcionam hoje continuam funcionando depois da issue `01`: `Arc B580` ainda encontra `Intel Arc B580`, porque a busca do FPSHQ casa por substring.

## Espaço de decisão

Nenhuma destas opções está escolhida — cada uma acerta e erra em casos diferentes:

- **Manter a igualdade estrita.** Zero risco de recomendar pelo jogo errado; o jogador precisa digitar o nome exato do catálogo. Mantém "Cyberpunk 2077" e "The Witcher 3" sem evidência.
- **Aceitar prefixo em fronteira de separador.** "The Witcher 3" casaria com "The Witcher 3: Wild Hunt" (candidato único). "Cyberpunk 2077" continua ambíguo (7 candidatos, todos prefixados). "God of War" segue resolvido pela igualdade, que teria precedência.
- **Desempatar pelo slug.** Preferir o resultado cujo slug corresponde ao termo informado — resolve `Cyberpunk 2077` → `cyberpunk-2077`, mas não `Counter-Strike 2` → `cs2`, que só a igualdade de nome resolve.
- **Combinar igualdade, depois slug, depois prefixo único.** Cobre os três casos observados, ao custo de uma cascata de regras dentro do provedor.

## Decisão

Decidido em 2026-09-06 com o mantenedor: **cascata igualdade → slug → título
expandido**, e o hardware sem correspondência fica como está.

A regra vive em `escolherCandidato`, em `provedor-fpshq.ts`. As regras são
tentadas em ordem e **a primeira que alcança algum candidato decide**: um único
candidato resolve, mais de um continua sendo ambiguidade e não resolve nada. Uma
regra que não alcança ninguém passa a vez para a seguinte.

1. **Igualdade** do `name` normalizado — a regra de hoje, mantida na frente.
2. **Slug** igual ao termo informado transformado em slug.
3. **Título expandido**: o `name` começa pelo termo informado e o que sobra
   começa por um separador (`:` ou travessão) seguido de espaço.

O separador é o que separa uma edição de uma sequência. "God of War Ragnarok"
tem espaço, não separador, e por isso nunca é alcançado pela regra 3 — além de a
igualdade já resolver "God of War" antes. O espaço depois do separador também é
obrigatório: sem ele, "Counter" casaria com "Counter-Strike 2".

**As regras 2 e 3 só valem quando a página de resultados não veio cheia.**
`/search` devolve uma página de dez, não o catálogo, e ali "candidato único" não
significa único no catálogo. "Serious Sam" tem uma única edição entre os dez
primeiros e três no catálogo inteiro: sem essa condição, o provedor resolveria
para `serious-sam-the-random-encounter` e entregaria FPS de outro jogo com
confiança `completa`. Numa página cheia, só a igualdade decide.

Como cada caso observado resolve:

| Termo informado | Regra que resolve | Entidade |
| --- | --- | --- |
| `Counter-Strike 2` | igualdade | `cs2` |
| `God of War` | igualdade | `god-of-war-2018` |
| `Elden Ring` | igualdade | `elden-ring` |
| `Cyberpunk 2077` | slug (7 candidatos, todos prefixados) | `cyberpunk-2077` |
| `The Witcher 3` | título expandido (`the-witcher-3-wild-hunt`) | `the-witcher-3-wild-hunt` |
| `Serious Sam`, `Thief`, `Warhammer` | nenhuma: página cheia | descartado |

As demais decisões que o ticket levantava:

- **As regras afrouxadas valem só para o jogo.** No hardware o sufixo é
  fabricante de placa (`ASUS ROG Strix Radeon RX 6600`) ou variante de
  encapsulamento (`Core i5-12400F Box`), que não são edições do mesmo item. Só a
  igualdade — com a remoção do fabricante da issue `01` — vale ali.
- **A evidência não ganha sinalização nova.** `correspondencia` segue
  distinguindo `completa` de `parcial` pela presença do processador, e o schema,
  o prompt e a procedência ficam como estão, como a spec previa. O nome canônico
  do FPSHQ já viaja na evidência: quem vê "Cyberpunk 2077: Phantom Liberty" vê a
  entidade que de fato mediu.
- **Os 5 Ryzen ausentes e a GTX 1060 dividida por memória ficam como estão.** Os
  processadores não existem no catálogo do FPSHQ e nenhuma regra de nome os
  alcança; a correspondência `parcial` já cobre o caso. Escolher entre a GTX 1060
  de 3GB e a de 6GB sem o app perguntar a memória seria inventar dado.
  `assets/data/hardware.ts` não é tocado — ele também alimenta o prompt.

## O que decidir antes de virar tarefa

- [x] Qual regra passa a valer, e em que ordem de precedência.
- [x] O que fazer quando mais de um candidato satisfaz a regra afrouxada — descartar (como hoje) ou desempatar por algum critério.
- [x] Se a regra vale só para jogo ou também para placa de vídeo e processador, onde os sufixos são fabricantes de placa (`ASUS ROG Strix Radeon RX 6600`) e variantes de encapsulamento (`Core i5-12400F Box`), com risco diferente.
- [x] Se uma correspondência afrouxada deve ser sinalizada de forma distinta na evidência, já que hoje `correspondencia` só distingue `completa` de `parcial` pela presença do processador.
- [x] Se o jogador deve saber que a evidência veio de um título ligeiramente diferente do que ele digitou.
- [x] O que fazer com os 5 processadores ausentes do FPSHQ: manter a correspondência `parcial`, ou alinhar `assets/data/hardware.ts` ao catálogo do serviço — sabendo que o catálogo do app também serve ao prompt, não só ao FPSHQ.
- [x] O que fazer com a GTX 1060, dividida por memória de vídeo: descartar como hoje, ou o app passar a distinguir 3GB e 6GB na sugestão.

## Ao virar tarefa

- [x] Os casos das duas tabelas acima viram cenários sobre a massa gravada em `service/testes/massa-fpshq.ts`, incluindo os que devem continuar sendo descartados.
- [x] `God of War` e `Elden Ring` ganham cenário de regressão: a regra nova não pode fazê-los casar com a sequência ou a expansão.
- [x] `npm test`, `npm run lint` e `npm run typecheck` passam.

## Comments

- 2026-09-06: as respostas de `The Witcher 3`, `God of War` e as medições de
  `the-witcher-3-wild-hunt`, `cyberpunk-2077` e `god-of-war-2018` foram gravadas
  da API real e acrescentadas a `service/testes/massa-fpshq.ts`. O slug do
  Witcher é `the-witcher-3-wild-hunt`, não `the-witcher-3` — por isso a regra do
  slug não o alcança e a terceira regra precisa existir.
- 2026-09-06: a resposta de `Cyberpunk 2077` foi conferida contra a API e bate
  literalmente com a que já estava gravada.
- 2026-09-06: com as duas issues, a fixture padrão do repo passa a produzir
  evidência completa ponta a ponta — é o cenário
  `a fixture padrão do repo produz evidência completa ponta a ponta`.
- 2026-09-06: 101 testes passando, `npm run lint` e `npx tsc --noEmit` limpos.
- 2026-09-07: revisão independente encontrou um defeito sério na primeira versão
  desta implementação. A ambiguidade era julgada sobre a página de dez resultados,
  não sobre o catálogo: rodando o provedor contra a API real, `Serious Sam`
  resolvia para `serious-sam-the-random-encounter`, `Thief` para
  `thief-deadly-shadows` e `Warhammer` para `warhammer-end-times-vermintide` — e
  como o processador resolvia junto, saíam com correspondência `completa`, que é
  justamente o que eleva a confiança da recomendação. Antes desta issue os três
  eram descartados. Corrigido com a condição de página não-cheia; conferido de
  novo contra a API: os três voltam a ser descartados e os cinco casos que devem
  resolver continuam resolvendo.
- 2026-09-07: a revisão também mostrou três testes que passavam com a regra
  revertida. O recorte por tipo era exercitado com a GPU escrita com fabricante,
  o que fazia o `startsWith` falhar sozinho; os travessões e o espaço obrigatório
  depois do separador não tinham cenário nenhum. As quatro mutações
  correspondentes agora derrubam a suíte.
- 2026-09-07: as duas caixas de "Ao virar tarefa" estavam marcadas sem cobertura
  completa. A tabela de hardware não tinha cenário: entraram a GTX 1060 (dividida
  por memória de vídeo, continua descartada) e as cinco sugestões de processador
  ausentes do catálogo, todas conferidas com `count: 0` na API. `Elden Ring`
  ganhou o cenário de regressão que faltava, contra `Elden Ring Nightreign`.
- 2026-09-07: o apóstrofo foi tratado. `paraSlug` virou `formasDeSlug` e devolve
  as duas formas que o FPSHQ usa, conferidas na API: `baldurs-gate-3` e
  `no-mans-sky` descartam o apóstrofo; `baldur-s-gate-dark-alliance`,
  `tom-clancy-s-splinter-cell` e `sid-meier-s-pirates` o trocam por traço. As
  duas convivem na mesma página de "Baldur's Gate" e nada no `name` diz qual o
  catálogo escolheu, então a regra 2 aceita as duas. Continua sendo uma regra só
  na cascata, com igualdade exata de slug e mais de um candidato descartando como
  antes: nas 651 entradas com apóstrofo que a amostragem alcançou, nenhum item
  responde pelas duas formas, então aceitar as duas não inventa empate.
- 2026-09-07: a forma com apóstrofo descartado não é alcançável hoje, e isso fica
  registrado em vez de disfarçado. O `/search` casa `q` como substring literal do
  `name` — "Baldurs Gate 3" e "Marvels Spider-Man" voltam `count: 0` —, então
  todo termo que traz resultado carrega o `name` inteiro e a igualdade resolve
  antes. Só chegaria à regra 2 um `name` com lixo que o jogador não digita (`®`,
  apóstrofo curvo), e na amostra esse lixo aparece só em entradas de forma-traço:
  11 com marca registrada e 48 com apóstrofo curvo, zero em forma-descarte. A
  regra 2 é alcançada por título de apóstrofo — "Tom Clancy's Splinter Cell",
  "Sid Meier's Pirates", "Zuma's Revenge", "Who's Lila" —, mas sempre na forma
  com traço, que já funcionava. A correção está certa e hoje não muda nenhum caso
  de campo; nenhum cenário foi inventado para fingir o contrário.
- 2026-09-07: as respostas de "Baldur's Gate 3", "Baldur's Gate" e "Tom Clancy's
  Splinter Cell" foram gravadas da API e acrescentadas a
  `service/testes/massa-fpshq.ts`. Sobre elas ficam três cenários: o Splinter
  Cell resolvendo pela regra 2, porque os três `name` terminam em `®` e a
  igualdade não alcança ninguém; o Baldur's Gate 3 resolvendo pela igualdade
  antes de a regra 2 ter vez; e "Baldur's Gate" continuando descartado, com as
  duas formas de slug lado a lado e o título expandido em ambiguidade. A regra 2
  isolada ganhou tabela em `provedor-fpshq.test.ts`, com slug real e `name` de
  propósito diferente do termo. Revertendo `formasDeSlug` para uma forma só,
  três cenários dessa tabela caem.
- 2026-09-07: fica registrado como conhecido e não tratado o resto da pontuação.
  O FPSHQ escreve `&` como "and" (`edna-and-harvey-harvey-s-new-eyes`), `+` como
  "plus" (`toki-tori-2plus`) e descarta letra acentuada fora do Latin-1
  (`marc-eck-s-getting-up-contents-under-pressure`, de "Marc Eckō's");
  `formasDeSlug` não reproduz nenhuma das três. Algarismo romano, parênteses e
  acento comum ("Cowgirl's Café" → `cowgirl-s-cafe`) já batem.
- 2026-09-07: a suíte fechou em 124 testes — 114 depois da correção da página
  cheia, mais 10 com os cenários de apóstrofo. Todos passando, `npm run lint` e
  `npx tsc --noEmit` limpos.
