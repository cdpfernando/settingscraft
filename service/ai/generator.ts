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

export type { Consulta as HardwareInfo } from './fonte';
export type { ConsultaResultado } from './resolvedor';

export interface OpcoesConsulta {
  ignorarCache?: boolean;
}

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const groqApiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const usarResultadoExemplo = process.env.EXPO_PUBLIC_USAR_RESULTADO_EXEMPLO === 'true';
const cacheApiUrl = resolverCacheApiUrl(process.env.EXPO_PUBLIC_CACHE_API_URL);
const cacheApiToken = process.env.EXPO_PUBLIC_CACHE_API_TOKEN;

/** Origens cujo resultado já veio de um cache, não de um provedor — nada a publicar de volta. */
function veioDeCache(fonte: string): boolean {
  return fonte === 'salvo' || fonte === 'compartilhado';
}

/**
 * Borda de composição da aplicação. Fontes sem credencial são omitidas aqui,
 * antes da consulta, para que uma chave ausente nunca vire erro em runtime.
 */
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
      criarFonteGroq({ apiKey: groqApiKey, transporte: fetch }),
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

/** Mantém a API consumida pela tela enquanto delega a decisão ao resolvedor. */
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
