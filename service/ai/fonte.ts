import type { Resultado } from './schema';

export interface Consulta {
  jogo: string;
  placaVideo: string;
  processador: string;
  memoria: string;
  resolucao: string;
}

/** Porta comum de toda origem de recomendação. */
export interface Fonte {
  nome: string;
  buscar(consulta: Consulta): Promise<Resultado | null>;
}

/** Transporte injetado nas fontes HTTP para mantê-las independentes do fetch global. */
export type TransporteHttp = typeof fetch;

/** Erros de configuração não devem acionar o próximo provedor. */
export class ErroFonteConfiguracao extends Error {
  constructor(public readonly fonte: string, public readonly status: number) {
    super(`A fonte ${fonte} está configurada incorretamente (HTTP ${status}).`);
    this.name = 'ErroFonteConfiguracao';
  }
}

/** O limite de requisições merece uma mensagem acionável para o jogador. */
export class ErroFonteLimite extends Error {
  constructor(public readonly fonte: string) {
    super(`A fonte ${fonte} atingiu o limite de requisições.`);
    this.name = 'ErroFonteLimite';
  }
}
