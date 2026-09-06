import {
  criarConsultaConfiguracoes,
  type ConsultaConfiguracoes,
} from '../consulta-configuracoes';

interface DadosConsultaTeste {
  jogo: string;
  placaVideo: string;
  processador: string;
  memoria: string;
  resolucao: string;
}

const DADOS_PADRAO: DadosConsultaTeste = {
  jogo: 'Cyberpunk 2077',
  placaVideo: 'NVIDIA GeForce RTX 4060',
  processador: 'AMD Ryzen 5 5600',
  memoria: '16 GB',
  resolucao: '1920x1080 (Full HD)',
};

export function criarConsultaTeste(
  sobrescritas: Partial<DadosConsultaTeste> = {},
): ConsultaConfiguracoes {
  const resultado = criarConsultaConfiguracoes({ ...DADOS_PADRAO, ...sobrescritas });
  if (!resultado.ok) {
    throw new Error(`Fixture de consulta inválida: ${JSON.stringify(resultado.erros)}`);
  }
  return resultado.consulta;
}
