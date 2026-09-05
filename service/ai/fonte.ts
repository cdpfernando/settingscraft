import type { EvidenciaDesempenho, GeradoPor, RespostaIa } from './schema';

export interface Consulta {
  jogo: string;
  placaVideo: string;
  processador: string;
  memoria: string;
  resolucao: string;
}

export interface ProvedorEvidencia {
  nome: string;
  buscar(consulta: Consulta): Promise<EvidenciaDesempenho | null>;
}

export interface ContextoGeracao {
  consulta: Consulta;
  evidencia?: EvidenciaDesempenho;
}

export interface Gerador {
  nome: GeradoPor;
  gerar(contexto: ContextoGeracao): Promise<RespostaIa | null>;
}

export type TransporteHttp = typeof fetch;

export class ErroFonteConfiguracao extends Error {
  constructor(public readonly fonte: string, public readonly status: number) {
    super(`A fonte ${fonte} está configurada incorretamente (HTTP ${status}).`);
    this.name = 'ErroFonteConfiguracao';
  }
}

export class ErroFonteLimite extends Error {
  constructor(public readonly fonte: string) {
    super(`A fonte ${fonte} atingiu o limite de requisições.`);
    this.name = 'ErroFonteLimite';
  }
}
