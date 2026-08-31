# 01 — Rate limit na API de cache compartilhado

**What to build:** Os dois endpoints da API (`GET /recomendacoes` e `POST /recomendacoes`) passam a recusar excesso de requisições do mesmo IP com `429`, em vez de aceitar volume ilimitado. É a primeira camada de proteção antes da API ficar publicamente alcançável — hoje ela roda só na rede local, sem nenhum limite.

**Blocked by:** Nenhum — pode começar imediatamente.

**Status:** done

- [x] `GET /recomendacoes` limitado por IP, com padrão de `60/minute` quando a variável de ambiente correspondente não está definida
- [x] `POST /recomendacoes` limitado por IP, com padrão de `10/minute` quando a variável de ambiente correspondente não está definida
- [x] Os dois limites são configuráveis por variável de ambiente, documentados em `api/.env.example` e `api/README.md`
- [x] Exceder o limite devolve `429`; abaixo do limite, o comportamento existente (200/404/401/422) não muda
- [x] Limite é por IP — um cliente abusivo não afeta o limite de outro
- [x] Verificado manualmente: bater os dois endpoints acima do limite configurado localmente (`uv run uvicorn`) e confirmar o `429`; documentar o roteiro nos comentários desta issue

## Comments

Implementado em `api/app/main.py` com `slowapi` (biblioteca adicionada em `api/pyproject.toml` e sincronizada em `api/uv.lock` via `uv sync`):

- `Limiter(key_func=get_remote_address)` — chave por endereço IP do cliente. `app.state.limiter = limiter`, `SlowAPIASGIMiddleware` registrado e `RateLimitExceeded` mapeado para o handler padrão do slowapi (`_rate_limit_exceeded_handler`, 429 sem corpo especial, no estilo minimalista já usado no miss do cache).
- `RATE_LIMIT_LEITURA` (padrão `60/minute`) decora `GET /recomendacoes` via `@limiter.limit(...)`; `RATE_LIMIT_ESCRITA` (padrão `10/minute`) decora `POST /recomendacoes` da mesma forma. Ambas as variáveis lidas de `os.environ.get(...)` uma única vez no topo do módulo, depois de `load_dotenv()`.
- Os dois endpoints ganharam o parâmetro `request: Request` (exigido pelo slowapi para resolver a chave por IP); nenhum outro parâmetro ou corpo de resposta mudou.
- Comportamento abaixo do limite confirmado inalterado: 404 (miss), 200/201 (write hit/create), 401 (token ausente/errado quando `CACHE_WRITE_TOKEN` está definido), 422 (payload inválido).

**Verificação manual** (`uv run uvicorn app.main:app --port 8000`, Windows/PowerShell + Git Bash, sem `--reload`; servidor reiniciado entre rodadas para zerar o limitador em memória):

1. Com `RATE_LIMIT_LEITURA=3/minute` e `RATE_LIMIT_ESCRITA=2/minute` (valores baixos só para o teste, via variável de ambiente na hora de subir o servidor — não commitados em lugar nenhum): 3 `GET /recomendacoes` seguidos devolveram `404` (miss), o 4º devolveu `429`. Em paralelo, 2 `POST /recomendacoes` devolveram `201`/`200`, o 3º devolveu `429` — confirma que o limite de leitura esgotado não interferiu no de escrita e vice-versa (bucket por rota, não só por IP — usar limites com valores **diferentes** entre leitura e escrita no teste foi importante para expor isso; testar os dois endpoints com o mesmo valor de limite mascara essa distinção, porque a chave interna do `limits` pode colidir quando os dois lados usam a mesma string de limite).
2. Com as variáveis de ambiente não definidas (padrão `60/minute`/`10/minute`) e `CACHE_WRITE_TOKEN` definido: `GET` sem registro → `404`; `POST` sem token → `401`; `POST` com token correto e payload válido → `201`; `POST` com token correto e payload incompleto → `422`; `GET` do mesmo registro logo em seguida → `200`. Nenhum desses caminhos tocou o rate limit porque ficaram bem abaixo do padrão.
3. Servidor parado ao final de cada rodada (`taskkill`, já que o PID do job em background do bash nem sempre corresponde ao processo real do `uvicorn` no Windows — confirmar com `netstat -ano | grep 8000` antes de seguir).

**Reconciliação pós-paralelo:** `RATE_LIMIT_LEITURA`/`RATE_LIMIT_ESCRITA` foram documentadas em `api/.env.example` e `api/README.md` logo após os dois agentes (ticket 01 e ticket 02) terminarem, usando o texto sugerido acima — ambos os arquivos já tinham sido editados pela ticket 02 (Docker) nesse meio tempo, então a edição foi aplicada por cima do resultado dela, sem conflito.
