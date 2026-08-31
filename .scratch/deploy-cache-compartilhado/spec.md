# Spec — Publicar o cache compartilhado no Railway

**Status:** ready-for-agent

Origem: pedido direto do desenvolvedor, consolidado a partir do estado atual de `api/` (ticket 13, concluído) e `service/ai/cache-compartilhado.ts` (ticket 14, concluído), que hoje só funcionam com a API rodando na máquina local, na mesma rede Wi-Fi do dispositivo.

## Problem Statement

O cache compartilhado (`api/`) só roda na máquina do desenvolvedor. Para qualquer outra pessoa usar o app — inclusive o próprio jogador em uma rede diferente, ou um avaliador clonando o repositório — é preciso subir a API manualmente e digitar o IP da máquina em `EXPO_PUBLIC_CACHE_API_URL`. Na prática, ninguém além de quem está com a API local ligada se beneficia do cache: cada instalação do app volta a gastar quota de IA para o mesmo hardware que outra pessoa já consultou.

Além disso, hoje não existe uma forma reproduzível de subir a API fora do `uv run uvicorn` manual documentado no `api/README.md` — sem Docker, reproduzir o ambiente de produção localmente depende de instalar Python 3.12 e `uv` à mão. E, no momento em que a API passa a ser publicamente alcançável pela internet (em vez de só na rede local), ela fica exposta a tráfego de qualquer origem, sem nenhuma proteção contra abuso — hoje não existe limite de requisições.

## Solution

A API de cache compartilhado passa a rodar publicada no Railway, com um `docker-compose` que reproduz esse mesmo ambiente localmente para desenvolvimento e depuração. Os dois endpoints ganham proteção de rate limit por IP, para que a exposição pública não vire uma porta aberta para abuso. O app passa a apontar para essa API hospedada **por padrão** — sem precisar configurar nada — e continua permitindo apontar para uma instância própria (local ou auto-hospedada) sobrescrevendo `EXPO_PUBLIC_CACHE_API_URL` no `.env.local`.

## User Stories

1. Como jogador, quero que o app já se beneficie do cache compartilhado assim que eu instalo/rodo o app, sem precisar configurar nenhuma variável de ambiente, para aproveitar consultas que outros jogadores já fizeram.
2. Como jogador, quero que uma consulta repetida (mesmo jogo, mesmo hardware) de qualquer pessoa, em qualquer rede, tenha chance de vir do cache compartilhado, não só de quem está na mesma rede Wi-Fi da API.
3. Como jogador, quero que a API hospedada fora do ar não trave nem quebre o app — a cadeia deve seguir em silêncio para os provedores de IA, exatamente como já acontece hoje com a API local.
4. Como desenvolvedor, quero rodar a API localmente via `docker-compose up`, sem instalar Python nem `uv` na máquina, para reduzir o atrito de setup e reproduzir o mesmo ambiente do Railway.
5. Como desenvolvedor, quero que o `docker-compose` persista o SQLite entre reinicializações do container, para não perder dados de cache toda vez que eu reiniciar o ambiente local.
6. Como desenvolvedor, quero publicar a API no Railway a partir do `Dockerfile` de `api/`, para que o build de produção seja o mesmo artefato testado localmente via `docker-compose`.
7. Como desenvolvedor, quero que o SQLite da instância do Railway sobreviva a redeploys, para não perder o cache acumulado toda vez que eu publicar uma alteração.
8. Como desenvolvedor, quero apontar meu app local para minha própria instância da API (local ou auto-hospedada), sobrescrevendo uma única variável de ambiente, para testar mudanças na API antes de publicá-las como padrão.
9. Como desenvolvedor, quero que a URL da API hospedada tenha um único ponto de definição no código do app, para atualizar o padrão sem caçar constantes espalhadas.
10. Como desenvolvedor, quero que a API pública tenha limite de requisições por IP nos dois endpoints, para que tráfego abusivo (ou um bug em loop no app) não esgote os recursos do serviço nem infle a fatura do Railway.
11. Como desenvolvedor, quero que os limites de rate limit sejam configuráveis por variável de ambiente, para ajustar o valor sem precisar publicar uma nova versão da API.
12. Como desenvolvedor, quero que passar do limite de requisições devolva um erro HTTP claro (429), para diferenciar abuso de uma falha real do servidor ao investigar logs.
13. Como desenvolvedor, quero que o rate limit seja por IP e não global, para que um cliente abusivo não derrube a experiência de todo mundo.
14. Como desenvolvedor, quero o README raiz e o `api/README.md` atualizados com as novas instruções (Docker, Railway, novo comportamento padrão da variável de ambiente), para que a documentação não fique defasada em relação ao código.
15. Como avaliador do trabalho, quero clonar o repositório, rodar o app sem configurar nada relacionado ao cache compartilhado, e ver o elo de cache compartilhado funcionando contra a instância pública, para avaliar a feature completa sem precisar subir a API eu mesmo.
16. Como avaliador do trabalho, quero instruções claras de como trocar para minha própria instância da API, para verificar que a portabilidade documentada realmente funciona.

