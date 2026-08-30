# Spec — SettingsCraft v2

**Status:** ready-for-agent

Origem: sessão de grilling (Q1–Q31), consolidada e confirmada pelo desenvolvedor.

## Problema

O SettingsCraft hoje recebe jogo, placa de vídeo, processador, memória e resolução, manda tudo para o Gemini e mostra o texto de volta. Funciona no caminho feliz e falha mal em todo o resto:

- **A resposta chega como texto livre** e é interpretada por um parser que quebra por dois-pontos e pelo travessão. Basta o modelo usar hífen comum, ou pôr dois-pontos dentro da justificativa, e a tela cai no fallback de texto cru — sem erro, sem aviso, sem forma de perceber.
- **Cada consulta é uma chamada nova.** O mesmo jogador, com o mesmo hardware, no mesmo jogo, gasta quota e espera cinco segundos toda vez. Nada é lembrado.
- **Um provedor só.** Gemini fora do ar, com quota estourada ou lento significa app inútil.
- **A interface não comunica estado.** O botão não desabilita durante a chamada, campos vazios são aceitos e enviados, e três linguagens visuais concorrentes (coral, turquesa, card escuro sobre fundo claro) tornam o resultado difícil de ler.
- **Não há memória entre sessões.** Fechou o app, perdeu a recomendação.

## Solução

Um app de tela dupla, tema escuro coeso, onde o jogador descreve o hardware com auxílio de autocomplete e recebe as configurações gráficas na ordem do menu do jogo — cada uma com valor, justificativa curta e uma estimativa de FPS.

Por trás, as recomendações deixam de vir de uma chamada e passam a vir de uma **cadeia de fontes** consultada em ordem: primeiro o que já está guardado no aparelho, depois (futuramente) um cache compartilhado num backend, depois o Gemini, depois o Groq. A primeira fonte que responder ganha. O jogador vê de onde veio o resultado, e pode forçar uma geração nova quando não gostar do que recebeu.

O resultado vira dado estruturado e validado, não texto. Consultas anteriores ficam salvas e acessíveis numa tela de histórico.

## Histórias de usuário

