# 07 — Tela de resultado: layout final, selo de origem e data

**What to build:** O jogador lê o resultado de cima para baixo e aplica no menu do jogo sem procurar nada. As configurações aparecem na ordem exata do menu, cada uma com o valor recomendado destacado — aplicável sem ler o texto todo — e a justificativa curta logo abaixo, para entender o motivo e decidir se concorda. A estimativa de FPS na resolução escolhida fica evidente.

Um selo discreto informa de onde veio a recomendação e quando foi gerada, para o jogador julgar se ainda vale. Sem esse selo, o fallback entre fontes é invisível e indemonstrável — ele existe desde já, lendo `fonte` e `geradoEm` do `Resultado`, mesmo enquanto só o Gemini os preenche.

**Blocked by:** 04 — Contrato tipado.

**Status:** ready-for-agent

- [ ] Configurações renderizadas na ordem recebida, sem reordenação
- [ ] Valor recomendado visualmente destacado em cada linha
- [ ] Justificativa curta legível em cada linha
- [ ] FPS estimado apresentado com a resolução consultada
- [ ] Selo de origem exibe `fonte` e `geradoEm` de forma discreta
- [ ] Layout verificado com o resultado de exemplo, sem consumir quota
- [ ] Legível em ambiente escuro, usando os tokens do design system
