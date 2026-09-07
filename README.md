# SettingsCraft

Você informa o jogo, o hardware e a resolução. O SettingsCraft devolve as opções gráficas na ordem do menu do jogo, cada uma com um valor, uma justificativa curta e uma faixa estimada de FPS.

O app reaproveita recomendações salvas no dispositivo antes de consumir uma IA. Quando precisa gerar uma nova recomendação, tenta obter uma referência de desempenho no FPSHQ, chama o Gemini e usa o Groq como fallback. A referência externa ancora a geração, mas não substitui a recomendação produzida pela IA.

## Funcionalidades

- Autocomplete de placas de vídeo e processadores, com entrada livre para modelos que não estejam na lista.
- Validação e normalização de jogo, GPU, CPU, memória e resolução antes da consulta.
- Opção de lembrar GPU, CPU, memória e resolução no dispositivo; o jogo nunca é lembrado.
- Recomendações salvas localmente e reutilizadas em consultas equivalentes.
- Histórico das recomendações salvas, da mais recente para a mais antiga.
- Ação de gerar novamente, que ignora a leitura da recomendação salva e substitui o resultado daquela consulta.
- Procedência visível: origem da entrega, gerador original, data, confiança do FPS e atribuição do FPSHQ quando disponível.

## Rodando localmente

Use Node.js 20 ou mais recente e instale as dependências:

```bash
npm install
```

Crie um arquivo `.env.local` na raiz. Fora do modo de exemplo, configure ao menos um dos provedores:

```dotenv
EXPO_PUBLIC_GEMINI_API_KEY=sua_chave_aqui
EXPO_PUBLIC_GROQ_API_KEY=sua_chave_aqui
```

Cada chave é opcional individualmente. Um provedor sem credencial simplesmente fica fora da cadeia; se os dois estiverem configurados, Gemini é tentado antes de Groq.

Para trabalhar na interface sem rede nem consumo de quota:

```dotenv
EXPO_PUBLIC_USAR_RESULTADO_EXEMPLO=true
```

Nesse modo, o app usa um gerador local identificado como `exemplo`, não consulta o FPSHQ e não chama os provedores de IA.

> Variáveis `EXPO_PUBLIC_*` são incorporadas ao bundle em build time. As chaves ficam expostas no cliente. Em produção, as chamadas aos provedores de IA devem passar por um backend.

Comandos disponíveis:

```bash
npm start          # abre o menu do Expo
npm run android
npm run ios
npm run web
npm test
npm run lint
npm run typecheck
```

## Stack e estrutura

O projeto usa Expo SDK 54, expo-router v6, React Native 0.81, React 19.1, TypeScript estrito e New Architecture. Gemini é integrado por REST, Groq pelo AI SDK, persistência por AsyncStorage, validação por Zod e animações por Moti.

```text
app/                              rotas de consulta e histórico
components/                       campos, seletores, botões e apresentação do resultado
assets/data/hardware.ts           sugestões de GPUs e CPUs para o autocomplete
service/consulta-configuracoes.ts criação e identidade da consulta válida
service/hardware-lembrado.ts      preferência de hardware persistida
service/ai/
  recomendador-padrao.ts          composição dos adapters usados pelo app
  recomendador.ts                 orquestra a cadeia e finaliza o resultado
  recomendacao-salva.ts           persistência e listagem das recomendações
  provedor-fpshq.ts               evidência opcional de desempenho
  fonte-gemini.ts                 adapter REST do Gemini
  fonte-groq.ts                   adapter Groq via AI SDK
  schema.ts                       contratos Zod da IA, evidência e resultado
  prompt.ts                       instrução e prompt compartilhados pelos geradores
styles/                           tokens e StyleSheets compartilhados
```

O alias `@/*` aponta para a raiz do projeto.

## Fluxo de recomendação

1. `criarConsultaConfiguracoes()` valida os cinco campos, normaliza espaços e devolve uma `ConsultaConfiguracoes` imutável.
2. O recomendador procura uma recomendação salva para a identidade normalizada da consulta, exceto quando recebe `forcarNovaRecomendacao`.
3. Sem resultado salvo, o FPSHQ é consultado com orçamento total de 3 segundos. Falha, timeout, ausência ou ambiguidade de dados não interrompem a geração.
4. Gemini é tentado e Groq funciona como fallback. Respostas passam por `RespostaIaSchema`.
5. O recomendador acrescenta procedência, horário, versão do contrato, confiança e evidência; valida tudo com `ResultadoSchema`; salva o resultado; e então o entrega.

`consultarConfiguracoes()` nunca lança para a interface. Ele devolve `{ ok: true, resultado }` ou `{ ok: false, erro }`. Erros HTTP 400 e 401 encerram a cadeia por indicarem configuração inválida. Um 429 permite tentar o próximo gerador e produz uma mensagem específica se nenhum deles responder com sucesso.

Cada identidade de consulta conserva somente a recomendação mais recente. O histórico é uma visão dessas mesmas recomendações salvas, não um segundo armazenamento. `CONTRATO_VERSAO` também participa do namespace persistido: ao incrementá-la, os registros de versões anteriores deixam de ser carregados. Não há TTL.

## Contrato, procedência e confiança

`service/ai/schema.ts` é a fonte única dos contratos. O JSON Schema enviado ao Gemini é derivado de `RespostaIaSchema` em runtime; não mantenha uma segunda definição manual.

O resultado separa conceitos que não são equivalentes:

- `fonte` informa como ele foi obtido nesta consulta: recomendação salva (`salvo`), Gemini, Groq ou exemplo.
- `geradoPor` preserva quem criou originalmente a recomendação, inclusive quando ela é reaproveitada do dispositivo.
- `evidenciaDesempenho` guarda a referência externa do FPSHQ, incluindo benchmark ou predição, correspondência completa ou parcial, preset, resolução, valores recebidos, horário e URL de atribuição.

`confiancaFps: media` exige um benchmark com correspondência completa de jogo, GPU, CPU e resolução. Predição, correspondência parcial ou ausência de evidência recebem confiança `baixa`. Esta versão não atribui confiança alta: o FPSHQ mede ou projeta um preset completo, não cada opção escolhida pela IA. O campo `fps_min` é apresentado apenas como mínimo informado pelo FPSHQ, nunca como “1% low”.

O FPSHQ só é consultado para 1080p, 1440p e 4K. Jogo e GPU precisam ter correspondência inequívoca; CPU não localizada ainda permite evidência parcial. O provedor escolhe o preset de maior qualidade cujo FPS mínimo atinge 60 e, se nenhum atingir a meta, usa o resultado válido de melhor desempenho.

## Uso responsável do FPSHQ

A integração usa somente os endpoints REST documentados em [fpshq.com/api-docs](https://fpshq.com/api-docs/); scraping não faz parte do projeto. A API não exige chave, e a URL de atribuição devolvida é preservada e exibida ao jogador.

O serviço informa uso justo aproximado de 60 requisições por minuto por IP. Uso sustentado acima desse limite deve ser combinado diretamente com o FPSHQ. Antes de um lançamento comercial, obtenha confirmação escrita para o uso planejado; consumir apenas a API documentada, manter a atribuição e respeitar o limite reduz o risco, mas não substitui essa autorização.

## Antes de contribuir

Garanta que os três comandos terminem sem erros:

```bash
npm test
npm run lint
npm run typecheck
```

Não versione `.env.local` nem qualquer chave de API.
