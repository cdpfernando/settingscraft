# SettingsCraft API — cache compartilhado

Serviço FastAPI que guarda recomendações já geradas pelo Gemini/Groq para que um jogador aproveite o que outro já consultou com o mesmo hardware.

**Papel: cache compartilhado, não proxy.** Quem chama a IA continua sendo o app; esta API só lê e grava o resultado. Se ela estiver fora do ar, o app segue funcional — só perde o atalho do cache compartilhado.

---

## Como rodar

### 1. Pré-requisitos

- Python ≥ 3.12
- [`uv`](https://docs.astral.sh/uv/)

### 2. Instalar dependências

```bash
cd api
uv sync
```

### 3. Configurar variável de ambiente (opcional)

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

- `CACHE_WRITE_TOKEN`: se definida, toda escrita exige o cabeçalho `X-Cache-Token` com o mesmo valor. Se ausente, a escrita fica aberta — modo de desenvolvimento local.
- `DATABASE_URL`: opcional, padrão `sqlite:///./cache.db`.

### 4. Iniciar

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Acesse `http://127.0.0.1:8000/docs` para a documentação interativa (Swagger UI), com botão **Authorize** para testar o token de escrita.

Para o app mobile alcançar a API, use o IP da máquina na rede local (não `localhost`, que o dispositivo não enxerga), ex.: `http://192.168.0.10:8000`.

---

## Endpoints

### `GET /recomendacoes`

Recebe os campos crus da consulta; o servidor normaliza e calcula a chave.

| Query param | Tipo | Obrigatório |
|---|---|---|
| `jogo` | string | sim |
| `placaVideo` | string | sim |
| `processador` | string | sim |
| `memoria` | string | sim |
| `resolucao` | string | sim |
| `versaoContrato` | int | sim |

- **Hit** (`200`): corpo no formato `Resultado` (`configuracoes`, `fpsEstimado`, `fonte`, `geradoEm`, `versaoContrato`), e a contagem de reaproveitamentos é incrementada.
- **Miss** (`404`): corpo vazio, sem interpretação especulativa.

```bash
curl "http://127.0.0.1:8000/recomendacoes?jogo=Elden%20Ring&placaVideo=RTX%203060&processador=Ryzen%205%205600&memoria=16GB&resolucao=1080p&versaoContrato=1"
```

### `POST /recomendacoes`

Publica um resultado gerado pela IA. Corpo = campos crus da consulta + `Resultado` completo.

Query param `sobrescrever` (padrão `false`): se a chave já existir, o registro é ignorado por padrão; passe `sobrescrever=true` para forçar a sobrescrita (é o que o botão "gerar novamente" do app envia).

Se `CACHE_WRITE_TOKEN` estiver definida no servidor, o cabeçalho `X-Cache-Token` é obrigatório e precisa bater com o valor configurado — caso contrário, `401`. O payload é revalidado contra o contrato antes de gravar; payload malformado responde `422`.

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

Resposta: `{"gravado": true, "chave": "..."}` (`201` para registro novo, `200` para no-op ou sobrescrita).

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | FastAPI |
| ORM / modelos | SQLModel |
| Banco | SQLite |
| Servidor ASGI | uvicorn |
| Gerenciador de pacotes | uv |

## Estrutura

```
api/
  app/
    main.py      Rotas GET/POST e regras de autenticação/conflito
    models.py     Tabela SQLModel + schemas Pydantic (espelham service/ai/schema.ts)
    cache.py       Normalização de campos e cálculo da chave
    db.py           Engine e sessão do SQLite
  .env.example
```

## Notas

- A chave de cache é calculada a partir dos mesmos campos e regra de normalização (minúsculas, espaços colapsados) usados no cache local do app, mas os dois armazenamentos são independentes — não precisam produzir a mesma string de chave.
- Sem TTL: hardware e jogo não mudam sozinhos.
- Roda local, sem hospedagem nesta fase — publicar é mudança de variável de ambiente no app, não de código aqui.
