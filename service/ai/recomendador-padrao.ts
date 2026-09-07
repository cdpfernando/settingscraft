import { fetch as expoFetch } from 'expo/fetch';

import { criarRepositorioRecomendacoesSalvas } from './recomendacao-salva';
import { criarFonteGemini } from './fonte-gemini';
import { criarFonteGroq } from './fonte-groq';
import type { Gerador } from './fonte';
import { criarProvedorEvidenciaFpsHq } from './provedor-fpshq';
import { criarRecomendador } from './recomendador';
import type { RespostaIa } from './schema';

const recomendacoesSalvas = criarRepositorioRecomendacoesSalvas();
const apiKeyGemini = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const apiKeyGroq = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const usarResultadoExemplo = process.env.EXPO_PUBLIC_USAR_RESULTADO_EXEMPLO === 'true';

const respostaExemplo: RespostaIa = {
  configuracoes: [
    { nome: 'Qualidade geral', valor: 'Alto', justificativa: 'Essa placa aguenta Alto sem suar' },
    { nome: 'Sombras', valor: 'Médio', justificativa: 'Sombras altas comem FPS à toa' },
    { nome: 'Anti-aliasing', valor: 'TAA', justificativa: 'TAA some com o serrilhado barato' },
    { nome: 'Distância de renderização', valor: 'Alto', justificativa: 'Não vale reduzir a distância aqui' },
  ],
  fpsEstimado: '75 a 90 FPS',
};

const geradorExemplo: Gerador | undefined = usarResultadoExemplo
  ? { nome: 'exemplo', async gerar() { return respostaExemplo; } }
  : undefined;

const gemini = !usarResultadoExemplo && apiKeyGemini
  ? criarFonteGemini({ apiKey: apiKeyGemini, transporte: fetch })
  : undefined;

if (!usarResultadoExemplo && !apiKeyGemini) {
  console.warn('[recomendador] EXPO_PUBLIC_GEMINI_API_KEY não está definida; Gemini omitido da cadeia.');
}

const groq = !usarResultadoExemplo && apiKeyGroq
  ? criarFonteGroq({ apiKey: apiKeyGroq, transporte: expoFetch as typeof fetch })
  : undefined;

if (!usarResultadoExemplo && !apiKeyGroq) {
  console.warn('[recomendador] EXPO_PUBLIC_GROQ_API_KEY não está definida; Groq omitido da cadeia.');
}

export const recomendadorPadrao = criarRecomendador({
  recomendacoesSalvas,
  exemplo: geradorExemplo,
  fpsHq: usarResultadoExemplo
    ? undefined
    : criarProvedorEvidenciaFpsHq({ transporte: expoFetch as typeof fetch }),
  gemini,
  groq,
});
