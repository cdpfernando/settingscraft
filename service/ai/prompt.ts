import type { ConsultaConfiguracoes } from '../consulta-configuracoes';
import { formatarPresetFpsHq } from './formatacao';
import type { EvidenciaDesempenho } from './schema';

export const INSTRUCAO_SISTEMA =
  'Você é especialista em desempenho e otimização de jogos para PC. ' +
  'Responda exclusivamente com o JSON definido pelo schema, sem texto adicional. ' +
  'Use apenas opções e valores disponíveis no menu gráfico do jogo. ' +
  'Liste todas as opções na ordem original do menu, cada uma com uma justificativa de até 10 palavras.';

function criarBlocoEvidencia(evidencia: EvidenciaDesempenho | undefined): string {
  if (!evidencia) return '';

  const tipo = evidencia.tipo === 'benchmark'
    ? 'benchmark medido'
    : 'projeção calculada pelo FPSHQ (não é benchmark medido)';
  const correspondencia = evidencia.correspondencia === 'completa'
    ? 'completa — jogo, GPU, CPU e resolução correspondidos'
    : 'parcial — jogo, GPU e resolução correspondidos; CPU não correspondida';

  const orientacaoMeta = evidencia.fpsMinimo >= 60
    ? 'Este é o preset de maior qualidade consultado cujo mínimo informado atinge 60 FPS.'
    : 'Nenhum preset consultado atingiu mínimo de 60 FPS. Esta referência é o cenário válido de melhor desempenho; admita que a meta provavelmente não é viável e não prometa 60 FPS.';

  return `
Evidência externa validada: FPSHQ
Tipo: ${tipo}
Correspondência: ${correspondencia}
Preset completo de referência: ${formatarPresetFpsHq(evidencia.presetReferencia)} em ${evidencia.resolucao}
FPS médio: ${evidencia.fpsMedio}; mínimo: ${evidencia.fpsMinimo}; máximo: ${evidencia.fpsMaximo}
Situação da meta: ${orientacaoMeta}

Os números acima pertencem ao preset completo consultado. Use-os como âncora,
mas não como garantia para a combinação personalizada de opções.
`;
}

export function criarPrompt(
  consulta: ConsultaConfiguracoes,
  evidencia?: EvidenciaDesempenho,
): string {
  return `
Jogo: ${consulta.jogo}
Placa de vídeo: ${consulta.placaVideo}
Processador: ${consulta.processador}
Memória RAM: ${consulta.memoria}
Resolução: ${consulta.resolucao}
Meta: 60 FPS estáveis
${criarBlocoEvidencia(evidencia)}

Recomende a maior qualidade visual possível mantendo 60 FPS estáveis
na resolução informada.

Quando necessário, reduza primeiro as opções com maior custo de desempenho
e menor impacto perceptível na qualidade visual.

Se o hardware não conseguir atingir 60 FPS, recomende a configuração
que mais se aproxime da meta e forneça uma estimativa realista de desempenho.
  `.trim();
}
