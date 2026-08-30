# 12 — Groq via AI SDK como último elo da cadeia

**What to build:** Gemini fora do ar, lento ou com quota estourada deixa de significar app inútil: o jogador continua recebendo recomendações, agora do Groq, e o selo de origem mostra de onde vieram. O problema do provedor não é problema do jogador.

O Groq entra pelo AI SDK, que exige polyfills do Expo (`structuredClone`, `TextEncoderStream`, `TextDecoderStream`) importados na raiz. Os polyfills entram apenas neste bloco, nunca antes — polyfill quebrado no meio do desenvolvimento da interface é o pior momento para descobrir.

O elo respeita o mesmo contrato Zod canônico do ticket 04, sem segunda declaração do schema. Sem chave configurada, ele simplesmente não entra na cadeia.

**Blocked by:** 08 — Porta Fonte, resolvedor e composição na borda.

**Status:** ready-for-agent

- [ ] Elo do Groq implementa `Fonte` e ocupa a última posição da cadeia
- [ ] Usa o mesmo schema Zod do Gemini, sem declaração paralela
- [ ] Polyfills do Expo importados na raiz e verificados em dispositivo
- [ ] Falha do Gemini (5xx, 429, timeout, JSON inválido) leva ao Groq e produz resultado
- [ ] 401 e 400 do Gemini não escalam para o Groq
- [ ] Sem chave do Groq, a cadeia é montada sem ele e nada falha em runtime
- [ ] Selo de origem identifica corretamente qual provedor respondeu
