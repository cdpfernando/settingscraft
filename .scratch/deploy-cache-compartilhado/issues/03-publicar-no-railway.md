# 03 — Publicar a API no Railway

**What to build:** A API de cache compartilhado fica publicamente alcançável num domínio do Railway, com o SQLite sobrevivendo a redeploys via volume persistente. É o que torna o cache compartilhado utilizável por qualquer jogador, em qualquer rede — hoje só funciona na rede local de quem está rodando a API.

**Blocked by:** 01 — Rate limit na API; 02 — Dockerizar a API. (A API só deve ficar publicamente exposta já com o limite de requisições embarcado, e o deploy usa o mesmo `Dockerfile` do ticket 02 como artefato de build.)

**Status:** ready-for-agent

- [ ] Serviço Railway criado a partir do repositório, com Root Directory apontando para `api/` e build via `api/Dockerfile`
- [ ] Volume persistente do Railway montado no serviço, com `DATABASE_URL` apontando para um arquivo dentro dele
- [ ] Domínio público gerado pelo Railway para o serviço
- [ ] `CACHE_WRITE_TOKEN` não é configurada no serviço — escrita permanece aberta, decisão já registrada na spec
- [ ] Push no branch conectado dispara redeploy automático (comportamento padrão do Railway ao linkar o repositório) — nenhum pipeline de CI adicional necessário
- [ ] Verificado manualmente: endpoint público responde, `/docs` acessível, `POST` seguido de `GET` confirma persistência, e um redeploy (ex.: push trivial) não apaga o registro gravado antes; documentar o roteiro e a URL pública nos comentários desta issue
