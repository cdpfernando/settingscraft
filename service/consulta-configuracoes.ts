export const OPCOES_MEMORIA = ['8 GB', '16 GB', '32 GB', '64 GB', '128 GB'] as const;

export const RESOLUCOES = [
  '1280x720 (HD)',
  '1920x1080 (Full HD)',
  '2560x1440 (2K)',
  '3840x2160 (4K)',
] as const;

export type Memoria = (typeof OPCOES_MEMORIA)[number];
export type Resolucao = (typeof RESOLUCOES)[number];

export type CampoConsultaConfiguracoes =
  | 'jogo'
  | 'placaVideo'
  | 'processador'
  | 'memoria'
  | 'resolucao';

export type MotivoConsultaInvalida =
  | 'obrigatorio'
  | 'tipo_invalido'
  | 'opcao_nao_suportada';

export type ErrosConsultaConfiguracoes = Readonly<
  Partial<Record<CampoConsultaConfiguracoes, MotivoConsultaInvalida>>
>;

interface DadosConsultaConfiguracoes {
  jogo: string;
  placaVideo: string;
  processador: string;
  memoria: Memoria;
  resolucao: Resolucao;
}

class ValorConsultaConfiguracoes implements Readonly<DadosConsultaConfiguracoes> {
  readonly jogo: string;
  readonly placaVideo: string;
  readonly processador: string;
  readonly memoria: Memoria;
  readonly resolucao: Resolucao;

  constructor(dados: DadosConsultaConfiguracoes) {
    this.jogo = dados.jogo;
    this.placaVideo = dados.placaVideo;
    this.processador = dados.processador;
    this.memoria = dados.memoria;
    this.resolucao = dados.resolucao;
    Object.freeze(this);
  }

  // Marca nominal só no sistema de tipos. `private declare` quebra o Babel do Expo 54.
  private marcaConsultaConfiguracoes(): void {}
}

export type ConsultaConfiguracoes = ValorConsultaConfiguracoes;

type CriacaoConsultaConfiguracoes =
  | { readonly ok: true; readonly consulta: ConsultaConfiguracoes }
  | { readonly ok: false; readonly erros: ErrosConsultaConfiguracoes };

const CAMPOS = [
  'jogo',
  'placaVideo',
  'processador',
  'memoria',
  'resolucao',
] as const satisfies readonly CampoConsultaConfiguracoes[];

function normalizarEspacos(valor: string): string {
  return valor.trim().replace(/\s+/g, ' ');
}

function normalizarIdentidade(valor: string): string {
  return normalizarEspacos(valor).toLocaleLowerCase('pt-BR');
}

function encontrarOpcao<T extends string>(
  valor: string,
  opcoes: readonly T[],
): T | undefined {
  const comparavel = normalizarIdentidade(valor);
  return opcoes.find((opcao) => normalizarIdentidade(opcao) === comparavel);
}

export function criarConsultaConfiguracoes(entrada: unknown): CriacaoConsultaConfiguracoes {
  const dados = typeof entrada === 'object' && entrada !== null && !Array.isArray(entrada)
    ? entrada as Record<string, unknown>
    : {};
  const erros: Partial<Record<CampoConsultaConfiguracoes, MotivoConsultaInvalida>> = {};
  const textos: Partial<Record<CampoConsultaConfiguracoes, string>> = {};

  for (const campo of CAMPOS) {
    const valor = dados[campo];

    if (valor === undefined || (typeof valor === 'string' && normalizarEspacos(valor) === '')) {
      erros[campo] = 'obrigatorio';
      continue;
    }

    if (typeof valor !== 'string') {
      erros[campo] = 'tipo_invalido';
      continue;
    }

    textos[campo] = normalizarEspacos(valor);
  }

  const memoria = textos.memoria
    ? encontrarOpcao(textos.memoria, OPCOES_MEMORIA)
    : undefined;
  if (textos.memoria && !memoria) erros.memoria = 'opcao_nao_suportada';

  const resolucao = textos.resolucao
    ? encontrarOpcao(textos.resolucao, RESOLUCOES)
    : undefined;
  if (textos.resolucao && !resolucao) erros.resolucao = 'opcao_nao_suportada';

  if (Object.keys(erros).length > 0) {
    return Object.freeze({ ok: false, erros: Object.freeze(erros) });
  }

  const consulta = new ValorConsultaConfiguracoes({
    jogo: textos.jogo!,
    placaVideo: textos.placaVideo!,
    processador: textos.processador!,
    memoria: memoria!,
    resolucao: resolucao!,
  });

  return Object.freeze({ ok: true, consulta });
}

export function identificarConsultaConfiguracoes(consulta: ConsultaConfiguracoes): string {
  return JSON.stringify(CAMPOS.map((campo) => normalizarIdentidade(consulta[campo])));
}
