# Mesmo Dockerfile no compose local e no Railway.
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# Manifestos primeiro. `uv sync` não reexecuta quando só o código muda.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

COPY app ./app
RUN uv sync --frozen

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
