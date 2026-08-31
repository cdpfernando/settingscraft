# 14 — Elo HTTP do cache compartilhado na cadeia

**What to build:** O app passa a consultar o cache compartilhado antes de gastar uma chamada de IA — e o jogador não percebe nada além de resultados mais rápidos, porque nenhuma linha da interface gráfica muda. O elo entra entre o cache local e o Gemini; no miss, a cadeia segue para os provedores e o resultado obtido é publicado de volta na API.

Timeout curto (~1,5s) e seguir adiante em silêncio: se o cache compartilhado não respondeu rápido, não vale a espera — a IA levará mais que isso de qualquer forma. Erro do backend nunca chega ao usuário, e o app segue funcional com a API fora do ar. Sem URL configurada, o elo não entra na cadeia. O botão de gerar novamente publica com sobrescrita explícita.

A API roda local, acessada pelo IP da máquina na rede — não `localhost`, que o app no dispositivo não enxerga.

**Blocked by:** 10 — Gerar novamente; 13 — API FastAPI de cache compartilhado.

**Status:** resolved

- [x] Elo implementa `Fonte` e ocupa a posição entre o cache local e o Gemini
- [x] 404 da API é traduzido em ausência, e a cadeia segue
- [x] Resultado gerado pelos provedores é publicado na API depois do miss
- [x] Timeout de aproximadamente 1,5s abandona o elo e segue adiante sem mensagem ao usuário
- [x] API fora do ar ou com erro não produz nenhum efeito visível na tela
- [x] Sem URL configurada, o elo é omitido na montagem da cadeia
- [x] Gerar novamente publica com sobrescrita explícita
- [x] Nenhuma alteração em código de tela neste ticket

## Comments

Implementado em `service/ai/cache-compartilhado.ts`:

- `criarFonteCacheCompartilhado()`: elo de leitura (`GET /recomendacoes`, campos crus da `Consulta` + `versaoContrato` como query string). `AbortController` com timeout de 1,5s; 404, timeout, erro de rede ou JSON que não valida contra `ResultadoSchema` retornam `null` em silêncio (sempre por `catch`, nunca lançando `ErroFonteConfiguracao`/`ErroFonteLimite` — erro de backend deste elo nunca deve interromper a cadeia). Resultado válido tem `fonte` sobrescrita para `'compartilhado'`, no mesmo padrão do `'salvo'` do cache local.
- `publicarNoCacheCompartilhado()`: `POST /recomendacoes?sobrescrever=...`, corpo `{ ...consulta, ...resultado }` (mesmo formato de `RegistroEscrita` na API, camelCase). Header `X-Cache-Token` só quando `EXPO_PUBLIC_CACHE_API_TOKEN` está definida. Timeout próprio (5s) e nunca lança — falha de publicação só é logada.
- `generator.ts`: `montarFontes()` insere o elo entre o cache local e os provedores, só quando `EXPO_PUBLIC_CACHE_API_URL` está definida (senão fica de fora, com aviso no console, mesmo padrão do Gemini/Groq sem chave); omitido também quando `ignorarCache` (gerar novamente pula os dois caches). `createOptmizedSetting()` publica de volta no cache compartilhado (fire-and-forget, sem bloquear a resposta à tela) sempre que o resultado não veio de um cache (`fonte !== 'salvo' && fonte !== 'compartilhado'`, checado por `veioDeCache()`), passando `sobrescrever = opcoes.ignorarCache === true` — é o que faz "gerar novamente" publicar com sobrescrita explícita.
- Variáveis novas: `EXPO_PUBLIC_CACHE_API_URL` e `EXPO_PUBLIC_CACHE_API_TOKEN` (opcional), documentadas no `README.md` raiz.
- Verificado manualmente: subiu a API local (`uv run uvicorn ...`) e exercitou o elo via um script descartável com `tsx` chamando `criarFonteCacheCompartilhado`/`publicarNoCacheCompartilhado` diretamente — miss 404 → `null`; publicar → buscar devolve `fonte: 'compartilhado'`; publicar de novo sem `sobrescrever` não altera o registro; com `sobrescrever: true` sobrescreve; endpoint inalcançável aborta em ~1,5s e devolve `null`. Script e banco de teste descartados depois.
- `npx tsc --noEmit` e `npm run lint` limpos.
- Fora de escopo (não tocado): telas (`app/`), inclusive `historico.tsx`, que já imprime `resultado.fonte` cru — o novo valor `'compartilhado'` aparece ali sem qualquer alteração de código.
