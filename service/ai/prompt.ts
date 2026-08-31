import type { Consulta } from './fonte';

export const INSTRUCAO_SISTEMA =
  'Você é um especialista em benchmark e otimização de jogos para PC. Responda exclusivamente com o JSON estruturado definido pelo schema fornecido, sem texto fora dele. Liste as configurações na ordem exata em que aparecem no menu gráfico do jogo informado, cada uma com uma justificativa de até 10 palavras.';

export function criarPrompt(consulta: Consulta): string {
  return `
Jogo: ${consulta.jogo}
Placa de vídeo: ${consulta.placaVideo}
Processador: ${consulta.processador}
Memória RAM: ${consulta.memoria}
Resolução desejada: ${consulta.resolucao}

Liste as configurações gráficas do jogo "${consulta.jogo}" na ordem exata em que aparecem no menu gráfico do jogo, recomendando os valores ideais para este hardware rodar em ${consulta.resolucao}.
  `.trim();
}
