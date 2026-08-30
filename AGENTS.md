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
  generator.ts        createOptmizedSetting(): chama a API do Gemini via fetch e retorna texto puro
styles/
  tokens.ts           Fonte única de verdade: cores, espaçamentos, tipografia, raios
  primitives.ts       StyleSheets reutilizáveis que consomem os tokens
  index.ts            Re-exporta tokens + primitivos como @/styles (ponto de entrada público)
```

Alias de import: `@/*` aponta para a raiz do projeto (`tsconfig.json`).

## Contrato entre o prompt e o parser — não quebre

O ponto mais frágil do app: `service/ai/generator.ts` instrui o modelo a responder **texto puro, sem markdown**, uma linha por configuração:

```
[Nome da configuração]: [Valor recomendado] — [Justificativa em até 10 palavras]

FPS estimado: [valor ou faixa] a [resolução]
```

`parseResposta()` em `app/index.tsx` faz o parse exatamente desse formato (split por `:`, depois pelo travessão `—`, e a linha que começa com `fps estimado`). **Alterar o system prompt sem alterar o parser (ou vice-versa) quebra a renderização em silêncio** — a tela cai no fallback de texto cru. Sempre altere os dois juntos.

Observação: o separador é o travessão `—` (em dash, U+2014), não hífen.

## IA

- Provedor: Gemini via REST direto (`generativelanguage.googleapis.com/v1beta`), com `fetch`. Não há SDK no caminho de execução.
- Modelo em `MODEL` no topo de `service/ai/generator.ts`.
- Chave: `EXPO_PUBLIC_GEMINI_API_KEY` em `.env.local` (não versionado).
- `createOptmizedSetting()` **nunca lança**: erros viram string amigável para a UI, com `console.error` para diagnóstico. Mantenha esse contrato — a tela não tem tratamento de exceção.
- 429 tem mensagem própria (limite de requisições).

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

1. `npm run lint` limpo.
2. Se mexeu no prompt ou no parser: conferiu que os dois continuam casados.
3. Sem chaves ou segredos em código versionado.
