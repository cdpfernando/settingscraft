# Recomendações de configuração gráfica

Este contexto descreve como o SettingsCraft representa o pedido do jogador e a configuração gráfica resultante.

## Linguagem

**Consulta de configurações**:
Pedido que reúne jogo, hardware e resolução informados pelo jogador.
_Evitar_: requisição, prompt

**Recomendação**:
Configurações gráficas sugeridas para uma consulta, acompanhadas da estimativa de FPS e de sua procedência.
_Evitar_: resposta da IA, configuração otimizada

**Evidência de desempenho**:
Referência externa validada do FPSHQ usada para apoiar uma recomendação; pode ter correspondência completa ou parcial e não representa a configuração final.
_Evitar_: benchmark da recomendação, resultado do FPSHQ

**Nova recomendação**:
Recomendação solicitada sem reutilizar um resultado anterior para a mesma consulta de configurações.
_Evitar_: ignorar cache, atualizar resposta
