# 10 — Gerar novamente

**What to build:** Quando a recomendação guardada não convence, o jogador pede uma nova. O botão ignora o cache, força a geração pela cadeia de provedores e a resposta nova substitui a antiga — nada de acumular versões conflitantes do mesmo cenário. Sem isso, uma resposta ruim ficaria cravada para sempre naquele hardware.

**Blocked by:** 09 — Cache local persistente como primeira fonte.

**Status:** resolved

- [x] Botão de gerar novamente disponível na tela de resultado
- [x] A geração forçada pula o elo de cache e vai à cadeia de provedores
- [x] O novo resultado sobrescreve o registro do mesmo cenário
- [x] Consultar o mesmo cenário depois devolve a versão nova
- [x] Botão desabilitado e indicador de carregamento durante a geração
