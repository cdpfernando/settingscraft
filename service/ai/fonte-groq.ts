import { createGroq } from '@ai-sdk/groq';
import { APICallError, generateText, Output } from 'ai';

import {
  ErroFonteConfiguracao,
  ErroFonteLimite,
  type Gerador,
  type TransporteHttp,
} from './fonte';
import { criarPrompt, INSTRUCAO_SISTEMA } from './prompt';
import {
  criarResultadoGerado,
  RespostaIaSchema,
  type EvidenciaDesempenho,
} from './schema';

const MODEL = 'openai/gpt-oss-120b';
const TEMPO_LIMITE_MS = 45_000;

interface FonteGroqOpcoes {
  apiKey: string;
  transporte: TransporteHttp;
}

export function criarFonteGroq({ apiKey, transporte }: FonteGroqOpcoes): Gerador<EvidenciaDesempenho> {
  const groq = createGroq({ apiKey, fetch: transporte });

  return {
    nome: 'groq',
    async gerar({ consulta, evidencia }) {
      const controlador = new AbortController();
      const temporizador = setTimeout(() => controlador.abort(), TEMPO_LIMITE_MS);

      try {
        const { output } = await generateText({
          model: groq(MODEL),
          output: Output.object({ schema: RespostaIaSchema }),
          instructions: INSTRUCAO_SISTEMA,
          prompt: criarPrompt(consulta, evidencia),
          abortSignal: controlador.signal,
        });

        return criarResultadoGerado(output, 'groq', evidencia);
      } catch (erro) {
        if (APICallError.isInstance(erro)) {
          const corpo =
            typeof erro.responseBody === 'string' ? erro.responseBody.slice(0, 500) : erro.responseBody;
          console.error('[fonteGroq] Erro na API:', erro.statusCode, erro.message, erro.cause, corpo);
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
