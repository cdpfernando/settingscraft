# SettingsCraft

Expo SDK 54. O jogador informa jogo, GPU, CPU, memória e resolução. O app valida a consulta, reaproveita uma Recomendação salva quando possível e, para novas gerações, combina Evidência de desempenho opcional com Gemini e Groq.

## Expo 54

Antes de escrever código de Expo ou React Native, consulte a documentação da versão usada pelo projeto:

https://docs.expo.dev/versions/v54.0.0/

- Roteamento é file-based em `app/`; não monte React Navigation manualmente.
- `newArchEnabled`, `experiments.typedRoutes` e `experiments.reactCompiler` estão ativos em `app.json`.
- Variáveis disponíveis no cliente precisam do prefixo `EXPO_PUBLIC_` e são incorporadas ao bundle em build time.
- `metro.config.js` força a variante ESM do `tslib` para compatibilidade de bundling. Preserve esse resolver ao alterar o Metro.

## Vocabulário do domínio

- **Consulta de configurações**: combinação válida e normalizada de jogo, GPU, CPU, memória e resolução.
- **Recomendação salva**: recomendação persistida no dispositivo para uma identidade de consulta. Evite “cache” e “item de histórico”.
- **Histórico de recomendações**: visão das Recomendações salvas; não é um armazenamento separado.
- **Nova recomendação**: geração que pula a leitura da Recomendação salva, mas ainda persiste o resultado novo.
- **Evidência de desempenho**: referência externa opcional do FPSHQ usada para ancorar a IA; não é a recomendação final.

Use português pt-BR em nomes de domínio, interface e comentários: `jogo`, `placaVideo`, `resolucao`.

## Estrutura

```text
app/
  _layout.tsx                     Stack raiz
  index.tsx                       formulário e resultado da consulta
  historico.tsx                   lista e detalhe das Recomendações salvas
components/                       componentes visuais reutilizáveis
assets/data/hardware.ts           sugestões do autocomplete; não é lista de validação
service/
  consulta-configuracoes.ts       cria, normaliza e identifica ConsultaConfiguracoes
  hardware-lembrado.ts            persiste GPU, CPU, memória e resolução
  armazenamento.ts                porta mínima de armazenamento chave-valor
  ai/
    fonte.ts                      contratos de gerador, evidência, transporte e erros
    recomendador.ts               módulo deep que percorre a cadeia e finaliza resultados
    recomendador-padrao.ts        composition root dos adapters usados pela interface
    recomendacao-salva.ts         busca, sobrescrita e listagem persistida
    provedor-fpshq.ts             resolução de entidades e evidência opcional
    fonte-gemini.ts               adapter REST do Gemini
    fonte-groq.ts                 adapter Groq pelo AI SDK
    schema.ts                     contratos Zod de RespostaIa, Resultado e evidência
    prompt.ts                     instrução e prompt comuns aos geradores
    formatacao.ts                 rótulos de apresentação da evidência
styles/
  tokens.ts                       cores, espaçamentos, tipografia e raios
  primitives.ts                   StyleSheets que consomem os tokens
  index.ts                        superfície pública de `@/styles`
```

O alias `@/*` aponta para a raiz em `tsconfig.json`.

## Consulta válida

`criarConsultaConfiguracoes(entrada)` é a única porta para construir `ConsultaConfiguracoes`. Ela exige os cinco campos, normaliza espaços, aceita memória e resolução apenas entre as opções exportadas e devolve uma união discriminada com a consulta imutável ou erros por campo.

Não monte objetos `ConsultaConfiguracoes` à mão nem espalhe validação equivalente pela UI ou pelos adapters. `identificarConsultaConfiguracoes()` define a identidade estável usada pela persistência; mudanças nessa função afetam o reaproveitamento de recomendações.

As listas de GPU e CPU em `assets/data/hardware.ts` alimentam sugestões, mas os campos continuam aceitando texto livre. O hardware lembrado nunca inclui o jogo. Ativar a preferência recupera o perfil existente e uma consulta válida atualiza esse perfil; desativá-la apaga o registro.

## Cadeia de recomendação

A ordem é: Recomendação salva → Evidência de desempenho opcional → Gemini → Groq.

- `recomendador-padrao.ts` é o único lugar que lê as variáveis de ambiente e compõe adapters concretos.
- `consultarConfiguracoes()` recebe somente `ConsultaConfiguracoes` e nunca lança para a tela. Retorna `ConsultaResultado`: `{ ok: true, resultado }` ou `{ ok: false, erro }`.
- `forcarNovaRecomendacao` pula apenas a busca local. Uma geração bem-sucedida continua sendo salva e substitui a recomendação anterior da mesma identidade.
- Falhas de leitura ou escrita do armazenamento são registradas, mas não impedem uma geração bem-sucedida.
- Adapter sem credencial fica fora da cadeia. Se nenhum gerador estiver configurado, a consulta termina no erro genérico.
- HTTP 400 e 401 geram `ErroFonteConfiguracao` e interrompem a cadeia. HTTP 429 gera `ErroFonteLimite`, permite o fallback e tem mensagem própria se nenhum gerador tiver sucesso.
- Falha de rede, timeout, 5xx, resposta vazia ou conteúdo inválido de um gerador permitem tentar o próximo.
- `EXPO_PUBLIC_USAR_RESULTADO_EXEMPLO=true` troca toda a geração por um adapter in-process chamado `exemplo` e desativa FPSHQ, Gemini e Groq.

