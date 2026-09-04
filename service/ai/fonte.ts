import type { Resultado } from './schema';

export interface Consulta {
  jogo: string;
  placaVideo: string;
  processador: string;
  memoria: string;
  resolucao: string;
}

export interface Fonte {
  nome: string;
  buscar(consulta: Consulta): Promise<Resultado | null>;
}

export interface ProvedorEvidencia<TEvidencia = unknown> {
  nome: string;
  buscar(consulta: Consulta): Promise<TEvidencia | null>;
}

export interface ContextoGeracao<TEvidencia = unknown> {
  consulta: Consulta;
  evidencia?: TEvidencia;
}

export interface Gerador<TEvidencia = unknown> {
  nome: string;
  gerar(contexto: ContextoGeracao<TEvidencia>): Promise<Resultado | null>;
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
