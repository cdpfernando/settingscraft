# 14 — Elo HTTP do cache compartilhado na cadeia

**What to build:** O app passa a consultar o cache compartilhado antes de gastar uma chamada de IA — e o jogador não percebe nada além de resultados mais rápidos, porque nenhuma linha da interface gráfica muda. O elo entra entre o cache local e o Gemini; no miss, a cadeia segue para os provedores e o resultado obtido é publicado de volta na API.

Timeout curto (~1,5s) e seguir adiante em silêncio: se o cache compartilhado não respondeu rápido, não vale a espera — a IA levará mais que isso de qualquer forma. Erro do backend nunca chega ao usuário, e o app segue funcional com a API fora do ar. Sem URL configurada, o elo não entra na cadeia. O botão de gerar novamente publica com sobrescrita explícita.

A API roda local, acessada pelo IP da máquina na rede — não `localhost`, que o app no dispositivo não enxerga.

**Blocked by:** 10 — Gerar novamente; 13 — API FastAPI de cache compartilhado.

**Status:** ready-for-agent

- [ ] Elo implementa `Fonte` e ocupa a posição entre o cache local e o Gemini
- [ ] 404 da API é traduzido em ausência, e a cadeia segue
- [ ] Resultado gerado pelos provedores é publicado na API depois do miss
- [ ] Timeout de aproximadamente 1,5s abandona o elo e segue adiante sem mensagem ao usuário
- [ ] API fora do ar ou com erro não produz nenhum efeito visível na tela
- [ ] Sem URL configurada, o elo é omitido na montagem da cadeia
- [ ] Gerar novamente publica com sobrescrita explícita
- [ ] Nenhuma alteração em código de tela neste ticket