## Implementation Decisions

### Containerização (`api/`)

- `api/Dockerfile`: imagem baseada em `python:3.12-slim`, instala dependências via `uv sync` (usa `api/pyproject.toml` + `api/uv.lock`, já existentes), expõe a porta do `uvicorn` e roda `uvicorn app.main:app --host 0.0.0.0 --port 8000` como comando padrão. Mesmo artefato serve para `docker-compose` local e para o build do Railway — não há Dockerfile duplicado.
- `docker-compose.yml`: fica dentro de `api/`, ao lado do Dockerfile — mantém a pasta autocontida e independente do projeto npm da raiz, mesmo princípio já registrado no comentário da ticket 13 ("independente do projeto npm na raiz"). Declara um serviço único (`api`), porta `8000:8000` publicada, variáveis de ambiente lidas de `api/.env` (mesmo arquivo que `api/README.md` já documenta), e um volume nomeado para persistir o arquivo SQLite entre `docker-compose up`/`down`.
- `DATABASE_URL` dentro do container aponta para um caminho dentro do volume montado (não mais o `./cache.db` relativo do processo local), para o volume realmente cobrir o arquivo do banco.
- `api/.env.example` ganha uma nota indicando que o mesmo arquivo é lido tanto pelo `uv run uvicorn` local quanto pelo `docker-compose`.

### Deploy no Railway

- Serviço Railway criado a partir do repositório GitHub, com **Root Directory** apontando para `api/` e build via Dockerfile (o mesmo `api/Dockerfile` do item anterior) — Railway detecta e builda o Dockerfile automaticamente quando o root directory contém um.
- Persistência: um **Railway Volume** montado no serviço, com `DATABASE_URL` apontando para um arquivo SQLite dentro desse volume — sem isso, cada redeploy apaga o cache acumulado (comportamento inaceitável dado que a ticket 13 já registra "sem TTL: hardware e jogo não mudam sozinhos", ou seja, o cache é para durar).
- Domínio público gerado pelo Railway (subdomínio `*.up.railway.app`) — é essa URL que vira o valor padrão embutido no app (ver seção seguinte).
- `CACHE_WRITE_TOKEN` **não** é definida no serviço do Railway nesta fase — decisão explícita do desenvolvedor de manter a escrita aberta mesmo com a API publicamente alcançável. O rate limit da escrita é a única proteção contra abuso de `POST /recomendacoes` por enquanto. Revisitar se abuso real for observado.
- Deploys subsequentes acontecem por push no branch conectado (comportamento padrão do Railway ao linkar um repositório GitHub) — não é necessário nenhum pipeline de CI adicional para este escopo.

### Rate limiting

- Biblioteca: `slowapi` (rate limiting nativo para FastAPI/Starlette, construído sobre `limits`), adicionada como dependência em `api/pyproject.toml`.
- Chave de limite: endereço IP do cliente (`get_remote_address` do `slowapi`, ou equivalente considerando o header de proxy do Railway, se necessário para o IP real chegar corretamente por trás do proxy da plataforma).
- Limites padrão, configuráveis por variável de ambiente (com esses valores como default quando a variável não está definida):
  - `GET /recomendacoes`: `RATE_LIMIT_LEITURA`, padrão `60/minute` por IP.
  - `POST /recomendacoes`: `RATE_LIMIT_ESCRITA`, padrão `10/minute` por IP.
- Armazenamento do estado do limitador em memória (padrão do `slowapi`) — suficiente porque o serviço roda como instância única no Railway nesta fase; não há necessidade de um backend compartilhado (Redis) enquanto não houver múltiplas instâncias.
- Resposta ao exceder o limite: comportamento padrão do `slowapi` (HTTP 429), sem corpo especial — consistente com o estilo minimalista já usado no miss do cache (404 vazio, "sem interpretação especulativa").
- `api/README.md` documenta os dois limites e as variáveis que os controlam.

### App — URL padrão do cache compartilhado