Gemini usa REST direto em `generativelanguage.googleapis.com/v1beta`; Groq usa AI SDK. O modelo e o timeout de cada provedor ficam no topo do respectivo adapter. Chaves locais: `EXPO_PUBLIC_GEMINI_API_KEY` e `EXPO_PUBLIC_GROQ_API_KEY`.

As chaves `EXPO_PUBLIC_*` ficam no bundle. Para produção, mova as chamadas de IA para um backend.

## Recomendação salva e histórico

`recomendacao-salva.ts` é a autoridade única da persistência de recomendações. Cada identidade conserva somente o resultado mais recente. `listar()` lê o mesmo conjunto usado por `buscar()` e ordena por `geradoEm` decrescente.

Registros são revalidados ao ler. JSON ilegível, consulta inválida ou resultado fora do contrato são removidos e tratados como ausência; falhas reais do armazenamento continuam sendo propagadas pelo repositório e tratadas por quem o chama.

`CONTRATO_VERSAO` participa tanto do schema quanto do prefixo das chaves. Incrementá-la torna os registros anteriores incompatíveis sem migração. Não há TTL.

## Schema e procedência

`schema.ts` declara `RespostaIaSchema` uma vez. `fonte-gemini.ts` deriva dele o JSON Schema por `z.toJSONSchema`, filtrado em `paraSchemaGemini`. Não escreva um JSON Schema paralelo.

Os geradores devolvem apenas `RespostaIa`: `configuracoes` e `fpsEstimado`. O recomendador acrescenta `fonte`, `geradoPor`, `geradoEm`, `versaoContrato`, `confiancaFps` e `evidenciaDesempenho`, e valida o objeto final com `ResultadoSchema` antes de salvar ou devolver.

- `fonte` indica o elo que entregou o resultado agora: `salvo`, `gemini`, `groq` ou `exemplo`.
- `geradoPor` preserva o gerador original mesmo em uma leitura salva.
- Confiança `media` exige benchmark FPSHQ com correspondência completa e CPU presente. Todos os outros casos são `baixa`; não existe confiança alta no contrato atual.

Se alterar Zod, prompt ou metadados finais, mantenha alinhados Gemini, Groq, persistência, apresentação e testes.

## FPSHQ

O FPSHQ é enriquecimento best-effort e tem orçamento total padrão de 3 segundos. Nunca deve impedir a geração nem entregar sozinho uma recomendação.

- Use somente os endpoints REST documentados; não faça scraping.
- 720p não tem mapeamento e pula o provedor. Os mapeamentos suportados são 1080p, 1440p e 4K.
- Jogo e GPU precisam resolver para um único candidato. CPU ausente ou ambígua permite correspondência parcial.
- A normalização remove `AMD`, `Intel` e `NVIDIA` do início de nomes de hardware nos dois lados da comparação.
- Correspondência afrouxada por slug ou sufixo de edição vale somente para jogos e somente quando a página de busca não está cheia. Não aplique fuzzy matching a hardware nem escolha candidatos ambíguos.
- Consulte os quatro presets. Prefira o de maior qualidade cujo `fps_min` atinja 60; sem um preset na meta, escolha o melhor desempenho por mínimo, média, máximo e qualidade.
- Valide a resposta contra a consulta resolvida, preserve `benchmark` versus `predicao` e mantenha a URL de atribuição do FPSHQ.
- `fps_min` significa mínimo informado pela API, não “1% low”.

Uso comercial e volume sustentado acima do fair use informado pelo FPSHQ exigem alinhamento prévio com o serviço.

## Convenções

- TypeScript `strict`; tipar entradas e saídas de `service/`.
- Estilos somente pelo sistema em `@/styles`; sem estilo inline nem `StyleSheet.create` em componentes.
- Animação com `moti` e respeito a `useReducedMotion`.
- Cada tela em `app/` usa `export default`.
- Dependências externas ficam atrás de adapters ou portas pequenas para permitir testes determinísticos.
- Preserve alterações existentes do usuário e não versione segredos.

## Comandos

```bash
npm start
npm run android
npm run ios
npm run web
npm test
npm run lint
npm run typecheck
```

## Antes de entregar

1. Execute `npm test`, `npm run lint` e `npm run typecheck`.
2. Se mexeu no Zod ou no prompt, confirme os contratos dos dois provedores e os testes de schema.
3. Se mexeu na persistência, cubra leitura inválida, identidade, sobrescrita e falhas reais do armazenamento.
4. Se mexeu no FPSHQ, cubra casos unitários e a massa real versionada, sem acessar a rede nos testes.
5. Confirme que nenhuma chave ou `.env.local` entrou no diff.
