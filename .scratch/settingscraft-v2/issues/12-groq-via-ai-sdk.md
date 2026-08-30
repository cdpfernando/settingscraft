# 12 — Groq via AI SDK como último elo da cadeia

**What to build:** Gemini fora do ar, lento ou com quota estourada deixa de significar app inútil: o jogador continua recebendo recomendações, agora do Groq, e o selo de origem mostra de onde vieram. O problema do provedor não é problema do jogador.

O Groq entra pelo AI SDK, que exige polyfills do Expo (`structuredClone`, `TextEncoderStream`, `TextDecoderStream`) importados na raiz. Os polyfills entram apenas neste bloco, nunca antes — polyfill quebrado no meio do desenvolvimento da interface é o pior momento para descobrir.

O elo respeita o mesmo contrato Zod canônico do ticket 04, sem segunda declaração do schema. Sem chave configurada, ele simplesmente não entra na cadeia.

**Blocked by:** 08 — Porta Fonte, resolvedor e composição na borda.

**Status:** ready-for-human

- [x] Elo do Groq implementa `Fonte` e ocupa a última posição da cadeia
- [x] Usa o mesmo schema Zod do Gemini, sem declaração paralela
- [ ] Polyfills do Expo importados na raiz e verificados em dispositivo
- [x] Falha do Gemini (5xx, 429, timeout, JSON inválido) leva ao Groq e produz resultado
- [x] 401 e 400 do Gemini não escalam para o Groq
- [x] Sem chave do Groq, a cadeia é montada sem ele e nada falha em runtime
- [x] Selo de origem identifica corretamente qual provedor respondeu

## Comments

Implementado: `service/ai/fonte-groq.ts` (elo via `@ai-sdk/groq` + `generateObject`, reaproveitando `RespostaIaSchema`), prompt e instrução de sistema extraídos para `service/ai/prompt.ts` (compartilhados com `fonte-gemini.ts` para não divergir), polyfills em `polyfills.ts` importados em `app/_layout.tsx` antes de qualquer outro import, composição em `montarFontes` (`generator.ts`) omitindo o Groq quando `EXPO_PUBLIC_GROQ_API_KEY` não está definida. `401`/`400` continuam resolvidos genericamente pelo `resolvedor.ts` (não específico ao Gemini), então a regra vale para qualquer elo, Groq incluso.

`npx tsc --noEmit` e `npm run lint` passam limpos. Não verificado: comportamento real do Groq (sem chave configurada em `.env.local` neste ambiente) nem os polyfills em dispositivo/emulador — ambos pendentes de um humano com acesso a uma chave Groq e a um device Expo.
