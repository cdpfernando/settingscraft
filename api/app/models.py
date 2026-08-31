from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class Configuracao(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    nome: str
    valor: str
    justificativa: str


class ResultadoOut(BaseModel):
    """Espelha `Resultado` de service/ai/schema.ts."""

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    configuracoes: list[Configuracao]
    fps_estimado: str
    fonte: str
    gerado_em: str
    versao_contrato: int


class RegistroEscrita(BaseModel):
    """Corpo do POST: campos crus da Consulta + Resultado completo."""

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    jogo: str
    placa_video: str
    processador: str
    memoria: str
    resolucao: str
    configuracoes: list[Configuracao]
    fps_estimado: str
    fonte: str
    gerado_em: str
    versao_contrato: int


class EscritaResposta(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    gravado: bool
    chave: str


class RegistroCache(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    chave: str = Field(unique=True, index=True)
    jogo: str
    placa_video: str
    processador: str
    memoria: str
    resolucao: str
    configuracoes: list = Field(sa_column=Column(JSON))
    fps_estimado: str
    fonte: str
    gerado_em: str
    versao_contrato: int
    reaproveitamentos: int = 0
    criado_em: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    atualizado_em: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
