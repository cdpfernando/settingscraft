import { z } from 'zod';
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
  type Resultado,
} from './schema';

const MODEL = 'gemini-3.6-flash';
const TEMPO_LIMITE_MS = 45_000;
const MAXIMO_TENTATIVAS = 3;
const ESPERA_INICIAL_MS = 1_000;

interface FonteGeminiOpcoes {
  apiKey: string;
  transporte: TransporteHttp;
  usarResultadoExemplo?: boolean;
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

function criarResultadoExemplo(): Resultado {
  return criarResultadoGerado({
    configuracoes: [
      { nome: 'Qualidade geral', valor: 'Alto', justificativa: 'Essa placa aguenta Alto sem suar' },
      { nome: 'Sombras', valor: 'Médio', justificativa: 'Sombras altas comem FPS à toa' },
      { nome: 'Anti-aliasing', valor: 'TAA', justificativa: 'TAA some com o serrilhado barato' },
      { nome: 'Distância de renderização', valor: 'Alto', justificativa: 'Não vale reduzir a distância aqui' },
    ],
    fpsEstimado: '75 a 90 FPS',
  }, 'exemplo');
}

function deveTentarNovamente(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function calcularEspera(tentativa: number): number {
  const esperaBase = Math.min(ESPERA_INICIAL_MS * 2 ** tentativa, 8_000);
  const jitter = Math.round(Math.random() * esperaBase * 0.2);
  return esperaBase + jitter;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function criarFonteGemini({
  apiKey,
  transporte,
  usarResultadoExemplo = false,
}: FonteGeminiOpcoes): Gerador<EvidenciaDesempenho> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  return {
    nome: 'gemini',
    async gerar({ consulta, evidencia }) {
      if (usarResultadoExemplo) return criarResultadoExemplo();

      for (let tentativa = 0; tentativa < MAXIMO_TENTATIVAS; tentativa += 1) {
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
          const corpoErro = await response.json().catch(() => ({}));
          console.error('[fonteGemini] Erro na API:', response.status, corpoErro);
          if (response.status === 400 || response.status === 401) {
            throw new ErroFonteConfiguracao('gemini', response.status);
          }
          if (deveTentarNovamente(response.status) && tentativa < MAXIMO_TENTATIVAS - 1) {
            await esperar(calcularEspera(tentativa));
            continue;
          }
          if (response.status === 429) throw new ErroFonteLimite('gemini');
          return null;
        }

        const data: unknown = await response.json();
        const texto = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> })
          .candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof texto !== 'string') {
          console.error('[fonteGemini] Resposta sem texto:', data);
          return null;
        }

        let bruto: unknown;
        try {
          bruto = JSON.parse(texto);
        } catch {
          console.error('[fonteGemini] Resposta não é JSON válido:', texto);
          return null;
        }

        const validado = RespostaIaSchema.safeParse(bruto);
        if (!validado.success) {
          console.error('[fonteGemini] JSON não corresponde ao contrato:', validado.error.issues, bruto);
          return null;
        }

        return criarResultadoGerado(validado.data, 'gemini', evidencia);
        } catch (erro) {
          if (erro instanceof ErroFonteConfiguracao || erro instanceof ErroFonteLimite) throw erro;
          console.error('[fonteGemini] Falha ao consultar o Gemini:', erro);
          return null;
        } finally {
          clearTimeout(temporizador);
        }
      }

      return null;
    },
  };
}