- Novo valor constante no `service/ai/` (mesmo módulo de `generator.ts` ou um módulo dedicado pequeno) com a URL pública do serviço no Railway — é o único lugar onde essa URL fica hardcoded.
- Nova função pura, por exemplo `resolverCacheApiUrl(envUrl: string | undefined): string`, que devolve `envUrl` quando definida (não vazia) e a constante hospedada como fallback caso contrário. `montarFontes()` passa a usar essa função em vez de checar `cacheApiUrl` diretamente antes de decidir se inclui o elo — o elo do cache compartilhado deixa de ser omitido por padrão; ele sempre entra na cadeia, apontando para a instância hospedada a menos que `EXPO_PUBLIC_CACHE_API_URL` esteja definida no `.env.local` com outro valor (própria instância, local ou auto-hospedada).
- `EXPO_PUBLIC_CACHE_API_TOKEN` continua opcional e sem valor padrão — a instância hospedada não exige token (decisão da seção anterior), então o header `X-Cache-Token` só é enviado quando o desenvolvedor configurar essa variável ao apontar para uma instância própria que exija token.
- Timeout, tratamento de erro, e publicação de volta (`publicarNoCacheCompartilhado`) não mudam — a mudança é só de onde vem a URL default.
- Root `README.md` atualizado: a seção da variável `EXPO_PUBLIC_CACHE_API_URL` deixa de dizer "sem ela, o elo não entra na cadeia" e passa a explicar que, por padrão, o app já usa a instância pública hospedada, e que a variável serve para apontar para uma instância própria.

## Testing Decisions

Decisão do desenvolvedor: **sem testes automatizados novos** nesta feature. Toda a verificação é manual, no mesmo estilo já registrado nos comentários das tickets 13 e 14 (`## Comments` documentando o que foi exercitado manualmente e depois descartado).

Roteiro de verificação manual esperado, a documentar nos comentários da issue de implementação:

- `docker-compose up` local sobe a API, `curl`/Swagger (`/docs`) respondem, e o volume persiste o SQLite entre `down`/`up`.
- Após alguns segundos batendo `GET /recomendacoes` acima do limite configurado, a resposta vira `429`; abaixo do limite, segue `200`/`404` normalmente.
- Mesmo teste de `429` para `POST /recomendacoes` no limite de escrita.
- Deploy no Railway: endpoint público responde, `/docs` acessível, `POST` seguido de `GET` confirma que o registro sobrevive a um redeploy (valida o volume).
- App sem nenhuma variável de cache configurada no `.env.local` já consulta a instância pública (visível pelo campo `fonte: 'compartilhado'` na tela/histórico quando há hit).
- App com `EXPO_PUBLIC_CACHE_API_URL` apontando para uma instância local sobrescreve o padrão — confirmar que a chamada vai para o IP local, não para o Railway.
- `npx tsc --noEmit` e `npm run lint` limpos (checklist padrão do "Antes de entregar" do `AGENTS.md`).

## Out of Scope

- Migrar o armazenamento de SQLite para um banco gerenciado (Postgres no Railway ou similar) — o volume persistente resolve a durabilidade sem trocar de banco.
- Múltiplas instâncias / escalonamento horizontal da API — o rate limit em memória e o SQLite em volume assumem instância única; escalar exigiria revisar os dois.
- Exigir token de escrita na instância hospedada — decisão explícita de manter aberta nesta fase (ver seção de implementação).
- Pipeline de CI/CD adicional além do auto-deploy padrão do Railway ao dar push no branch conectado.
- Resolver a exposição da chave do Gemini/Groq no bundle do app (`EXPO_PUBLIC_*` inlined em build time) — problema conhecido, já registrado no README, e não relacionado a este escopo.
- Qualquer mecanismo explícito para *desativar* o elo do cache compartilhado por completo (ex.: um valor especial tipo "off"). Como o elo já falha em silêncio e em até ~1,5s, apontar para uma URL própria (inclusive uma inatingível de propósito, se alguém quiser esse efeito) já cobre o caso sem precisar de um novo mecanismo.
- Autenticação/autorização além do token de escrita já existente (ex.: chave de API por cliente, allowlist de origem) — rate limit por IP é a única camada nova de proteção.

## Further Notes

- O plano gratuito/hobby do Railway tem limites de uso (recursos e possivelmente sleep por inatividade) — vale confirmar o plano antes de assumir disponibilidade 24/7 para os jogadores. Não é uma decisão deste spec, é uma restrição operacional a observar durante o deploy.
- O rate limit em memória reseta a cada redeploy/restart do serviço — aceitável dado que o objetivo é conter abuso contínuo, não impor uma cota rígida de longo prazo.
- Vale revisitar a necessidade de token de escrita obrigatório se o serviço público começar a receber tráfego de escrita fora do padrão esperado do app (registros com campos claramente forjados, por exemplo).
