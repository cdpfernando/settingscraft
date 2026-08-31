# SettingsCraft API, cache compartilhado

FastAPI que guarda recomendações já geradas para outro jogador com o mesmo hardware reaproveitar.

Isso é cache, não proxy. Quem chama a IA é o app. Esta API só lê e grava o resultado. Se ela cair, o app continua. Só perde o atalho.

## Rodando

Docker, se você não quiser Python na máquina. `uv`, se já tiver.

### Docker

[Docker](https://docs.docker.com/get-docker/) e Compose.

```bash
cd api
cp .env.example .env
```

No `.env`, o SQLite precisa apontar para o volume, senão some no rebuild:

```
DATABASE_URL=sqlite:////data/cache.db
```

`CACHE_WRITE_TOKEN` é opcional, igual no fluxo local.

```bash
docker compose up --build
```

Sobe em `http://127.0.0.1:8000`. Na LAN, `http://<ip-da-máquina>:8000` para o celular alcançar. `/docs` abre o Swagger.

O SQLite vive no volume `cache-db`, montado em `/data`. `docker compose down` não apaga. `docker compose down -v` apaga.

### uv, sem Docker

Python 3.12+ e [`uv`](https://docs.astral.sh/uv/).

```bash
cd api
uv sync
cp .env.example .env
```

- `CACHE_WRITE_TOKEN`: se existir, escrita exige `X-Cache-Token`. Sem ela, escrita fica aberta. Serve para desenvolver na máquina.
- `DATABASE_URL`: opcional. Padrão `sqlite:///./cache.db`. Não use o caminho do Docker. Fora do container não existe `/data`.
- `RATE_LIMIT_LEITURA`: padrão `60/minute` no GET.
- `RATE_LIMIT_ESCRITA`: padrão `10/minute` no POST.

As duas de rate limit valem no Docker também. Mesmo `.env`.

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`http://127.0.0.1:8000/docs` tem o Swagger, com Authorize para testar o token. No celular, use o IP da máquina. `localhost` não chega.

## Endpoints

### `GET /recomendacoes`

O servidor normaliza os campos e calcula a chave.

| Query | Tipo | Obrigatório |
|---|---|---|
| `jogo` | string | sim |
| `placaVideo` | string | sim |
| `processador` | string | sim |
| `memoria` | string | sim |
| `resolucao` | string | sim |
| `versaoContrato` | int | sim |

Hit devolve `200` no formato `Resultado` e incrementa os reaproveitamentos. Miss devolve `404` vazio. Acima do limite, `429`.

```bash
curl "http://127.0.0.1:8000/recomendacoes?jogo=Elden%20Ring&placaVideo=RTX%203060&processador=Ryzen%205%205600&memoria=16GB&resolucao=1080p&versaoContrato=1"
```

### `POST /recomendacoes`

Corpo: campos da consulta mais o `Resultado` completo.

`sobrescrever` padrão `false`. Se a chave já existe, ignora. `sobrescrever=true` força, que é o que o botão "gerar novamente" manda.

Com `CACHE_WRITE_TOKEN` no servidor, falta ou token errado vira `401`. Payload que não bate no contrato vira `422`. Acima do limite, `429`.

```bash
curl -X POST "http://127.0.0.1:8000/recomendacoes" \
  -H "Content-Type: application/json" \
  -H "X-Cache-Token: seu-token-se-configurado" \
  -d '{
    "jogo": "Elden Ring",
    "placaVideo": "RTX 3060",
    "processador": "Ryzen 5 5600",
    "memoria": "16GB",
    "resolucao": "1080p",
    "configuracoes": [
      { "nome": "Qualidade geral", "valor": "Alto", "justificativa": "Bom equilíbrio para essa GPU" }
    ],
    "fpsEstimado": "60-75 fps",
    "fonte": "gemini",
    "geradoEm": "2026-08-30T12:00:00.000Z",
    "versaoContrato": 1
  }'
```

Resposta: `{"gravado": true, "chave": "..."}`. `201` se for novo, `200` se for no-op ou sobrescrita.

## Pasta

```
api/
  app/
    main.py      GET, POST, auth, conflito de chave
    models.py    SQLModel e Pydantic, no formato de service/ai/schema.ts
    cache.py     normalização e chave
    db.py        engine e sessão SQLite
  Dockerfile
  docker-compose.yml
  .env.example
```

FastAPI, SQLModel, SQLite, uvicorn, uv, slowapi por IP.

A chave de cache usa a mesma regra do app, minúsculas e espaços colapsados, mas os dois armazenamentos são independentes. As strings não precisam ser iguais. Sem TTL. O `Dockerfile` é o mesmo do Railway.