1. Como jogador, quero informar o nome do jogo, para receber recomendações específicas daquele título.
2. Como jogador, quero escolher minha placa de vídeo a partir de uma lista com autocomplete, para não digitar um modelo longo no teclado do celular.
3. Como jogador, quero escolher meu processador a partir de uma lista com autocomplete, pelo mesmo motivo.
4. Como jogador, quero digitar livremente quando meu componente não estiver na lista, para não ficar bloqueado por um hardware incomum.
5. Como jogador, quero selecionar a quantidade de memória RAM num seletor, para não errar o formato.
6. Como jogador, quero selecionar a resolução alvo entre opções conhecidas, para comparar cenários com rapidez.
7. Como jogador, quero ser avisado quando deixar um campo obrigatório vazio, para não disparar uma consulta inútil.
8. Como jogador, quero que o botão fique desabilitado enquanto a consulta acontece, para não disparar duas chamadas sem querer.
9. Como jogador, quero um indicador claro de carregamento, para saber que o app está trabalhando e não travado.
10. Como jogador, quero ver as configurações na ordem exata em que aparecem no menu do jogo, para aplicá-las de cima para baixo sem procurar.
11. Como jogador, quero ver o valor recomendado destacado de cada configuração, para aplicar sem ler o texto todo.
12. Como jogador, quero uma justificativa curta em cada configuração, para entender o motivo e decidir se concordo.
13. Como jogador, quero uma estimativa de FPS na resolução escolhida, para saber o que esperar antes de jogar.
14. Como jogador, quero saber de onde veio a recomendação — do que já estava salvo ou de qual provedor de IA — para confiar no que estou vendo.
15. Como jogador, quero saber quando a recomendação foi gerada, para julgar se ainda vale.
16. Como jogador, quero receber instantaneamente o resultado quando já consultei aquele mesmo jogo com aquele mesmo hardware, para não esperar de novo.
17. Como jogador, quero um botão de gerar novamente, para pedir uma resposta nova quando a guardada não me convencer.
18. Como jogador, quero que a resposta nova substitua a antiga, para não acumular versões conflitantes do mesmo cenário.
19. Como jogador, quero acessar uma tela de histórico, para reencontrar consultas que fiz antes.
20. Como jogador, quero abrir uma consulta do histórico e ver o resultado completo, para não precisar refazer a busca.
21. Como jogador, quero que meu histórico sobreviva ao fechamento do app, para não perder o que já pesquisei.
22. Como jogador, quero continuar recebendo recomendações mesmo quando o provedor principal falhar, porque o problema dele não deveria ser meu.
23. Como jogador, quero mensagens de erro compreensíveis quando nada der certo, para saber se tento de novo ou desisto.
24. Como jogador, quero uma interface escura e legível, porque olho para ela em ambiente de jogo.
25. Como jogador, quero que o app não trave esperando um serviço lento, para não ficar preso numa tela morta.
26. Como desenvolvedor, quero que a resposta da IA seja validada contra um schema antes de chegar à tela, para que dado malformado falhe alto em vez de virar tela quebrada.
27. Como desenvolvedor, quero uma única declaração do schema, para que os dois provedores nunca divirjam de contrato.
28. Como desenvolvedor, quero acrescentar um novo provedor ou um backend implementando uma interface só, para não tocar na interface gráfica.
29. Como desenvolvedor, quero que um provedor sem credencial configurada simplesmente não entre na cadeia, para que uma chave ausente nunca vire erro em tempo de execução.
30. Como desenvolvedor, quero um resultado de exemplo embutido, para ajustar layout sem gastar quota nem esperar cinco segundos por iteração.
31. Como desenvolvedor, quero invalidar todo o cache incrementando um número de versão, para não caçar bugs causados por resposta velha em formato novo.
32. Como desenvolvedor, quero montar a cadeia de fontes na borda da aplicação, para poder exercitá-la depois com fontes falsas.
33. Como avaliador do trabalho, quero clonar o repositório, configurar minha própria variável de ambiente e rodar, para verificar a integração com a IA por mim mesmo.
34. Como avaliador do trabalho, quero um README que explique arquitetura e decisões, para julgar a organização da solução.

## Decisões de implementação

### Contrato com a IA

- A saída da IA passa a ser **JSON estruturado**, não texto livre. O parser artesanal por travessão é removido.
- **Zod é a fonte única de verdade do schema.** O JSON Schema enviado ao Gemini é *derivado* do Zod em tempo de execução, nunca escrito à mão em paralelo — duas declarações do mesmo contrato divergem, e a divergência só se manifesta quando o fallback dispara.
- **Gemini permanece em `fetch` direto** contra a REST API, com o schema derivado na configuração de geração.
- **Groq entra via AI SDK**, que exige polyfills do Expo (`structuredClone`, `TextEncoderStream`, `TextDecoderStream`) importados na raiz. Os polyfills entram apenas no bloco do Groq, nunca antes.
- `@ai-sdk/google` é removido das dependências — a decisão de manter o Gemini em `fetch` o torna permanentemente morto.

### Cadeia de fontes

Toda origem de recomendação implementa a mesma porta, e um resolvedor percorre a cadeia parando na primeira que responder. O formato da porta e do resultado é o núcleo da arquitetura, e prosa os descreve pior que o tipo:

```ts
interface Fonte {
  nome: string;
  buscar(consulta: Consulta): Promise<Resultado | null>;
}

interface Resultado {
  configuracoes: { nome: string; valor: string; justificativa: string }[];
  fpsEstimado: string;
  fonte: string;
  geradoEm: string;
  versaoContrato: number;
}
```

