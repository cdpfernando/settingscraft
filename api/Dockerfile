# Imagem da API de cache compartilhado (SettingsCraft).
# Mesmo artefato serve para docker-compose local e para o build do Railway.
FROM python:3.12-slim

# Instala o uv (gerenciador de pacotes já usado localmente) copiando o binário
# oficial da imagem publicada pela Astral — evita puxar toolchain extra via pip.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# Copia primeiro só os manifestos de dependência para aproveitar cache de camada
# do Docker: `uv sync` só reexecuta quando pyproject.toml/uv.lock mudam.
COPY pyproject.toml uv.lock ./

# --frozen: respeita exatamente o uv.lock existente, sem tentar resolver de novo.
# --no-install-project: nesta camada instala só as dependências, ainda sem o código.
RUN uv sync --frozen --no-install-project

# Agora copia o código da aplicação e instala o projeto em si.
COPY app ./app
RUN uv sync --frozen

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
