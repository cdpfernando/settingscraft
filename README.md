# SettingsCraft

Você diz o jogo, o PC e a resolução. O app devolve as configurações gráficas na ordem do menu, cada uma com um valor, uma justificativa curta e um chute de FPS.

Não gasta IA à toa. Primeiro olha o que já está no aparelho, consulta evidência de desempenho no FPSHQ e só então chama o Gemini. Groq entra se o Gemini falhar e recebe a mesma evidência.

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
service/ai/    recomendação, adapters e schema Zod
styles/        tokens e StyleSheets. Sem estilo inline.
assets/data/   GPUs e CPUs do autocomplete
```

A recomendação é entregue por `service/ai/recomendador.ts`, cuja interface é `consultarConfiguracoes`. O módulo impõe a ordem Recomendação salva, enriquecimento opcional por Evidência de desempenho do FPSHQ, Gemini e Groq; a Recomendação salva tem prioridade e o FPSHQ apenas ancora a geração, nunca entrega sozinho uma recomendação. Gemini, Groq e o gerador de exemplo devolvem somente o conteúdo validado; o recomendador acrescenta procedência, horário, versão, confiança e evidência, valida o resultado final e então o persiste. O enriquecimento inteiro do FPSHQ tem orçamento máximo de 3s. Se ele falhar, o jogador não vê erro e o fluxo segue para a IA. Para gerar de novo, a tela expressa a intenção com `forcarNovaRecomendacao`, que pula apenas a leitura das Recomendações salvas e preserva a gravação do novo resultado.

O schema Zod em `service/ai/schema.ts` é o contrato. O JSON Schema que o Gemini recebe sai dele em runtime. Um segundo schema escrito à mão diverge, e você só percebe quando o parse quebra.

Incrementar `CONTRATO_VERSAO` torna incompatíveis Recomendações salvas de contratos anteriores. Sem TTL. Hardware e jogo não mudam sozinhos.

### Procedência e confiança do FPS

O resultado separa três conceitos que não são equivalentes:

- `fonte` diz por qual elo ele foi obtido agora: Recomendação salva (`salvo`), Gemini, Groq ou exemplo.
- `geradoPor` preserva quem criou originalmente a recomendação, mesmo depois de um reaproveitamento salvo.
- `evidenciaDesempenho` preserva a referência externa do FPSHQ, quando existe, incluindo benchmark/predição, correspondência completa/parcial, preset, resolução, números recebidos, horário e URL de atribuição.

`confiancaFps: media` significa somente que o FPSHQ informou um benchmark com correspondência completa de jogo, GPU, CPU e resolução. Predição, correspondência parcial ou ausência de evidência recebem confiança `baixa`. Nenhum resultado desta versão recebe confiança alta: o FPSHQ mede ou projeta um preset completo, não cada opção individual escolhida. `fps_min` permanece identificado como mínimo informado pelo FPSHQ e não é chamado de “1% low”. O menu final e sua faixa de FPS continuam sendo inferências da IA ancoradas, quando possível, por essa evidência.

## Uso responsável do FPSHQ

A integração usa somente os endpoints REST documentados em `https://fpshq.com/api-docs/`; scraping de páginas não é permitido no projeto. A API não exige chave, portanto nenhuma credencial pública nova é adicionada ao bundle.

O FPSHQ pede atribuição visível e informa uso justo aproximado de 60 requisições por minuto por IP. O app preserva o link devolvido pela API e identifica separadamente benchmarks e predições. Uso sustentado acima desse limite exige combinar acesso próprio com o FPSHQ.

Antes de qualquer lançamento comercial, o responsável pelo produto precisa obter confirmação escrita do FPSHQ para o uso planejado. Consumir somente a API documentada, manter atribuição e respeitar uso justo reduz o risco, mas não substitui essa confirmação.

## O que ainda está torto

A chave da IA continua no bundle. Para produção, a chamada precisa sair do app.

`npm test`, `npm run lint` e `npm run typecheck` precisam passar.
