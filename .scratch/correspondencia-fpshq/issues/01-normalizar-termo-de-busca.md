# 01 — Normalizar o termo antes de buscar no FPSHQ

**What to build:** o termo enviado ao `/search` do FPSHQ passa pela mesma normalização que a comparação de nomes já aplica, para que placa de vídeo e processador escritos com o fabricante à frente sejam encontrados. Hoje `resolverEntidade` monta `q` com o texto cru do jogador, e o catálogo do FPSHQ não registra fabricante em nenhum `name` — a busca volta vazia e a evidência é descartada em silêncio.

**Blocked by:** Nenhum — pode começar imediatamente.

**Status:** resolved

Evidência coletada contra a API real em 2026-09-06:

```
q=NVIDIA GeForce RTX 4060  -> count=0      q=GeForce RTX 4060 -> count=5
q=AMD Ryzen 5 5600         -> count=0      q=Ryzen 5 5600     -> count=5
q=Intel Core i5-12400F     -> count=0      q=Core i5-12400F   -> count=5
q=AMD Radeon RX 6600       -> count=0      q=Radeon RX 6600   -> count=10
```

As respostas estão gravadas em `service/testes/massa-fpshq.ts` e os dois cenários que falham hoje já estão descritos em `service/ai/provedor-fpshq-massa-real.test.ts`.

- [x] O termo enviado em `q` para `/search` tem o fabricante removido pela mesma regra que a comparação de nomes usa hoje (`amd`, `intel`, `nvidia` no início).
- [x] A remoção do fabricante tem uma única autoridade no módulo — busca e comparação não podem divergir de novo.
- [x] A comparação de nomes continua aceitando o resultado tanto com quanto sem o fabricante, já que o jogador pode escrever das duas formas.
- [x] Uma consulta com `placaVideo: "NVIDIA GeForce RTX 4060"` resolve o slug `rtx-4060` e produz evidência com correspondência `completa`.
- [x] Uma consulta com `processador: "AMD Ryzen 5 5600"` resolve o slug `ryzen-5-5600` e não cai mais para correspondência `parcial`.
- [x] Uma consulta com `processador: "Intel Core i5-12400F"` resolve o slug `core-i5-12400f`.
- [x] Nomes sem fabricante continuam resolvendo exatamente como hoje, sem mudança de slug ou de preset escolhido.
- [x] Um termo ambíguo continua sendo descartado: a busca por um nome que case com mais de um `name` equivalente não resolve entidade.
- [x] O jogo não recebe remoção de fabricante — a regra vale só para placa de vídeo e processador.
- [x] Os cenários de `provedor-fpshq-massa-real.test.ts` que hoje afirmam a busca vazia com fabricante são atualizados para afirmar o novo comportamento, contra a mesma massa gravada.
- [x] A massa gravada em `service/testes/massa-fpshq.ts` continua sendo a fonte das respostas — nenhum teste novo bate na rede.
- [x] A fixture padrão de `criar-consulta-teste.ts` (que usa "NVIDIA GeForce RTX 4060" e "AMD Ryzen 5 5600") passa a produzir correspondência completa nos cenários que a utilizam.
- [x] O tempo limite, o aborto por `AbortSignal` e o tratamento de falha do provedor permanecem inalterados.
- [x] `npm test`, `npm run lint` e `npm run typecheck` passam.

## Comments

- 2026-09-06: `termoDeBusca(tipo, nome)` passou a ser a única autoridade sobre o
  fabricante — `resolverEntidade` monta o `q` com ela e `nomesEquivalentes`
  compara os dois lados por ela. Jogo fica de fora da remoção; a regex ganhou `i`
  porque agora recebe o texto do jogador antes da normalização.
- 2026-09-06: dois cenários da massa real usavam "AMD Ryzen 5 5600" justamente
  porque ele não resolvia. Com a correção ele resolve, e a correspondência
  `parcial` passou a ser exercitada por "AMD Ryzen 7 5700G" — ausente do catálogo
  do FPSHQ mesmo sem o fabricante no termo, conforme a issue `02`. A entrada foi
  acrescentada à massa gravada.
- 2026-09-06: os termos com fabricante continuam na massa como guarda. Se a
  remoção voltar a escapar do `q`, a busca responde vazia e os cenários caem.
- 2026-09-06: o cenário da fixture padrão continua sem evidência, agora só por
  causa do título do jogo — placa de vídeo e processador resolvem. É o recorte
  exato que sobra para a issue `02`.
- 2026-09-07: revisão independente confirmou os critérios desta issue. A massa de
  `GeForce RTX 4060`, `Ryzen 5 5600` e `Core i5-12400F` tinha sido gravada com
  `limit=5` enquanto o provedor envia `limit=10`; foram regravadas com o limite
  certo. Nenhuma delas muda de resultado — a igualdade segue resolvendo uma só
  entidade entre os dez.
- 2026-09-07: 114 testes passando, `npm run lint` e `npx tsc --noEmit` limpos.
