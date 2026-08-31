import { createGroq } from '@ai-sdk/groq';
import { APICallError, generateObject } from 'ai';

import {
  ErroFonteConfiguracao,
  ErroFonteLimite,
  type Fonte,
  type TransporteHttp,
} from './fonte';
import { criarPrompt, INSTRUCAO_SISTEMA } from './prompt';
import { CONTRATO_VERSAO, RespostaIaSchema } from './schema';

const MODEL = 'openai/gpt-oss-120b';
const TEMPO_LIMITE_MS = 45_000;

interface FonteGroqOpcoes {
  apiKey: string;
  transporte: TransporteHttp;
}

/** Último elo da cadeia: mesmo contrato Zod do Gemini, via AI SDK. */
export function criarFonteGroq({ apiKey, transporte }: FonteGroqOpcoes): Fonte {
  const groq = createGroq({ apiKey, fetch: transporte });

  return {
    nome: 'groq',
    async buscar(consulta) {
      const controlador = new AbortController();
      const temporizador = setTimeout(() => controlador.abort(), TEMPO_LIMITE_MS);

      try {
        const { object } = await generateObject({
          model: groq(MODEL),
          schema: RespostaIaSchema,
          system: INSTRUCAO_SISTEMA,
          prompt: criarPrompt(consulta),
          abortSignal: controlador.signal,
        });

        return {
          ...object,
          fonte: 'groq',
          geradoEm: new Date().toISOString(),
          versaoContrato: CONTRATO_VERSAO,
        };
      } catch (erro) {
        if (APICallError.isInstance(erro)) {
          console.error('[fonteGroq] Erro na API:', erro.statusCode, erro.message);
          if (erro.statusCode === 400 || erro.statusCode === 401) {
            throw new ErroFonteConfiguracao('groq', erro.statusCode);
          }
          if (erro.statusCode === 429) throw new ErroFonteLimite('groq');
          return null;
        }
        console.error('[fonteGroq] Falha ao consultar o Groq:', erro);
        return null;
      } finally {
        clearTimeout(temporizador);
      }
    },
  };
}
