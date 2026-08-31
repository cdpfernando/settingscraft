import re


def normalizar_campo(valor: str) -> str:
    return re.sub(r"\s+", " ", valor.strip().lower())


def criar_chave(
    jogo: str,
    placa_video: str,
    processador: str,
    memoria: str,
    resolucao: str,
    versao_contrato: int,
) -> str:
    campos = [normalizar_campo(c) for c in (jogo, placa_video, processador, memoria, resolucao)]
    return f"v{versao_contrato}:" + "|".join(campos)
