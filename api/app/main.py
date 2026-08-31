import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, Query, Response, Security, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from sqlmodel import Session, select

from app.cache import criar_chave
from app.db import criar_tabelas, obter_sessao
from app.models import EscritaResposta, RegistroCache, RegistroEscrita, ResultadoOut

token_header = APIKeyHeader(name="X-Cache-Token", auto_error=False)


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    criar_tabelas()
    yield


app = FastAPI(
    title="SettingsCraft — Cache compartilhado",
    description=(
        "Cache compartilhado de recomendacoes graficas geradas por IA. "
        "Papel e cache, nao proxy: quem chama a IA continua sendo o app, "
        "que depois publica o resultado aqui."
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


@app.get(
    "/recomendacoes",
    response_model=ResultadoOut,
    responses={404: {"description": "Nenhum resultado salvo para esses campos"}},
    summary="Busca uma recomendacao salva a partir dos campos crus da consulta",
)
def buscar_recomendacao(
    jogo: str,
    resolucao: str,
    placa_video: str = Query(alias="placaVideo"),
    processador: str = Query(),
    memoria: str = Query(),
    versao_contrato: int = Query(alias="versaoContrato"),
    sessao: Session = Depends(obter_sessao),
):
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
    )


@app.post(
    "/recomendacoes",
    response_model=EscritaResposta,
    summary="Publica uma recomendacao gerada pela IA no cache compartilhado",
)
def escrever_recomendacao(
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

    if existente:
        existente.configuracoes = configuracoes
        existente.fps_estimado = registro.fps_estimado
        existente.fonte = registro.fonte
        existente.gerado_em = registro.gerado_em
        existente.versao_contrato = registro.versao_contrato
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
                reaproveitamentos=0,
                criado_em=agora,
                atualizado_em=agora,
            )
        )
        response.status_code = status.HTTP_201_CREATED

    sessao.commit()
    return EscritaResposta(gravado=True, chave=chave)
