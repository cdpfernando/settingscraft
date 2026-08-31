import type { Consulta, Fonte, TransporteHttp } from './fonte';
import { CONTRATO_VERSAO, ResultadoSchema, type Resultado } from './schema';

// Se o cache não respondeu em 1,5s, a IA vai demorar mais que isso mesmo.
const TEMPO_LIMITE_LEITURA_MS = 1_500;
const TEMPO_LIMITE_ESCRITA_MS = 5_000;

export interface CacheCompartilhadoOpcoes {
  baseUrl: string;
  transporte: TransporteHttp;
  token?: string;
}

function paraQueryString(consulta: Consulta): string {
  return new URLSearchParams({
    jogo: consulta.jogo,
    placaVideo: consulta.placaVideo,
    processador: consulta.processador,
    memoria: consulta.memoria,
    resolucao: consulta.resolucao,
    versaoContrato: String(CONTRATO_VERSAO),
  }).toString();
}

export function criarFonteCacheCompartilhado({ baseUrl, transporte }: CacheCompartilhadoOpcoes): Fonte {
  return {
    nome: 'cache-compartilhado',
    async buscar(consulta) {
      const controlador = new AbortController();
      const temporizador = setTimeout(() => controlador.abort(), TEMPO_LIMITE_LEITURA_MS);

      try {
        const response = await transporte(`${baseUrl}/recomendacoes?${paraQueryString(consulta)}`, {
          signal: controlador.signal,
        });

        if (response.status === 404) return null;
        if (!response.ok) {
          console.error('[cacheCompartilhado] Erro na API:', response.status);
          return null;
        }

        const bruto: unknown = await response.json();
        const validado = ResultadoSchema.safeParse(bruto);
        if (!validado.success) {
          console.error('[cacheCompartilhado] JSON não corresponde ao contrato:', validado.error.issues);
          return null;
        }

        return { ...validado.data, fonte: 'compartilhado' };
      } catch (erro) {
        console.error('[cacheCompartilhado] Falha ao consultar o cache compartilhado:', erro);
        return null;
      } finally {
        clearTimeout(temporizador);
      }
    },
  };
}

export async function publicarNoCacheCompartilhado(
  { baseUrl, transporte, token }: CacheCompartilhadoOpcoes,
  consulta: Consulta,
  resultado: Resultado,
  sobrescrever: boolean,
): Promise<void> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TEMPO_LIMITE_ESCRITA_MS);

  try {
    const response = await transporte(`${baseUrl}/recomendacoes?sobrescrever=${sobrescrever}`, {
      method: 'POST',
      signal: controlador.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Cache-Token': token } : {}),
      },
      body: JSON.stringify({ ...consulta, ...resultado }),
    });

    if (!response.ok) {
      console.error('[cacheCompartilhado] Falha ao publicar:', response.status, await response.text().catch(() => ''));
    }
  } catch (erro) {
    console.error('[cacheCompartilhado] Falha ao publicar o resultado:', erro);
  } finally {
    clearTimeout(temporizador);
  }
}
