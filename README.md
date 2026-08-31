# SettingsCraft

App mobile (Expo / React Native) que usa IA para recomendar as **melhores configurações gráficas** de um jogo a partir do hardware do usuário.

O jogador informa o jogo, placa de vídeo, processador, memória RAM e resolução alvo. O app consulta uma **cadeia de fontes** (cache local → Gemini → Groq) e devolve, na ordem do menu gráfico do jogo, cada configuração com o valor recomendado, uma justificativa curta e uma estimativa de FPS.

---

## Como rodar

### 1. Pré-requisitos

- Node.js ≥ 20
- Expo CLI (`npm install -g expo-cli`) ou use `npx expo` diretamente
- Conta no [Google AI Studio](https://aistudio.google.com/) para obter a chave do Gemini
- Conta no [Groq Console](https://console.groq.com/) para obter a chave do Groq (opcional — fallback da cadeia)

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variável de ambiente

Crie `.env.local` na raiz do projeto (não é versionado):

```
EXPO_PUBLIC_GEMINI_API_KEY=sua_chave_aqui
EXPO_PUBLIC_GROQ_API_KEY=sua_chave_aqui
```

> **Nota:** `EXPO_PUBLIC_*` é embutido no bundle em build time. A chave fica exposta no cliente — limitação conhecida e aceita nesta fase. Uma rota de backend/proxy resolve isso depois.

`EXPO_PUBLIC_GROQ_API_KEY` é opcional: sem ela, o Groq simplesmente não entra na cadeia — nada falha em runtime.

Por padrão o app já consulta o cache compartilhado ([`api/`](api/)) na instância pública hospedada no Railway — nenhuma variável precisa ser configurada. Opcional, só para apontar para uma instância própria (local ou auto-hospedada):

```
EXPO_PUBLIC_CACHE_API_URL=http://192.168.0.10:8000
EXPO_PUBLIC_CACHE_API_TOKEN=
```

Use o IP da máquina que roda a API na rede local, não `localhost` (o dispositivo não o enxerga). `EXPO_PUBLIC_CACHE_API_TOKEN` só é necessário se `CACHE_WRITE_TOKEN` estiver configurada do lado do servidor (ver [`api/README.md`](api/README.md)) — a instância hospedada não exige token.

Opcional, para iterar layout sem gastar quota nem esperar a chamada de rede:

```
EXPO_PUBLIC_USAR_RESULTADO_EXEMPLO=true
```

### 4. Iniciar

```bash
npm start          # expo start (escolha Android / iOS / Web no menu)
npm run android    # direto no emulador Android
npm run ios        # direto no simulador iOS
```

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Expo SDK 54 |
| Roteamento | expo-router v6 (file-based) |
| Runtime | React Native 0.81, React 19, New Architecture |
| IA | Gemini via REST direto (`fetch`) |
| Animações | moti + react-native-reanimated |
| Linguagem | TypeScript strict |

---

## Estrutura

```
app/
  _layout.tsx              Stack raiz com cabeçalho do tema escuro
  index.tsx                Tela de consulta
  historico.tsx            Tela de histórico

service/
  ai/
    fonte.ts               Porta Fonte, Consulta, TransporteHttp, erros da cadeia
    resolvedor.ts           Percorre a cadeia, para na primeira fonte que responder
    cache-local.ts          Repositório AsyncStorage + elo de cache local (1º da cadeia)
    cache-compartilhado.ts  Elo HTTP do cache compartilhado (2º da cadeia) + publicação no miss
    fonte-gemini.ts         Elo Gemini (fetch direto)
    fonte-groq.ts           Elo Groq (AI SDK)
    generator.ts            Borda de composição: monta a cadeia, expõe createOptmizedSetting()
    schema.ts               Contrato Zod (fonte única de verdade)

api/
  app/                 FastAPI: cache compartilhado (GET/POST /recomendacoes)
                       Ver api/README.md — roda separado, com uv

styles/
  tokens.ts            Cores, espaçamentos, tipografia, raios
  primitives.ts        StyleSheets reutilizáveis que consomem os tokens
  index.ts             Re-exporta tokens + primitivos como @/styles

assets/
  data/                (Bloco 3) Datasets locais de GPUs e CPUs para autocomplete
```

---

## Arquitetura

### Cadeia de fontes

Toda origem de recomendação implementa a mesma interface `Fonte`:

```ts
interface Fonte {
  nome: string;
  buscar(consulta: Consulta): Promise<Resultado | null>;
}
```

Um resolvedor percorre a cadeia parando na primeira fonte que responder. A composição da cadeia acontece na borda da aplicação (não dentro do resolvedor), o que permite testá-la com fontes falsas.

**Cadeia:** cache local → cache compartilhado (API) → Gemini → Groq

O elo do cache compartilhado tem timeout curto (~1,5s): se a API não responder rápido, a cadeia segue em silêncio para o próximo elo — erro ou indisponibilidade do backend nunca chegam ao jogador. Ele sempre entra na cadeia, apontando para a instância pública hospedada por padrão; `EXPO_PUBLIC_CACHE_API_URL` sobrescreve para uma instância própria. No miss de todos os caches, o resultado obtido dos provedores é publicado de volta na API; "gerar novamente" pula os dois elos de cache e publica com sobrescrita explícita.

O elo do Groq entra pelo [AI SDK](https://ai-sdk.dev/), que exige polyfills do Expo (`structuredClone`, `TextEncoderStream`, `TextDecoderStream`) — importados uma única vez em [`polyfills.ts`](polyfills.ts), na raiz.

### Resultado tipado

A resposta da IA é validada contra um schema Zod antes de chegar à tela:

```ts
interface Resultado {
  configuracoes: { nome: string; valor: string; justificativa: string }[];
  fpsEstimado: string;
  fonte: string;      // nome da fonte que respondeu
  geradoEm: string;   // ISO 8601
  versaoContrato: number;
}
```

### Cache

Chave = campos da consulta normalizados + número de versão do contrato. Incrementar a versão invalida todo o cache antigo sem migração. Sem TTL — hardware e jogo não mudam sozinhos.

---

## Sequência de desenvolvimento

| Bloco | Escopo |
|---|---|
| 1 — Fundação ✅ | Limpeza do template, design system em camadas, tema escuro, documentação |
| 2 — Contrato tipado ✅ | Zod, schema derivado, Gemini em JSON, resultado de exemplo |
| 3 — Interface | Autocomplete de GPU/CPU, validação, estados de loading, selo de origem |
| 4 — Cadeia e persistência | Porta Fonte, resolvedor, cache local, histórico, navegação |
| 5 — Fase distribuída | Groq (AI SDK), API FastAPI, elo HTTP |

---

## Decisões e limitações conhecidas

- **Chave exposta no bundle:** `EXPO_PUBLIC_GEMINI_API_KEY` é inlined pelo Expo em build time. Aceitável em fase de desenvolvimento; a solução é mover as chamadas para um backend/proxy.
- **Sem testes automatizados nesta fase:** adiados deliberadamente. O código nasce com o *seam* correto (resolvedor da cadeia aceita injeção de fontes) para facilitar a adição posterior.
- **Backend como cache, não proxy:** o app continua chamando a IA diretamente. O backend compartilha resultados entre dispositivos e reduz consumo de quota, mas não esconde a chave.

---

## Lint e tipos

```bash
npm run lint       # eslint via expo lint
npx tsc --noEmit   # verificação de tipos
```

Ambos devem passar limpos antes de qualquer PR.