- Cadeia da fase inicial: **cache local → Gemini → Groq**. A fase do backend insere um elo HTTP entre o cache local e o Gemini, **sem alterar nenhuma linha da interface gráfica**.
- `Resultado` nasce **completo desde o primeiro bloco**, incluindo `fonte`, `geradoEm` e `versaoContrato`, mesmo enquanto só o Gemini o preenche. Isso permite desenhar a interface contra a forma final do dado.
- **A composição da cadeia acontece na borda da aplicação**, não dentro do resolvedor — o resolvedor recebe as fontes como parâmetro.
- **Elo sem credencial não entra na cadeia.** Regra única, válida para o Groq sem chave e para o backend sem URL: a ausência é resolvida na montagem, nunca como erro em tempo de execução.
- **Gatilhos de fallback:** rede, timeout, 5xx, 429 e JSON que não valida. **Nunca 401 ou 400** — erro de configuração não se resolve repetindo, só queima quota.
- A interface mostra um selo discreto de origem. Sem ele o fallback é invisível e indemonstrável.

### Cache e persistência

- Chave = campos da consulta normalizados (minúsculas, espaços colapsados) **mais o número da versão do contrato**. Incrementar a versão ao mudar prompt ou schema invalida todo o cache antigo sem migração.
- **Sem TTL.** Hardware e jogo não mudam sozinhos.
- **Botão "gerar novamente"** ignora o cache e sobrescreve o registro; sem ele, uma resposta ruim ficaria cravada para sempre naquele hardware.
- Persistência local em armazenamento chave-valor (AsyncStorage), **atrás de um repositório encapsulado** — o volume não justifica SQL, e a troca por SQLite depois fica contida num módulo.

### Interface

- **Design system em camadas**: tokens (cores, espaçamentos, tipografia, raios) e primitivos reutilizáveis, com as folhas de estilo das telas consumindo os tokens. Isso substitui a convenção atual de folha única achatada, e a documentação do projeto é atualizada no mesmo commit.
- **Tema escuro único**, derivado do azul-escuro que o card de resultado já usa, com um acento só. Escuro fixo evita manter a matriz claro/escuro em duas telas.
- **Autocomplete sobre dataset local** de GPUs e CPUs (arquivo estático, sem chamada extra), seletores para RAM e resolução, campo livre permitido como escape. Além da usabilidade, isso elimina a maior parte da variação que destruiria a taxa de acerto do cache.
- **Navegação em Stack** com cabeçalho configurado e acesso ao histórico — duas telas em relação hierárquica não justificam abas. Dependências de abas herdadas do template são removidas.
- Validação de campos obrigatórios, botão desabilitado durante a chamada, e um resultado de exemplo atrás de flag para iterar layout sem consumir quota.

### Backend (fase final)

- **FastAPI**, em pasta própria no mesmo repositório, com SQLite e SQLModel. Mesmo repositório porque app e API compartilham contrato; a documentação interativa gerada é a forma mais barata de demonstrar a API.
- **Papel: cache compartilhado, não proxy.** No miss, quem chama a IA continua sendo o app, que depois publica o resultado. O app segue funcional com o backend fora do ar. Virar proxy completo — o que finalmente resolveria a exposição da chave no bundle — é um passo posterior, fora desta spec.
- **Leitura envia os campos crus**, e o **servidor calcula a chave**. Assim a normalização que governa a base existe num lugar só; uma divergência do lado do cliente custa no máximo um miss local, nunca duas linhas para o mesmo hardware.
- Miss é resposta 404 com corpo vazio — o elo lê o status e devolve ausência, sem interpretação especulativa.
- **Escrita** exige token compartilhado em cabeçalho, conferido contra variável de ambiente; se a variável não estiver definida no servidor, a escrita fica aberta para desenvolvimento local. Conflito de chave existente é ignorado por padrão, com sobrescrita explícita via parâmetro — que é exatamente o que o botão "gerar novamente" envia.
- **O servidor revalida o payload** antes de gravar. Cache que aceita qualquer coisa corrompe em silêncio e só se manifesta no aparelho de outra pessoa.
- O registro guarda também a contagem de reaproveitamentos — prova numérica de que o cache trabalha.
- No app: **timeout curto (~1,5s) e seguir adiante em silêncio**. Se o cache compartilhado não respondeu rápido, não vale a espera; a IA levará mais que isso de qualquer forma. Erro do backend nunca chega ao usuário.

