import {
  criarFonteCacheLocal,
  criarRepositorioCacheLocal,
} from './cache-local';
import { criarFonteGemini } from './fonte-gemini';
import type { Consulta, Fonte } from './fonte';
import { resolverConsulta, type ConsultaResultado } from './resolvedor';

export type { Consulta as HardwareInfo } from './fonte';
export type { ConsultaResultado } from './resolvedor';

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const usarResultadoExemplo = process.env.EXPO_PUBLIC_USAR_RESULTADO_EXEMPLO === 'true';

/**
 * Borda de composição da aplicação. Fontes sem credencial são omitidas aqui,
 * antes da consulta, para que uma chave ausente nunca vire erro em runtime.
 */
export function montarFontes(repositorioCache = criarRepositorioCacheLocal()): Fonte[] {
  const fonteCache = criarFonteCacheLocal(repositorioCache);

  if (usarResultadoExemplo) {
    return [fonteCache, criarFonteGemini({ apiKey: '', transporte: fetch, usarResultadoExemplo: true })];
  }

  if (!apiKey) {
    console.warn('[montarFontes] EXPO_PUBLIC_GEMINI_API_KEY não está definida; Gemini omitido da cadeia.');
    return [fonteCache];
  }

  return [fonteCache, criarFonteGemini({ apiKey, transporte: fetch })];
}

const repositorioCache = criarRepositorioCacheLocal();
const fontes = montarFontes(repositorioCache);

/** Mantém a API consumida pela tela enquanto delega a decisão ao resolvedor. */
export async function createOptmizedSetting(consulta: Consulta): Promise<ConsultaResultado> {
  const resposta = await resolverConsulta(consulta, fontes);

  if (resposta.ok && resposta.resultado.fonte !== 'salvo') {
    try {
      await repositorioCache.salvar(consulta, resposta.resultado);
    } catch (erro) {
      console.error('[cacheLocal] Não foi possível salvar o resultado:', erro);
    }
  }

  return resposta;
}
