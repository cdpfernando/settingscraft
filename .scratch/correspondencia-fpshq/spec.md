# Correspondência de entidades no FPSHQ

**Status:** resolved

## Problem Statement

A evidência de desempenho do FPSHQ é o único elo entre a recomendação e uma referência externa medida. Quando ela aparece, o resultado sobe para confiança `media`; quando não aparece, a recomendação fica só com o palpite do gerador. Hoje ela quase nunca aparece, e não por indisponibilidade do serviço — por como `provedor-fpshq.ts` traduz o texto do jogador em uma entidade do catálogo.

Duas falhas de correspondência foram confirmadas contra a API real em 2026-09-06, com as respostas gravadas em `service/testes/massa-fpshq.ts`:

1. **Fabricante no termo de busca zera o resultado.** `/search` casa o termo como substring do `name`, e nenhum `name` do catálogo traz o fabricante. `q=NVIDIA GeForce RTX 4060` devolve `count: 0`; `q=GeForce RTX 4060` devolve 5 resultados. O mesmo vale para `AMD Ryzen 5 5600` e `Intel Core i5-12400F`. `removerFabricante` existe em `provedor-fpshq.ts`, mas só age na comparação de nomes — nunca no `q` enviado.

2. **Nome canônico expandido não casa com o título informado.** O slug `cyberpunk-2077` tem `name: "Cyberpunk 2077: Phantom Liberty"`. Quem digita "Cyberpunk 2077" recebe 7 resultados e nenhum equivalente pela regra de igualdade estrita. "The Witcher 3" tem a mesma forma: um único resultado, chamado "The Witcher 3: Wild Hunt".

O efeito das duas é silencioso. `criarProvedorEvidenciaFpsHq` devolve `null` sem erro, a cadeia segue para o Gemini e o jogador recebe uma recomendação com confiança `baixa`. Nada no app indica que a evidência foi descartada por um detalhe de escrita do nome — e a própria fixture padrão do repo (`criar-consulta-teste.ts`) usa exatamente os nomes com fabricante que a busca não encontra.

## Solution

As duas falhas são de camadas diferentes e não devem ser resolvidas juntas.

A primeira é mecânica: o termo enviado ao `/search` precisa passar pela mesma normalização que a comparação já aplica. É uma correção fechada, sem escolha de política, e está na issue `01`.

A segunda é uma decisão de produto sobre até onde afrouxar a correspondência de títulos sem passar a recomendar com base no jogo errado. "God of War" mostra o risco: a busca devolve "God of War" e "God of War Ragnarok", e só a igualdade estrita acerta. A issue `02` levanta o espaço de decisão com as evidências coletadas, sem prescrever a regra.

O comportamento visível ao jogador não muda em nenhum dos dois casos, exceto pela evidência passar a aparecer onde hoje é descartada. Cadeia, prompts, procedência e schema seguem como estão.

## User Stories

1. Como jogador, quero que meu hardware seja encontrado no FPSHQ mesmo escrevendo o fabricante junto ao modelo, para receber uma recomendação com referência de desempenho medida.
2. Como jogador, quero que o processador escrito com fabricante conte como correspondência completa, para não perder confiança na recomendação por um detalhe de escrita.
3. Como jogador, quero que o título do jogo seja reconhecido mesmo quando o catálogo do FPSHQ registra o nome com a expansão, para não perder a evidência de um jogo que está lá.
4. Como jogador, quero que uma correspondência duvidosa seja descartada em vez de adivinhada, para não receber configurações baseadas em outro jogo.
5. Como mantenedor, quero que a normalização do termo de busca e a da comparação tenham uma única autoridade, para que não voltem a divergir.
6. Como mantenedor, quero cenários de teste construídos sobre respostas reais gravadas do FPSHQ, para que as regras de correspondência sejam verificadas contra o comportamento do serviço e não contra uma suposição.
