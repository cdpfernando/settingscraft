# 02 — Dockerizar a API de cache compartilhado

**What to build:** A API roda via `docker-compose up` sem precisar instalar Python nem `uv` na máquina, com o SQLite persistindo entre reinicializações do container. É o mesmo artefato (Dockerfile) que depois vira a base do build no Railway — reduz o atrito de setup local e garante paridade entre ambiente local e produção.

**Blocked by:** Nenhum — pode começar imediatamente (independente do ticket 01, pode rodar em paralelo).

**Status:** done

- [x] `api/Dockerfile` builda a imagem a partir de `api/pyproject.toml`/`api/uv.lock` e sobe `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- [x] `api/docker-compose.yml` sobe o serviço com a porta `8000` publicada e variáveis de ambiente lidas de `api/.env`
- [x] Volume nomeado persiste o arquivo SQLite entre `docker-compose down` e `docker-compose up` — dado não se perde ao reiniciar
- [x] `DATABASE_URL` dentro do container aponta para um caminho dentro do volume montado, não para um caminho relativo do processo
- [x] `api/.env.example` e `api/README.md` documentam o novo fluxo via Docker, ao lado do fluxo existente via `uv run uvicorn`
- [x] Verificado manualmente: `docker-compose up`, `curl`/Swagger (`/docs`) respondendo, escrever um registro, `docker-compose down && docker-compose up` e confirmar que o registro ainda está lá; documentar o roteiro nos comentários desta issue

## Comments

Implementado em `api/`, sem tocar em `api/app/main.py` nem `api/app/pyproject.toml` (outro agente estava trabalhando em paralelo neles na ticket 01, rate limit):

- `api/Dockerfile`: baseado em `python:3.12-slim`; instala o `uv` copiando o binário oficial de `ghcr.io/astral-sh/uv:latest` (sem puxar toolchain extra via pip); copia `pyproject.toml`/`uv.lock` primeiro e roda `uv sync --frozen --no-install-project` numa camada separada da cópia de `app/` — aproveita cache do Docker entre rebuilds quando só o código muda, não as dependências; comando final é `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000`, porta `8000` exposta.
- `api/docker-compose.yml`: serviço único `api`, `build: .`, porta `8000:8000` publicada, `env_file: .env` (mesmo arquivo já documentado em `api/README.md`/`.env.example`), volume nomeado `cache-db` montado em `/data`. Não fixei `DATABASE_URL` no compose para não divergir do `.env` real do desenvolvedor — em vez disso, documentei o valor recomendado (ver abaixo).
- `api/.env.example`: nova nota no topo explicando que o mesmo `.env` é lido tanto por `uv run uvicorn` local quanto por `docker-compose` (via `env_file`), e comentário específico em `DATABASE_URL` com o valor recomendado para Docker (`sqlite:////data/cache.db`, dentro do volume montado em `/data`) vs. o default local (`sqlite:///./cache.db`, fora de container). Não incluí nenhum texto de `RATE_LIMIT_LEITURA`/`RATE_LIMIT_ESCRITA` da ticket 01 — não tinha esse texto disponível nesta tarefa; fica para reconciliar depois.
- `api/README.md`: seção "Como rodar" dividida em Opção A (Docker, novo) e Opção B (`uv` local, existente, preservada). Opção A documenta pré-requisitos (Docker + Docker Compose), o passo de copiar `.env.example`→`.env` e setar `DATABASE_URL=sqlite:////data/cache.db`, o comando `docker compose up --build`, onde os dados persistem (volume nomeado `cache-db`, sobrevive a `down`/`up`; `down -v` para apagar de fato) e como encerrar (`docker compose down`). Estrutura da pasta e notas finais atualizadas para citar `Dockerfile`/`docker-compose.yml`.
- **Verificação manual real, executada de ponta a ponta** (Docker Desktop 29.5.2 / Compose v5.1.4 disponíveis neste ambiente; Docker Desktop precisou ser iniciado antes do primeiro `docker compose` funcionar):
  1. `docker compose up --build -d` em `api/` — build limpo, 27 pacotes instalados via `uv sync --frozen` (incluindo `slowapi`/`limits`, já presentes em `pyproject.toml`/`uv.lock` pelo trabalho em paralelo da ticket 01 — confirma que o lockfile deles já estava consistente). Container `api-api-1` sobe sem erro.
  2. `curl http://localhost:8000/docs` → `200`.
  3. `POST /recomendacoes` com um registro de teste (Elden Ring / RTX 3060) → `{"gravado":true,"chave":"v1:elden ring|rtx 3060|ryzen 5 5600|16gb|1080p"}`.
  4. `GET /recomendacoes` com os mesmos campos → corpo completo do resultado, confirmando o hit.
  5. `docker compose down` (remove container e rede, mantém o volume) → `docker compose up -d` de novo.
  6. `curl /docs` → `200` de novo; `GET /recomendacoes` com os mesmos campos → **mesmo corpo de resultado**, confirmando que o volume nomeado `cache-db` persistiu o SQLite entre o ciclo `down`/`up`.
  7. `docker compose down` final para não deixar container rodando; volume `api_cache-db` deixado intacto (dado de teste isolado, sem impacto — `.env` usado no teste é local, gitignorado, não commitado).
- Fora de escopo confirmado (fica para outras tickets do mesmo spec): deploy no Railway a partir deste mesmo `Dockerfile`, rate limit (ticket 01, em paralelo), URL padrão hospedada no app (`service/ai/`).