### Sequenciamento

1. Fundação e portões — limpeza do template, tokens, primitivos, tema, documentação reescrita, `lint` e verificação de tipos como portão.
2. Contrato tipado — Zod canônico, schema derivado, Gemini em JSON, `Resultado` completo, resultado de exemplo.
3. Interface — autocomplete, validação, estados de carregamento, selo de origem, layout final.
4. Cadeia e persistência — porta, resolvedor, cache local, gerar novamente, histórico e navegação.
5. Fase distribuída — Groq com AI SDK, depois a API e o elo HTTP.

A ordem 2 antes de 3 é deliberada: a interface precisa de um resultado tipado para ser desenhada contra a forma final. O Groq fica por último porque arrasta os polyfills, e polyfill quebrado no meio do desenvolvimento da interface é o pior momento para descobrir.

## Decisões de teste

**Verificação é manual nesta entrega.** Testes automatizados foram deliberadamente adiados pelo desenvolvedor — não cancelados. A consequência aceita de olhos abertos: o fallback entre provedores e a chave de cache são exatamente os pontos que falham em silêncio e que teste manual não alcança (não se provoca um 5xx do Gemini à mão, e chave divergente não falha — só deixa de acertar).

Por isso a decisão de teste que **entra agora** é estrutural, não de cobertura: o código nasce com a costura no lugar certo.

- **Um seam, o mais alto possível: o resolvedor da cadeia.** Ponto de entrada único, com duas injeções — a lista de fontes, e o transporte HTTP dentro de cada fonte de provedor.
- Esse seam único cobre tudo que importa: ordem da cadeia, gatilhos de fallback, elo pulado por credencial ausente, acerto e erro de chave de cache, e resposta de provedor malformada (via transporte falso).
- **Um bom teste aqui exercita comportamento externo**: dada uma cadeia e uma consulta, qual resultado sai e quais fontes foram tocadas. Nunca a estrutura interna do resolvedor.
- **Sem seam próprio, por decisão:** as telas (render de React Native exige infraestrutura desproporcional; verificação manual); a normalização da chave (função pura, alcançável através do resolvedor — duas consultas formatadas diferente devem acertar o mesmo cache).
- **A API terá seu próprio seam natural** quando existir, no cliente de teste do FastAPI.
- **Prior art: nenhuma.** O repositório não tem testes hoje; este será o primeiro, e o formato fica em aberto até o bloco de testes ser retomado.

## Fora de escopo

- Testes automatizados e integração contínua — adiados, com o seam preparado.
- Backend como proxy completo de IA. Enquanto o app chamar a IA diretamente, **a chave do Gemini permanece exposta no bundle** — limitação conhecida e aceita nesta fase.
- Hospedagem da API. Roda local, acessada pelo IP da máquina na rede (não `localhost`, que o app no dispositivo não enxerga). Publicar é mudança de variável de ambiente, não de código.
- Autenticação de usuário, contas e sincronização entre dispositivos.
- Tema claro, internacionalização, e navegação por abas.
- Detecção automática de hardware do aparelho.
- Validação da correção técnica das recomendações da IA — o app apresenta o que o modelo responde.

## Notas

- **Contexto acadêmico.** É o trabalho final de uma disciplina de React Native, avaliado por criatividade, uso correto de React Native e integração com API de IA, e organização da solução. Nada além disso pontua diretamente — a fase distribuída existe por interesse técnico do desenvolvedor, não por exigência do enunciado, e por isso vem por último.
- **Entrega.** O avaliador clona o repositório e configura a própria variável de ambiente; nenhuma chave é versionada. O README atual ainda é o boilerplate do `create-expo-app` e é reescrito no primeiro bloco — junto com a documentação de convenções do projeto, que descreve uma estrutura que esta spec substitui.
- **Riscos aceitos conscientemente:** chave da IA exposta no cliente; fallback e chave de cache sem cobertura automatizada; cache "compartilhado" restrito a uma máquina enquanto a API não for hospedada.
