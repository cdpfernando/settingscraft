# SettingsCraft

Você diz o jogo, o PC e a resolução. O app devolve as configurações gráficas na ordem do menu, cada uma com um valor, uma justificativa curta e um chute de FPS.

Não gasta IA à toa. Primeiro olha o que já está no aparelho, depois o cache compartilhado, depois Gemini. Groq só entra se o Gemini falhar.

## Rodando

Node 20 ou mais. Uma chave do [Google AI Studio](https://aistudio.google.com/) é o mínimo. Groq é opcional.

```bash
npm install
```

Crie `.env.local` na raiz:

```
EXPO_PUBLIC_GEMINI_API_KEY=sua_chave_aqui
EXPO_PUBLIC_GROQ_API_KEY=sua_chave_aqui
```

`EXPO_PUBLIC_*` entra no bundle em build time. A chave do Gemini fica no cliente. Para produção, a chamada tem que sair do app.

O cache compartilhado já aponta para a instância no Railway. Só configure URL se for rodar a API você mesmo:

```
EXPO_PUBLIC_CACHE_API_URL=http://192.168.0.10:8000
EXPO_PUBLIC_CACHE_API_TOKEN=
```

Use o IP da máquina na LAN. `localhost` no celular não chega na sua API. Token só entra se o servidor tiver `CACHE_WRITE_TOKEN`. O resto está em [`api/README.md`](api/README.md).

Para mexer no layout sem gastar quota:

```
EXPO_PUBLIC_USAR_RESULTADO_EXEMPLO=true
```

```bash
npm start          # menu do Expo: Android, iOS ou web
npm run android
npm run ios
```

## O que está onde

Expo SDK 54, expo-router v6, React Native 0.81, React 19. Gemini via `fetch`. Groq via AI SDK. Animações com moti.

```
app/           telas
service/ai/    cadeia de fontes e o schema Zod
api/           FastAPI do cache compartilhado
styles/        tokens e StyleSheets. Sem estilo inline.
assets/data/   GPUs e CPUs do autocomplete
```

A cadeia é montada em `service/ai/generator.ts`: cache local, cache compartilhado, Gemini, Groq. Quem responder primeiro ganha. O cache compartilhado desiste em 1,5s e a cadeia segue. Se a API cair, o jogador não vê erro, só espera a IA.

O schema Zod em `service/ai/schema.ts` é o contrato. O JSON Schema que o Gemini recebe sai dele em runtime. Um segundo schema escrito à mão diverge, e você só percebe quando o parse quebra.

Incrementar `CONTRATO_VERSAO` invalida o cache antigo. Sem TTL. Hardware e jogo não mudam sozinhos.

## O que ainda está torto

A chave da IA no bundle. Sem testes automatizados de propósito; o resolvedor aceita fontes injetadas para quando isso entrar. O backend é cache, não proxy. O app continua falando com a IA direto.

`npm run lint` e `npx tsc --noEmit` precisam passar.
