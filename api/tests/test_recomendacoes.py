import inspect
import json
import unittest

from fastapi import Response, status
from pydantic import ValidationError
from sqlalchemy import func, text
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine, select

from app.main import buscar_recomendacao, escrever_recomendacao
from app.models import RegistroCache, RegistroEscrita


CONTRATO_ATUAL = 2

CONSULTA = {
    "jogo": "Alan Wake 2",
    "placaVideo": "NVIDIA GeForce RTX 4070 Super",
    "processador": "AMD Ryzen 7 7800X3D",
    "memoria": "32 GB",
    "resolucao": "2560x1440 (2K)",
}

EVIDENCIA_BENCHMARK = {
    "fonte": "fpshq",
    "tipo": "benchmark",
    "correspondencia": "completa",
    "urlAtribuicao": "https://fpshq.com/games/alan-wake-2/",
    "consultadoEm": "2026-09-04T10:00:00.000Z",
    "jogo": {"slug": "alan-wake-2", "nome": "Alan Wake 2"},
    "placaVideo": {
        "slug": "rtx-4070-super",
        "nome": "GeForce RTX 4070 Super",
    },
    "processador": {
        "slug": "ryzen-7-7800x3d",
        "nome": "Ryzen 7 7800X3D",
    },
    "resolucao": "1440p",
    "presetReferencia": "ultra",
    "fpsMedio": 72,
    "fpsMinimo": 61,
    "fpsMaximo": 84,
}

EVIDENCIA_PREDICAO = {
    "fonte": "fpshq",
    "tipo": "predicao",
    "correspondencia": "parcial",
    "urlAtribuicao": "https://fpshq.com/games/alan-wake-2/",
    "consultadoEm": "2026-09-04T10:01:00.000Z",
    "jogo": {"slug": "alan-wake-2", "nome": "Alan Wake 2"},
    "placaVideo": {
        "slug": "rtx-4070-super",
        "nome": "GeForce RTX 4070 Super",
    },
    "processador": None,
    "resolucao": "1440p",
    "presetReferencia": "high",
    "fpsMedio": 68,
    "fpsMinimo": 57,
    "fpsMaximo": 79,
}


def criar_payload(gerado_por, confianca_fps, evidencia_desempenho):
    return {
        **CONSULTA,
        "configuracoes": [
            {
                "nome": "Qualidade geral",
                "valor": (
                    evidencia_desempenho["presetReferencia"]
                    if evidencia_desempenho
                    else "Alto"
                ),
                "justificativa": (
                    "Ajustado a partir da evidência recebida."
                    if evidencia_desempenho
                    else "Estimativa produzida somente pela IA."
                ),
            }
        ],
        "fpsEstimado": "61 a 72 FPS" if evidencia_desempenho else "55 a 70 FPS",
        "fonte": gerado_por,
        "geradoPor": gerado_por,
        "confiancaFps": confianca_fps,
        "evidenciaDesempenho": evidencia_desempenho,
        "geradoEm": "2026-09-04T10:02:00.000Z",
        "versaoContrato": CONTRATO_ATUAL,
    }


CENARIOS = (
    (
        "benchmark completo",
        criar_payload("gemini", "media", EVIDENCIA_BENCHMARK),
    ),
    (
        "predição parcial",
        criar_payload("groq", "baixa", EVIDENCIA_PREDICAO),
    ),
    (
        "resultado somente IA",
        criar_payload("exemplo", "baixa", None),
    ),
)


def sem_consulta(payload):
    return {chave: valor for chave, valor in payload.items() if chave not in CONSULTA}


def chamar_endpoint(funcao, **argumentos):
    return inspect.unwrap(funcao)(**argumentos)


class ContratoHttpTests(unittest.TestCase):
    def test_modelos_http_exigem_e_serializam_metadados_finais_em_camel_case(self):
        for nome, payload in CENARIOS:
            with self.subTest(cenario=nome):
                registro = RegistroEscrita.model_validate(payload)
                serializado = registro.model_dump(mode="json", by_alias=True)

                self.assertEqual(serializado, payload)
                self.assertIn("geradoPor", serializado)
                self.assertIn("confiancaFps", serializado)
                self.assertIn("evidenciaDesempenho", serializado)
                self.assertNotIn("gerado_por", serializado)
                self.assertNotIn("confianca_fps", serializado)
                self.assertNotIn("evidencia_desempenho", serializado)

        completo = CENARIOS[0][1]
        for campo in ("geradoPor", "confiancaFps", "evidenciaDesempenho"):
            with self.subTest(campo_ausente=campo):
                incompleto = {**completo}
                incompleto.pop(campo)
                with self.assertRaises(ValidationError):
                    RegistroEscrita.model_validate(incompleto)

        for campo, valor_invalido in (
            ("fonte", "fpshq"),
            ("geradoPor", "cache-local"),
            ("confiancaFps", "alta"),
            ("versaoContrato", 1),
        ):
            with self.subTest(campo_invalido=campo):
                invalido = {**completo, campo: valor_invalido}
                with self.assertRaises(ValidationError):
                    RegistroEscrita.model_validate(invalido)

        evidencia_invalida = {
            **completo,
            "evidenciaDesempenho": {
                **EVIDENCIA_BENCHMARK,
                "urlAtribuicao": "https://example.com/sem-atribuicao",
            },
        }
        with self.assertRaises(ValidationError):
            RegistroEscrita.model_validate(evidencia_invalida)

    def test_modelos_http_rejeitam_combinacoes_incoerentes_de_procedencia(self):
        benchmark_completo = CENARIOS[0][1]
        somente_ia = CENARIOS[2][1]

        predicao_completa = {
            **EVIDENCIA_BENCHMARK,
            "tipo": "predicao",
        }
        benchmark_parcial = {
            **EVIDENCIA_BENCHMARK,
            "correspondencia": "parcial",
            "processador": None,
        }
        invalidos = (
            (
                "confianca media sem evidencia",
                {**somente_ia, "confiancaFps": "media"},
            ),
            (
                "confianca media com predicao",
                {
                    **benchmark_completo,
                    "confiancaFps": "media",
                    "evidenciaDesempenho": predicao_completa,
                },
            ),
            (
                "confianca media com correspondencia parcial",
                {
                    **benchmark_completo,
                    "confiancaFps": "media",
                    "evidenciaDesempenho": benchmark_parcial,
                },
            ),
            (
                "correspondencia completa sem CPU",
                {
                    **benchmark_completo,
                    "confiancaFps": "baixa",
                    "evidenciaDesempenho": {
                        **EVIDENCIA_BENCHMARK,
                        "processador": None,
                    },
                },
            ),
            (
                "correspondencia parcial com CPU",
                {
                    **benchmark_completo,
                    "confiancaFps": "baixa",
                    "evidenciaDesempenho": {
                        **EVIDENCIA_BENCHMARK,
                        "correspondencia": "parcial",
                    },
                },
            ),
        )

        for nome, payload in invalidos:
            with self.subTest(cenario=nome), self.assertRaises(ValidationError):
                RegistroEscrita.model_validate(payload)


class PersistenciaApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(self.engine)

    def tearDown(self):
        self.engine.dispose()

    def test_api_persiste_e_devolve_os_tres_estados_integralmente(self):
        for nome, payload in CENARIOS:
            with self.subTest(cenario=nome), Session(self.engine) as sessao:
                resposta_http = Response()
                escrita = chamar_endpoint(
                    escrever_recomendacao,
                    request=object(),
                    registro=RegistroEscrita.model_validate(payload),
                    response=resposta_http,
                    sobrescrever=False,
                    token=None,
                    sessao=sessao,
                )

                self.assertTrue(escrita.gravado)
                self.assertEqual(resposta_http.status_code, status.HTTP_201_CREATED)
                self.assertTrue(escrita.chave.startswith("v2:"))

                registro_salvo = sessao.exec(
                    select(RegistroCache).where(RegistroCache.chave == escrita.chave)
                ).one()
                self.assertEqual(registro_salvo.gerado_por, payload["geradoPor"])
                self.assertEqual(registro_salvo.confianca_fps, payload["confiancaFps"])
                self.assertEqual(
                    registro_salvo.evidencia_desempenho,
                    payload["evidenciaDesempenho"],
                )

                leitura = chamar_endpoint(
                    buscar_recomendacao,
                    request=object(),
                    jogo=payload["jogo"],
                    placa_video=payload["placaVideo"],
                    processador=payload["processador"],
                    memoria=payload["memoria"],
                    resolucao=payload["resolucao"],
                    versao_contrato=payload["versaoContrato"],
                    sessao=sessao,
                )
                self.assertEqual(
                    leitura.model_dump(mode="json", by_alias=True),
                    sem_consulta(payload),
                )

                sessao.delete(registro_salvo)
                sessao.commit()

    def test_api_nao_devolve_linha_v1_para_consulta_do_contrato_atual(self):
        with Session(self.engine) as sessao:
            sessao.exec(
                text(
                    """
                    INSERT INTO registrocache (
                        chave, jogo, placa_video, processador, memoria, resolucao,
                        configuracoes, fps_estimado, fonte, gerado_em,
                        versao_contrato, gerado_por, confianca_fps,
                        evidencia_desempenho, reaproveitamentos, criado_em, atualizado_em
                    ) VALUES (
                        :chave, :jogo, :placa_video, :processador, :memoria, :resolucao,
                        :configuracoes, :fps_estimado, :fonte, :gerado_em,
                        1, 'gemini', 'baixa', NULL, 0,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                    """
                ),
                params={
                    "chave": "v1:alan wake 2|nvidia geforce rtx 4070 super|amd ryzen 7 7800x3d|32 gb|2560x1440 (2k)",
                    "jogo": CONSULTA["jogo"],
                    "placa_video": CONSULTA["placaVideo"],
                    "processador": CONSULTA["processador"],
                    "memoria": CONSULTA["memoria"],
                    "resolucao": CONSULTA["resolucao"],
                    "configuracoes": json.dumps([]),
                    "fps_estimado": "60 FPS",
                    "fonte": "gemini",
                    "gerado_em": "2026-09-01T10:00:00.000Z",
                },
            )
            sessao.commit()

            leitura = chamar_endpoint(
                buscar_recomendacao,
                request=object(),
                jogo=CONSULTA["jogo"],
                placa_video=CONSULTA["placaVideo"],
                processador=CONSULTA["processador"],
                memoria=CONSULTA["memoria"],
                resolucao=CONSULTA["resolucao"],
                versao_contrato=CONTRATO_ATUAL,
                sessao=sessao,
            )

            self.assertIsInstance(leitura, Response)
            self.assertEqual(leitura.status_code, status.HTTP_404_NOT_FOUND)
            quantidade = sessao.exec(select(func.count()).select_from(RegistroCache)).one()
            self.assertEqual(quantidade, 1)


if __name__ == "__main__":
    unittest.main()
