import { z } from 'zod';
import {
  ErroFonteConfiguracao,
  ErroFonteLimite,
  type Gerador,
  type TransporteHttp,
} from './fonte';
import { criarPrompt, INSTRUCAO_SISTEMA } from './prompt';
import { RespostaIaSchema } from './schema';

const MODEL = 'gemini-3.6-flash';
const TEMPO_LIMITE_MS = 45_000;

interface FonteGeminiOpcoes {
  apiKey: string;
  transporte: TransporteHttp;
}

function paraSchemaGemini(jsonSchema: Record<string, unknown>): Record<string, unknown> {
  const { $schema, additionalProperties, ...resto } = jsonSchema as Record<string, unknown> & {
    properties?: Record<string, Record<string, unknown>>;
    items?: Record<string, unknown>;
  };

  if (resto.properties) {
    resto.properties = Object.fromEntries(
      Object.entries(resto.properties).map(([chave, valor]) => [chave, paraSchemaGemini(valor)]),
    );
  }
  if (resto.items) resto.items = paraSchemaGemini(resto.items);
  return resto;
}

const RESPONSE_SCHEMA = paraSchemaGemini(z.toJSONSchema(RespostaIaSchema));

export function criarFonteGemini({
  apiKey,
  transporte,
}: FonteGeminiOpcoes): Gerador {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  return {
    nome: 'gemini',
    async gerar({ consulta, evidencia }) {
      const controlador = new AbortController();
      const temporizador = setTimeout(() => controlador.abort(), TEMPO_LIMITE_MS);

      try {
        const response = await transporte(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controlador.signal,
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: INSTRUCAO_SISTEMA }],
            },
            contents: [{ parts: [{ text: criarPrompt(consulta, evidencia) }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: RESPONSE_SCHEMA,
            },
          }),
        });

        if (!response.ok) {
          if (response.status === 400 || response.status === 401) {
            throw new ErroFonteConfiguracao('gemini', response.status);
          }
          if (response.status === 429) throw new ErroFonteLimite('gemini');
          return null;
        }

        const data: unknown = await response.json();
        const texto = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> })
          .candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof texto !== 'string') return null;

        let bruto: unknown;
        try {
          bruto = JSON.parse(texto);
        } catch {
          return null;
        }

        const validado = RespostaIaSchema.safeParse(bruto);
        if (!validado.success) return null;

        return validado.data;
      } catch (erro) {
        if (erro instanceof ErroFonteConfiguracao || erro instanceof ErroFonteLimite) throw erro;
        return null;
      } finally {
        clearTimeout(temporizador);
      }
    },
  };
}
