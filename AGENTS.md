# SettingsCraft

Expo SDK 54. O jogador informa hardware e jogo. O app percorre cache local, Gemini e Groq, e devolve o menu gráfico preenchido.

## Expo mudou. Leia a doc da versão certa.

SDK 54, expo-router v6, React Native 0.81, React 19.1, New Architecture. Antes de escrever código de Expo ou React Native, abra:

https://docs.expo.dev/versions/v54.0.0/

Padrões que já pegaram gente aqui:

- Roteamento é file-based em `app/`. Não é React Navigation na mão.
- `newArchEnabled`, `experiments.typedRoutes` e `experiments.reactCompiler` estão ligados em `app.json`.
- Variável de ambiente do cliente precisa do prefixo `EXPO_PUBLIC_`. O Expo embute no bundle em build time.

## Estrutura

```
app/                  rotas. _layout.tsx é o Stack; index.tsx a consulta; historico.tsx o histórico
service/ai/
  fonte.ts            Consulta, contratos dos adapters, transporte HTTP e erros
  recomendador.ts     módulo deep: monta e percorre a cadeia, persiste e expõe consultarConfiguracoes()
  schema.ts           Zod do contrato Resultado / RespostaIa
  prompt.ts           instrução de sistema e prompt, iguais para Gemini e Groq
styles/
  tokens.ts           cores, espaçamentos, tipografia, raios
  primitives.ts       StyleSheets que consomem os tokens
  index.ts            import via @/styles
```

Alias `@/*` aponta para a raiz (`tsconfig.json`).

## Schema Zod

`schema.ts` declara `RespostaIaSchema` uma vez. `fonte-gemini.ts` deriva o JSON Schema do Gemini disso (`z.toJSONSchema`, filtrado em `paraSchemaGemini`). Não escreva um JSON Schema paralelo. Os dois divergem, e a divergência só aparece quando o parse falha.

A resposta da IA passa por `RespostaIaSchema` antes de virar `Resultado`. `configuracoes` e `fpsEstimado` vêm do gerador. O recomendador acrescenta e valida os metadados finais, a confiança e a evidência antes de persistir ou devolver.

## Cadeia

Ordem: cache local, Gemini, Groq.

- `consultarConfiguracoes()` nunca lança. Devolve `ConsultaResultado`: `{ ok: true, resultado }` ou `{ ok: false, erro }`. A tela não tem try/catch.
- 429 tem mensagem própria.
- Adapter sem credencial fica de fora da cadeia. Não vira erro em runtime.
- 401 e 400 param a cadeia. Não adianta tentar o próximo provedor.
- `EXPO_PUBLIC_USAR_RESULTADO_EXEMPLO=true` usa um gerador in-process identificado como `exemplo`, sem rede.

Gemini é REST direto em `generativelanguage.googleapis.com/v1beta`. Modelo no topo de `fonte-gemini.ts`. Groq entra pelo AI SDK. Modelo no topo de `fonte-groq.ts`.

Chaves em `.env.local`, não versionado: `EXPO_PUBLIC_GEMINI_API_KEY`, `EXPO_PUBLIC_GROQ_API_KEY`. Groq é opcional.

`EXPO_PUBLIC_*` vai para o bundle. A chave fica no cliente. Para produção, a chamada tem que sair do app.

## Convenções

- TypeScript `strict`. Tipar entradas e saídas de `service/`.
- Português (pt-BR) em nomes de domínio, UI e comentários: `jogo`, `placaVideo`, `resolucao`.
- Estilo só pelo sistema em `@/styles`. Sem estilo inline, sem `StyleSheet.create` no componente.
- Animação com `moti` (`MotiView`).
- Tela é `export default`.

## Comandos

```bash
npm start
npm run android
npm run ios
npm run web
npm run lint
```

## Antes de entregar

1. `npm run lint` e `npx tsc --noEmit` limpos.
2. Se mexeu no Zod ou no prompt, os dois lados ainda batem.
3. Sem chave em código versionado.
