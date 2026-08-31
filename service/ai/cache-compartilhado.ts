import type { Consulta, Fonte, TransporteHttp } from './fonte';
import { CONTRATO_VERSAO, ResultadoSchema, type Resultado } from './schema';

/** Miss não vale a espera — a IA levará mais que isso de qualquer forma. */
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

/**
 * Cria o elo de leitura do cache compartilhado. Erro de rede, timeout ou
 * resposta malformada nunca chegam ao usuário: a fonte devolve `null` e a
 * cadeia segue em silêncio para o próximo elo.
 */
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

/**
 * Publica de volta na API o resultado obtido dos provedores após um miss.
 * Nunca lança: falha de publicação é um detalhe de infraestrutura, não algo
 * que o jogador precise ver.
 */
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
