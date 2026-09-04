from datetime import datetime, timezone
from typing import Literal, Optional, Self
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from pydantic.alias_generators import to_camel
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


CONTRATO_VERSAO = 2
FonteEntrega = Literal["salvo", "compartilhado", "gemini", "groq", "exemplo"]
GeradoPor = Literal["gemini", "groq", "exemplo"]
ConfiancaFps = Literal["media", "baixa"]


class ModeloCamelCase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


class Configuracao(ModeloCamelCase):
    nome: str
    valor: str
    justificativa: str


class ReferenciaFpsHq(ModeloCamelCase):
    slug: str
    nome: str


class EvidenciaDesempenho(ModeloCamelCase):
    fonte: Literal["fpshq"]
    tipo: Literal["benchmark", "predicao"]
    correspondencia: Literal["completa", "parcial"]
    url_atribuicao: str
    consultado_em: str
    jogo: ReferenciaFpsHq
    placa_video: ReferenciaFpsHq
    processador: ReferenciaFpsHq | None
    resolucao: Literal["1080p", "1440p", "4K"]
    preset_referencia: Literal["low", "medium", "high", "ultra"]
    fps_medio: float
    fps_minimo: float
    fps_maximo: float

    @field_validator("url_atribuicao")
    @classmethod
    def validar_url_atribuicao(cls, valor: str) -> str:
        url = urlsplit(valor)
        host = (url.hostname or "").lower()
        if url.scheme != "https" or not (host == "fpshq.com" or host.endswith(".fpshq.com")):
            raise ValueError("A URL de atribuição precisa pertencer ao FPSHQ.")
        return valor

    @field_validator("consultado_em")
    @classmethod
    def validar_consultado_em(cls, valor: str) -> str:
        return validar_data_iso_utc(valor)

    @field_validator("fps_medio", "fps_minimo", "fps_maximo")
    @classmethod
    def validar_fps_nao_negativo(cls, valor: float) -> float:
        if valor < 0:
            raise ValueError("FPS não pode ser negativo.")
        return valor

    @model_validator(mode="after")
    def validar_correspondencia(self) -> Self:
        if self.correspondencia == "completa" and self.processador is None:
            raise ValueError("Correspondência completa exige processador.")
        if self.correspondencia == "parcial" and self.processador is not None:
            raise ValueError("Correspondência parcial exige processador ausente.")
        return self


def validar_data_iso_utc(valor: str) -> str:
    if not valor.endswith("Z"):
        raise ValueError("A data precisa estar em ISO 8601 UTC.")
    try:
        datetime.fromisoformat(f"{valor[:-1]}+00:00")
    except ValueError as erro:
        raise ValueError("A data precisa estar em ISO 8601 UTC.") from erro
    return valor


class ResultadoBase(ModeloCamelCase):
    configuracoes: list[Configuracao]
    fps_estimado: str
    fonte: FonteEntrega
    gerado_em: str
    versao_contrato: Literal[2]
    gerado_por: GeradoPor
    confianca_fps: ConfiancaFps
    evidencia_desempenho: EvidenciaDesempenho | None

    @field_validator("gerado_em")
    @classmethod
    def validar_gerado_em(cls, valor: str) -> str:
        return validar_data_iso_utc(valor)

    @model_validator(mode="after")
    def validar_confianca_fps(self) -> Self:
        evidencia = self.evidencia_desempenho
        evidencia_media_valida = (
            evidencia is not None
            and evidencia.tipo == "benchmark"
            and evidencia.correspondencia == "completa"
            and evidencia.processador is not None
        )
        if self.confianca_fps == "media" and not evidencia_media_valida:
            raise ValueError(
                "Confiança média exige benchmark com correspondência completa e processador."
            )
        return self


class ResultadoOut(ResultadoBase):
    """Mesmo formato de Resultado em service/ai/schema.ts."""


class RegistroEscrita(ResultadoBase):
    """POST: consulta mais o resultado completo."""

    jogo: str
    placa_video: str
    processador: str
    memoria: str
    resolucao: str


class EscritaResposta(ModeloCamelCase):
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
    gerado_por: str
    confianca_fps: str
    evidencia_desempenho: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )
    reaproveitamentos: int = 0
    criado_em: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    atualizado_em: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
