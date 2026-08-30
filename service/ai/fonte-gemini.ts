import { z } from 'zod';
import {
  ErroFonteConfiguracao,
  type Consulta,
  type Fonte,
  type TransporteHttp,
} from './fonte';
import { CONTRATO_VERSAO, RespostaIaSchema, type Resultado } from './schema';

const MODEL = 'gemini-3.6-flash';
const TEMPO_LIMITE_MS = 15_000;

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
  return {
    configuracoes: [
      { nome: 'Qualidade geral', valor: 'Alto', justificativa: 'Equilíbrio entre fidelidade visual e desempenho' },
      { nome: 'Sombras', valor: 'Médio', justificativa: 'Maior impacto no FPS que ganho visual percebido' },
      { nome: 'Anti-aliasing', valor: 'TAA', justificativa: 'Suaviza bordas com custo baixo de desempenho' },
      { nome: 'Distância de renderização', valor: 'Alto', justificativa: 'Placa suporta sem perda perceptível' },
    ],
    fpsEstimado: '75–90 FPS',
    fonte: 'exemplo',
    geradoEm: new Date().toISOString(),
    versaoContrato: CONTRATO_VERSAO,
  };
}

function criarPrompt(consulta: Consulta): string {
  return `
Jogo: ${consulta.jogo}
Placa de vídeo: ${consulta.placaVideo}
Processador: ${consulta.processador}
Memória RAM: ${consulta.memoria}
Resolução desejada: ${consulta.resolucao}

Liste as configurações gráficas do jogo "${consulta.jogo}" na ordem exata em que aparecem no menu gráfico do jogo, recomendando os valores ideais para este hardware rodar em ${consulta.resolucao}.
  `.trim();
}

/** Cria o elo Gemini; o transporte é recebido por injeção para exercitar a fonte isoladamente. */
export function criarFonteGemini({
  apiKey,
  transporte,
  usarResultadoExemplo = false,
}: FonteGeminiOpcoes): Fonte {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  return {
    nome: 'gemini',
    async buscar(consulta) {
      if (usarResultadoExemplo) return criarResultadoExemplo();

      const controlador = new AbortController();
      const temporizador = setTimeout(() => controlador.abort(), TEMPO_LIMITE_MS);

      try {
        const response = await transporte(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controlador.signal,
          body: JSON.stringify({
            system_instruction: {
              parts: [{
                text: 'Você é um especialista em benchmark e otimização de jogos para PC. Responda exclusivamente com o JSON estruturado definido pelo schema fornecido, sem texto fora dele. Liste as configurações na ordem exata em que aparecem no menu gráfico do jogo informado, cada uma com uma justificativa de até 10 palavras.',
              }],
            },
            contents: [{ parts: [{ text: criarPrompt(consulta) }] }],
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

        return {
          ...validado.data,
          fonte: 'gemini',
          geradoEm: new Date().toISOString(),
          versaoContrato: CONTRATO_VERSAO,
        };
      } catch (erro) {
        if (erro instanceof ErroFonteConfiguracao) throw erro;
        console.error('[fonteGemini] Falha ao consultar o Gemini:', erro);
        return null;
      } finally {
        clearTimeout(temporizador);
      }
    },
  };
}
