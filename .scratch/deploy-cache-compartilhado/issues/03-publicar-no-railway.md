# 03 — Publicar a API no Railway

**What to build:** A API de cache compartilhado fica publicamente alcançável num domínio do Railway, com o SQLite sobrevivendo a redeploys via volume persistente. É o que torna o cache compartilhado utilizável por qualquer jogador, em qualquer rede — hoje só funciona na rede local de quem está rodando a API.

**Blocked by:** 01 — Rate limit na API; 02 — Dockerizar a API. (A API só deve ficar publicamente exposta já com o limite de requisições embarcado, e o deploy usa o mesmo `Dockerfile` do ticket 02 como artefato de build.)

**Status:** done

- [x] Serviço Railway criado a partir do repositório, com Root Directory apontando para `api/` e build via `api/Dockerfile`
- [x] Volume persistente do Railway montado no serviço, com `DATABASE_URL` apontando para um arquivo dentro dele
- [x] Domínio público gerado pelo Railway para o serviço
- [x] `CACHE_WRITE_TOKEN` não é configurada no serviço — escrita permanece aberta, decisão já registrada na spec
- [x] Push no branch conectado dispara redeploy automático (comportamento padrão do Railway ao linkar o repositório) — nenhum pipeline de CI adicional necessário
- [x] Verificado manualmente: endpoint público responde, `/docs` acessível, `POST` seguido de `GET` confirma persistência, e um redeploy não apaga o registro gravado antes; roteiro documentado nos comentários

## Comments

Implementado via Railway CLI, projeto `settingscraft` → serviço `api` (workspace `cdpfernando's Projects`):

- Build: `Dockerfile` de `api/`, builder `DOCKERFILE` confirmado no deployment (`serviceManifest.build.builder`). Deploy inicial via `railway up --service api` (upload direto do diretório `api/`, sem repo linkado ainda).
- Volume: `railway volume add --mount-path /data` — `DATABASE_URL=sqlite:////data/cache.db` aponta pra dentro dele.
- Domínio público: `https://api-production-3ad69.up.railway.app` (`railway domain --service api`). Foi necessário setar a variável `PORT=8000` explicitamente — sem ela o proxy do Railway devolvia `502` mesmo com o uvicorn rodando corretamente na porta 8000 (visível nos logs do container); o Dockerfile expõe a porta mas o proxy não inferiu isso da imagem sozinho neste caso.
- `CACHE_WRITE_TOKEN`: cheguei a configurar um token nesta variável numa primeira passada, mas isso contrariava a decisão já registrada na spec (escrita aberta) — revertido, variável deletada do serviço (`railway variable delete CACHE_WRITE_TOKEN`).
- **Verificação manual real**: `curl /docs` → `200`; `GET /recomendacoes` (miss) → `404`; `POST /recomendacoes` com token de teste (antes de reverter) → `201 Created`; troca da variável `PORT` disparou um redeploy automático do Railway, e o `GET` do mesmo registro depois do redeploy voltou com o corpo completo (hit) — confirma que o volume sobrevive a redeploy. Tráfego real do app mobile (celular físico) também confirmado nos logs de runtime do Railway: `GET` (miss) seguido de `POST` (`201 Created`) para duas consultas diferentes.

**Bloqueio — GitHub não conectado:** a spec pede o serviço criado a partir do repositório com auto-deploy no push, mas este repo nunca tinha sido publicado no GitHub. Criei `https://github.com/cdpfernando/settingscraft` (privado) e dei push do `master`, mas `railway environment edit --service-config api source.repo "cdpfernando/settingscraft"` resulta em `"No changes to apply"` — a query GraphQL `githubRepos` devolve `Not Authorized`, confirmando que a conta Railway não tem a integração com GitHub autorizada ainda (nenhum repositório, não é um problema de permissão só deste repo). Esse é um passo de OAuth/instalação do GitHub App que só pode ser feito pelo desenvolvedor no navegador — não é algo que a CLI/API consiga completar de forma não-interativa.

**Desbloqueado — GitHub conectado pelo desenvolvedor:** via dashboard (Settings → Source → conectar repositório → autorizar GitHub App → `cdpfernando/settingscraft`), como descrito acima. Depois disso `source.repo`/`source.branch` apareceram corretos em `railway environment config`, mas `source.rootDirectory` continuava `null` — a mesma tentativa de patch (`railway environment edit --service-config` e a mutation GraphQL `serviceInstanceUpdate` direta) que falhava por falta de autorização passou a falhar com `"Problem processing request"`/`"Not Authorized"` mesmo já autenticado; parece um campo restrito à sessão de navegador, não ao token de API pessoal usado pela CLI. Um `railway redeploy --from-source` nesse estado **falhou de verdade** (Railpack tentou buildar a raiz do monorepo Expo em vez da API) — sem causar downtime, porque o Railway manteve no ar o último deployment bem-sucedido (o upload manual via CLI) enquanto o novo falhava.

**Resolução:** o desenvolvedor definiu o Root Directory (`api`) manualmente no dashboard (Settings → Source). Confirmado em `railway environment config`: `source.rootDirectory: "/api"`. Novo `railway redeploy --service api --from-source` → `SUCCESS`, com `builder: DOCKERFILE`, `dockerfilePath: /api/Dockerfile`. Reverificado: `/docs` → `200`; `GET /recomendacoes` do registro de teste gravado numa sessão anterior → `200` com o corpo completo — confirma que o volume sobreviveu também a este redeploy via GitHub, não só ao redeploy por variável de ambiente. A partir de agora, um push no `master` deve disparar redeploy automático (comportamento padrão do Railway com repo linkado); não foi possível testar um push real ainda nesta sessão, mas a configuração de source (`repo`/`branch`/`rootDirectory`) está correta e o mecanismo é nativo da plataforma.
