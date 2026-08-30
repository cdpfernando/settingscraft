# SettingsCraft

App mobile (Expo / React Native) que usa IA para recomendar as **melhores configurações gráficas** de um jogo a partir do hardware do usuário.

O usuário informa jogo, placa de vídeo, processador, memória RAM e resolução alvo. O app consulta o Gemini e devolve, na ordem exata do menu gráfico do jogo, cada configuração com o valor recomendado, uma justificativa curta e uma estimativa de FPS.

## Regra crítica: Expo MUDOU

Este projeto usa **Expo SDK 54** com **expo-router v6**, React Native 0.81, React 19.1 e a New Architecture.
Antes de escrever qualquer código de Expo/React Native, leia a doc versionada exata:
https://docs.expo.dev/versions/v54.0.0/

Não confie em memória de SDKs antigos. Padrões que mudaram e aparecem aqui:
- Roteamento é file-based via `expo-router` (`app/`), **não** React Navigation manual.
- `newArchEnabled: true`, `experiments.typedRoutes` e `experiments.reactCompiler` estão ligados em `app.json`.
- Variáveis de ambiente do cliente precisam do prefixo `EXPO_PUBLIC_` (inlined no bundle em build time).

## Estrutura

```
app/                  Rotas (expo-router). _layout.tsx = Stack raiz com tema escuro; index.tsx = tela de consulta
service/ai/           Integração com a IA
  generator.ts        createOptmizedSetting(): chama a API do Gemini via fetch, valida e retorna `ConsultaResultado`
  schema.ts            Zod: fonte única de verdade do contrato `Resultado`/`RespostaIa`
styles/
  tokens.ts           Fonte única de verdade: cores, espaçamentos, tipografia, raios
  primitives.ts       StyleSheets reutilizáveis que consomem os tokens
  index.ts            Re-exporta tokens + primitivos como @/styles (ponto de entrada público)
```

Alias de import: `@/*` aponta para a raiz do projeto (`tsconfig.json`).

## Contrato tipado — Zod é a fonte única de verdade

`service/ai/schema.ts` declara `RespostaIaSchema` (Zod) uma única vez. `service/ai/generator.ts` deriva o JSON Schema enviado ao Gemini a partir desse mesmo schema em runtime (`z.toJSONSchema`, filtrado em `paraSchemaGemini` para o subconjunto de OpenAPI 3.0 que o Gemini aceita) — **nunca escreva um JSON Schema à mão em paralelo**: duas declarações do mesmo contrato divergem, e a divergência só aparece quando o fallback dispara.

A resposta da IA chega como JSON estruturado e é validada contra `RespostaIaSchema` antes de virar `Resultado`. **Alterar o schema sem que a IA e a tela concordem quebra a validação, não a renderização silenciosa** — o request muda o formato pedido ao Gemini e o parse ao mesmo tempo, então os dois lados do contrato sempre viajam juntos.

`Resultado` nasce completo: `configuracoes`, `fpsEstimado` vêm da IA; `fonte`, `geradoEm` e `versaoContrato` são preenchidos por `generator.ts` na resposta.

## IA

- Provedor: Gemini via REST direto (`generativelanguage.googleapis.com/v1beta`), com `fetch`. Não há SDK no caminho de execução.
- Modelo em `MODEL` no topo de `service/ai/generator.ts`.
- Chave: `EXPO_PUBLIC_GEMINI_API_KEY` em `.env.local` (não versionado).
- `createOptmizedSetting()` **nunca lança**: retorna sempre `ConsultaResultado` (`{ ok: true, resultado }` ou `{ ok: false, erro }`), com `console.error` para diagnóstico. Mantenha esse contrato — a tela não tem tratamento de exceção.
- 429 tem mensagem própria (limite de requisições).
- `EXPO_PUBLIC_USAR_RESULTADO_EXEMPLO=true` em `.env.local` faz `createOptmizedSetting()` devolver um `Resultado` fixo sem chamar a rede — útil para iterar layout sem gastar quota.

Pontos conhecidos, a resolver quando o escopo permitir:
- `EXPO_PUBLIC_*` é embutido no bundle, ou seja, **a chave do Gemini fica exposta no cliente**. Para produção, mover a chamada para um backend/proxy.

## Convenções de código

- TypeScript `strict`. Tipar entradas e saídas das funções de `service/`.
- Português (pt-BR) em nomes de domínio, textos de UI e comentários — `jogo`, `placaVideo`, `resolucao`. Mantenha a consistência.
- Estilos usam o sistema em camadas: tokens em `styles/tokens.ts`, StyleSheets reutilizáveis em `styles/primitives.ts`, importados via `@/styles`. Nunca estilo inline, nunca `StyleSheet.create` espalhado por componente.
- Animações com `moti` (`MotiView`), já usadas na revelação do card e na entrada escalonada das linhas.
- Componentes de tela são funções default export.

## Comandos

```bash
npm start        # expo start
npm run android
npm run ios
npm run web
npm run lint     # expo lint (eslint-config-expo)
```



## Antes de entregar

1. `npm run lint` e `npx tsc --noEmit` limpos.
2. Se mexeu no schema Zod ou no prompt do Gemini: conferiu que os dois continuam casados.
3. Sem chaves ou segredos em código versionado.
