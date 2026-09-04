import { fetch as expoFetch } from 'expo/fetch';

import { resolverCacheApiUrl } from './cache-api-url';
import {
  criarFonteCacheCompartilhado,
  publicarNoCacheCompartilhado,
} from './cache-compartilhado';
import {
  criarFonteCacheLocal,
  criarRepositorioCacheLocal,
} from './cache-local';
import { criarFonteGemini } from './fonte-gemini';
import { criarFonteGroq } from './fonte-groq';
import type { Consulta, Fonte, Gerador, ProvedorEvidencia } from './fonte';
import { criarProvedorEvidenciaFpsHq } from './provedor-fpshq';
import {
  resolverConsulta,
  type ConsultaResultado,
  type EtapasConsulta,
} from './resolvedor';
import type { EvidenciaDesempenho } from './schema';

export type { ConsultaResultado } from './resolvedor';

export interface OpcoesConsulta {
  ignorarCache?: boolean;
}

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const groqApiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const usarResultadoExemplo = process.env.EXPO_PUBLIC_USAR_RESULTADO_EXEMPLO === 'true';
const cacheApiUrl = resolverCacheApiUrl(process.env.EXPO_PUBLIC_CACHE_API_URL);
const cacheApiToken = process.env.EXPO_PUBLIC_CACHE_API_TOKEN;

function veioDeCache(fonte: string): boolean {
  return fonte === 'salvo' || fonte === 'compartilhado';
}

export function montarEtapas(
  repositorioCache = criarRepositorioCacheLocal(),
  opcoes: OpcoesConsulta = {},
  provedorCompartilhado?: ProvedorEvidencia<EvidenciaDesempenho>,
): EtapasConsulta<EvidenciaDesempenho> {
  const geradores: Gerador<EvidenciaDesempenho>[] = [];

  if (usarResultadoExemplo) {
    geradores.push(
      criarFonteGemini({ apiKey: '', transporte: fetch, usarResultadoExemplo: true }),
    );
  } else if (!apiKey) {
    console.warn('[montarEtapas] EXPO_PUBLIC_GEMINI_API_KEY não está definida; Gemini omitido da cadeia.');
  } else {
    geradores.push(
      criarFonteGemini({ apiKey, transporte: fetch }),
    );
  }

  if (!groqApiKey) {
    console.warn('[montarEtapas] EXPO_PUBLIC_GROQ_API_KEY não está definida; Groq omitido da cadeia.');
  } else {
    geradores.push(
      criarFonteGroq({
        apiKey: groqApiKey,
        // O AI SDK lê o corpo via response.body.getReader(). O fetch nativo do
        // RN deixa body nulo e vira "200 Invalid JSON response".
        transporte: expoFetch as typeof fetch,
      }),
    );
  }

  const caches: Fonte[] = opcoes.ignorarCache
    ? []
    : [
        criarFonteCacheLocal(repositorioCache),
        criarFonteCacheCompartilhado({ baseUrl: cacheApiUrl, transporte: fetch }),
      ];

  const provedorEvidencia = usarResultadoExemplo
    ? undefined
    : provedorCompartilhado
      ?? criarProvedorEvidenciaFpsHq({ transporte: expoFetch as typeof fetch });

  return { caches, provedorEvidencia, geradores };
}

const repositorioCache = criarRepositorioCacheLocal();
const provedorEvidenciaPadrao = usarResultadoExemplo
  ? undefined
  : criarProvedorEvidenciaFpsHq({ transporte: expoFetch as typeof fetch });
const etapasPadrao = montarEtapas(repositorioCache, {}, provedorEvidenciaPadrao);
const etapasSemCache = montarEtapas(
  repositorioCache,
  { ignorarCache: true },
  provedorEvidenciaPadrao,
);

export async function createOptmizedSetting(
  consulta: Consulta,
  opcoes: OpcoesConsulta = {},
): Promise<ConsultaResultado> {
  const etapas = opcoes.ignorarCache ? etapasSemCache : etapasPadrao;
  const resposta = await resolverConsulta(consulta, etapas);

  if (resposta.ok && !veioDeCache(resposta.resultado.fonte)) {
    try {
      await repositorioCache.salvar(consulta, resposta.resultado);
    } catch (erro) {
      console.error('[cacheLocal] Não foi possível salvar o resultado:', erro);
    }

    void publicarNoCacheCompartilhado(
      { baseUrl: cacheApiUrl, transporte: fetch, token: cacheApiToken },
      consulta,
      resposta.resultado,
      opcoes.ignorarCache === true,
    );
  }

  return resposta;
}
