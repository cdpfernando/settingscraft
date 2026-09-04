import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, Security, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIASGIMiddleware
from slowapi.util import get_remote_address
from sqlmodel import Session, select

from app.cache import criar_chave
from app.db import criar_tabelas, obter_sessao
from app.models import (
    CONTRATO_VERSAO,
    EscritaResposta,
    RegistroCache,
    RegistroEscrita,
    ResultadoOut,
)

token_header = APIKeyHeader(name="X-Cache-Token", auto_error=False)

# Por IP. Sem isso a API pública vira brinquedo.
RATE_LIMIT_LEITURA = os.environ.get("RATE_LIMIT_LEITURA", "60/minute")
RATE_LIMIT_ESCRITA = os.environ.get("RATE_LIMIT_ESCRITA", "10/minute")

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    criar_tabelas()
    yield


app = FastAPI(
    title="SettingsCraft cache",
    description=(
        "Guarda recomendacoes que o app ja gerou. "
        "Nao chama IA. Se cair, o app segue sem o atalho."
    ),
    version="1.0.0",
    lifespan=ciclo_de_vida,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_middleware(SlowAPIASGIMiddleware)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.get(
    "/recomendacoes",
    response_model=ResultadoOut,
    responses={404: {"description": "Nenhum resultado salvo para esses campos"}},
    summary="Busca pelo hardware informado",
)
@limiter.limit(RATE_LIMIT_LEITURA)
def buscar_recomendacao(
    request: Request,
    jogo: str,
    resolucao: str,
    placa_video: str = Query(alias="placaVideo"),
    processador: str = Query(),
    memoria: str = Query(),
    versao_contrato: int = Query(alias="versaoContrato"),
    sessao: Session = Depends(obter_sessao),
):
    if versao_contrato != CONTRATO_VERSAO:
        return Response(status_code=status.HTTP_404_NOT_FOUND)

    chave = criar_chave(jogo, placa_video, processador, memoria, resolucao, versao_contrato)
    registro = sessao.exec(select(RegistroCache).where(RegistroCache.chave == chave)).first()

    if registro is None:
        return Response(status_code=status.HTTP_404_NOT_FOUND)

    registro.reaproveitamentos += 1
    sessao.add(registro)
    sessao.commit()

    return ResultadoOut(
        configuracoes=registro.configuracoes,
        fps_estimado=registro.fps_estimado,
        fonte=registro.fonte,
        gerado_em=registro.gerado_em,
        versao_contrato=registro.versao_contrato,
        gerado_por=registro.gerado_por,
        confianca_fps=registro.confianca_fps,
        evidencia_desempenho=registro.evidencia_desempenho,
    )


@app.post(
    "/recomendacoes",
    response_model=EscritaResposta,
    summary="Grava uma recomendacao gerada pelo app",
)
@limiter.limit(RATE_LIMIT_ESCRITA)
def escrever_recomendacao(
    request: Request,
    registro: RegistroEscrita,
    response: Response,
    sobrescrever: bool = Query(False),
    token: str | None = Security(token_header),
    sessao: Session = Depends(obter_sessao),
):
    token_esperado = os.environ.get("CACHE_WRITE_TOKEN")
    if token_esperado and token != token_esperado:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido ou ausente")

    chave = criar_chave(
        registro.jogo,
        registro.placa_video,
        registro.processador,
        registro.memoria,
        registro.resolucao,
        registro.versao_contrato,
    )

    existente = sessao.exec(select(RegistroCache).where(RegistroCache.chave == chave)).first()

    if existente and not sobrescrever:
        response.status_code = status.HTTP_200_OK
        return EscritaResposta(gravado=False, chave=chave)

    agora = datetime.now(timezone.utc)
    configuracoes = [c.model_dump() for c in registro.configuracoes]
    evidencia_desempenho = (
        registro.evidencia_desempenho.model_dump(mode="json", by_alias=True)
        if registro.evidencia_desempenho
        else None
    )

    if existente:
        existente.configuracoes = configuracoes
        existente.fps_estimado = registro.fps_estimado
        existente.fonte = registro.fonte
        existente.gerado_em = registro.gerado_em
        existente.versao_contrato = registro.versao_contrato
        existente.gerado_por = registro.gerado_por
        existente.confianca_fps = registro.confianca_fps
        existente.evidencia_desempenho = evidencia_desempenho
        existente.atualizado_em = agora
        sessao.add(existente)
        response.status_code = status.HTTP_200_OK
    else:
        sessao.add(
            RegistroCache(
                chave=chave,
                jogo=registro.jogo,
                placa_video=registro.placa_video,
                processador=registro.processador,
                memoria=registro.memoria,
                resolucao=registro.resolucao,
                configuracoes=configuracoes,
                fps_estimado=registro.fps_estimado,
                fonte=registro.fonte,
                gerado_em=registro.gerado_em,
                versao_contrato=registro.versao_contrato,
                gerado_por=registro.gerado_por,
                confianca_fps=registro.confianca_fps,
                evidencia_desempenho=evidencia_desempenho,
                reaproveitamentos=0,
                criado_em=agora,
                atualizado_em=agora,
            )
        )
        response.status_code = status.HTTP_201_CREATED

    sessao.commit()
    return EscritaResposta(gravado=True, chave=chave)
