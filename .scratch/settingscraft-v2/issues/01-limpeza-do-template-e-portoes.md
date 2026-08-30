# 01 — Limpeza do template e portões de qualidade

**What to build:** O repositório deixa de carregar sobras do `create-expo-app`. Quem clonar encontra só o que o app usa, e qualquer ticket seguinte tem um portão objetivo para dizer que está pronto: lint limpo e verificação de tipos limpa.

Sai `app-example/` inteiro, saem as dependências herdadas do template que ninguém importa (abas do React Navigation e afins), sai `@ai-sdk/google` — a decisão de manter o Gemini em `fetch` direto o torna permanentemente morto — e sai a entrada `reset-project` do `package.json`, cujo script já não existe. `ai` permanece: o Groq entra por ele na fase final.

**Blocked by:** None — can start immediately.

**Status:** ready-for-human

- [x] `app-example/` removido do repositório
- [x] Dependências do template não utilizadas removidas do `package.json`, com `package-lock.json` regenerado
- [x] `@ai-sdk/google` removido; `ai` mantido para a fase do Groq
- [x] Entrada `reset-project` removida do `package.json`
- [x] Existe um script de verificação de tipos no `package.json`, e ele roda limpo
- [x] `npm run lint` roda limpo
- [x] O app continua iniciando e gerando recomendações como antes — nada de comportamento mudou

