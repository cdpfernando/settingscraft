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
import type { Consulta, Fonte } from './fonte';
import { resolverConsulta, type ConsultaResultado } from './resolvedor';

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

export function montarFontes(
  repositorioCache = criarRepositorioCacheLocal(),
  opcoes: OpcoesConsulta = {},
): Fonte[] {
  const fontesProvedores: Fonte[] = [];

  if (usarResultadoExemplo) {
    fontesProvedores.push(
      criarFonteGemini({ apiKey: '', transporte: fetch, usarResultadoExemplo: true }),
    );
  } else if (!apiKey) {
    console.warn('[montarFontes] EXPO_PUBLIC_GEMINI_API_KEY não está definida; Gemini omitido da cadeia.');
  } else {
    fontesProvedores.push(
      criarFonteGemini({ apiKey, transporte: fetch }),
    );
  }

  if (!groqApiKey) {
    console.warn('[montarFontes] EXPO_PUBLIC_GROQ_API_KEY não está definida; Groq omitido da cadeia.');
  } else {
    fontesProvedores.push(
      criarFonteGroq({
        apiKey: groqApiKey,
        // O AI SDK lê o corpo via response.body.getReader(). O fetch nativo do
        // RN deixa body nulo e vira "200 Invalid JSON response".
        transporte: expoFetch as typeof fetch,
      }),
    );
  }

  if (opcoes.ignorarCache) {
    return fontesProvedores;
  }

  const fontesCache: Fonte[] = [
    criarFonteCacheLocal(repositorioCache),
    criarFonteCacheCompartilhado({ baseUrl: cacheApiUrl, transporte: fetch }),
  ];

  return [...fontesCache, ...fontesProvedores];
}

const repositorioCache = criarRepositorioCacheLocal();
const fontesPadrao = montarFontes(repositorioCache);
const fontesSemCache = montarFontes(repositorioCache, { ignorarCache: true });

export async function createOptmizedSetting(
  consulta: Consulta,
  opcoes: OpcoesConsulta = {},
): Promise<ConsultaResultado> {
  const fontes = opcoes.ignorarCache ? fontesSemCache : fontesPadrao;
  const resposta = await resolverConsulta(consulta, fontes);

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
