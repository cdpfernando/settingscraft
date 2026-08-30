import { z } from 'zod';
import { CONTRATO_VERSAO, RespostaIaSchema, type Resultado } from './schema';

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL = "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
const defaultErrorMessage = "Não foi possível gerar as configurações. Tente novamente.";

/** Ajusta layout sem gastar quota nem esperar a chamada de rede. */
const usarResultadoExemplo = process.env.EXPO_PUBLIC_USAR_RESULTADO_EXEMPLO === "true";

if (!apiKey) {
  console.warn("[createOptmizedSetting] EXPO_PUBLIC_GEMINI_API_KEY não está definido.");
}

export interface HardwareInfo {
  jogo: string;
  placaVideo: string;
  processador: string;
  memoria: string;
  resolucao: string;
}

export type ConsultaResultado =
  | { ok: true; resultado: Resultado }
  | { ok: false; erro: string };

/**
 * O Schema aceito pelo Gemini é um subconjunto do OpenAPI 3.0 — sem
 * `$schema` nem `additionalProperties`. Em vez de escrever esse schema à
 * mão em paralelo ao Zod, filtramos as poucas chaves que o JSON Schema
 * padrão inclui e que o Gemini não reconhece.
 */
function paraSchemaGemini(jsonSchema: Record<string, unknown>): Record<string, unknown> {
  const { $schema, additionalProperties, ...resto } = jsonSchema as Record<string, unknown> & {
    properties?: Record<string, Record<string, unknown>>;
    items?: Record<string, unknown>;
  };

  if (resto.properties) {
    resto.properties = Object.fromEntries(
      Object.entries(resto.properties as Record<string, Record<string, unknown>>).map(
        ([chave, valor]) => [chave, paraSchemaGemini(valor)]
      )
    );
  }
  if (resto.items) {
    resto.items = paraSchemaGemini(resto.items as Record<string, unknown>);
  }
  return resto;
}

const RESPONSE_SCHEMA = paraSchemaGemini(z.toJSONSchema(RespostaIaSchema));

const RESULTADO_EXEMPLO: Resultado = {
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

export async function createOptmizedSetting(info: HardwareInfo): Promise<ConsultaResultado> {
  if (usarResultadoExemplo) {
    return { ok: true, resultado: RESULTADO_EXEMPLO };
  }

  if (!apiKey) {
    console.error("[createOptmizedSetting] EXPO_PUBLIC_GEMINI_API_KEY não está configurada.");
    return { ok: false, erro: defaultErrorMessage };
  }

  const prompt = `
Jogo: ${info.jogo}
Placa de vídeo: ${info.placaVideo}
Processador: ${info.processador}
Memória RAM: ${info.memoria}
Resolução desejada: ${info.resolucao}

Liste as configurações gráficas do jogo "${info.jogo}" na ordem exata em que aparecem no menu gráfico do jogo, recomendando os valores ideais para este hardware rodar em ${info.resolucao}.
  `.trim();

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: "Você é um especialista em benchmark e otimização de jogos para PC. Responda exclusivamente com o JSON estruturado definido pelo schema fornecido, sem texto fora dele. Liste as configurações na ordem exata em que aparecem no menu gráfico do jogo informado, cada uma com uma justificativa de até 10 palavras.",
          }],
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error("[createOptmizedSetting] Erro na API:", response.status, errorBody);

      if (response.status === 429) {
        return { ok: false, erro: "Limite de requisições atingido. Tente novamente em alguns segundos." };
      }
      return { ok: false, erro: defaultErrorMessage };
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("[createOptmizedSetting] Resposta sem texto:", data);
      return { ok: false, erro: defaultErrorMessage };
    }

    let bruto: unknown;
    try {
      bruto = JSON.parse(text);
    } catch {
      console.error("[createOptmizedSetting] Resposta não é JSON válido:", text);
      return { ok: false, erro: defaultErrorMessage };
    }

    const validado = RespostaIaSchema.safeParse(bruto);
    if (!validado.success) {
      console.error("[createOptmizedSetting] JSON não corresponde ao contrato:", validado.error.issues, bruto);
      return { ok: false, erro: defaultErrorMessage };
    }

    return {
      ok: true,
      resultado: {
        ...validado.data,
        fonte: "gemini",
        geradoEm: new Date().toISOString(),
        versaoContrato: CONTRATO_VERSAO,
      },
    };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error(`[createOptmizedSetting] Falha ao gerar configurações: ${error.message}`, { info });
    return { ok: false, erro: defaultErrorMessage };
  }
}
