# Recomendações de configuração gráfica

Este contexto descreve como o SettingsCraft representa o pedido do jogador e a configuração gráfica resultante.

## Linguagem

**Consulta de configurações**:
Pedido válido que reúne jogo, placa de vídeo, processador, memória e resolução informados pelo jogador. Jogo, placa de vídeo e processador podem ser descritos livremente e conservam sua forma legível; memória e resolução são representadas pelas opções suportadas. Diferenças apenas de caixa ou espaços não formam uma nova consulta.
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

**Recomendação salva**:
Recomendação preservada no dispositivo e associada à identidade de uma consulta de configurações. Cada identidade conserva apenas a recomendação mais recente. Ela pode ser reaproveitada automaticamente ou consultada pelo jogador no histórico; ser entregue como salva não altera qual gerador a produziu originalmente.
_Evitar_: item de cache, registro de histórico

**Histórico de recomendações**:
Visão das recomendações salvas disponível ao jogador; não representa uma coleção distinta das recomendações usadas no reaproveitamento local.
_Evitar_: cache, armazenamento do histórico
