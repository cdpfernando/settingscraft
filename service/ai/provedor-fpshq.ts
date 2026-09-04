import { z } from 'zod';

import type { Consulta, ProvedorEvidencia, TransporteHttp } from './fonte';
import {
  EvidenciaDesempenhoSchema,
  UrlAtribuicaoFpsHqSchema,
  type EvidenciaDesempenho,
} from './schema';

const BASE_URL = 'https://fpshq.com/api/v1';
const META_FPS_MINIMO = 60;
const TEMPO_LIMITE_PADRAO_MS = 3_000;
const PRESETS = ['low', 'medium', 'high', 'ultra'] as const;

const ItemBuscaSchema = z.object({
  type: z.enum(['game', 'gpu', 'cpu']),
  slug: z.string().min(1),
  name: z.string().min(1),
});

const RespostaBuscaSchema = z.object({
  ok: z.literal(true),
  results: z.array(ItemBuscaSchema),
});

const ReferenciaRespostaSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
});

const RespostaFpsSchema = z.object({
  ok: z.literal(true),
  game: ReferenciaRespostaSchema,
  gpu: ReferenciaRespostaSchema,
  cpu: ReferenciaRespostaSchema.nullish(),
  resolution: z.enum(['1080p', '1440p', '4K']),
  preset: z.enum(['low', 'medium', 'high', 'ultra']),
  fps: z.number().nonnegative(),
  fps_min: z.number().nonnegative(),
  fps_max: z.number().nonnegative(),
  source: z.enum(['benchmark', 'prediction']),
  url: UrlAtribuicaoFpsHqSchema,
});

type TipoBusca = 'game' | 'gpu' | 'cpu';
type ItemBusca = z.infer<typeof ItemBuscaSchema>;
type ResolucaoFpsHq = EvidenciaDesempenho['resolucao'];
type PresetFpsHq = (typeof PRESETS)[number];
type RespostaFps = z.infer<typeof RespostaFpsSchema>;
type CategoriaFalha =
  | 'cancelamento'
  | 'http-4xx'
  | 'http-429'
  | 'http-5xx'
  | 'json-invalido'
  | 'rede'
  | 'schema-invalido'
  | 'tempo-limite';

interface RespostaValidada<T> {
  dados: T;
  cachePorMs: number;
}

type ResolucaoEntidade =
  | { estado: 'resolvida'; item: ItemBusca; cachePorMs: number }
  | { estado: 'sem-correspondencia'; item: null; cachePorMs: number }
  | { estado: 'falha'; item: null; cachePorMs: 0 };

interface ResultadoEnriquecimento {
  evidencia: EvidenciaDesempenho;
  cachePorMs: number;
}

interface EntradaCache {
  evidencia: EvidenciaDesempenho;
  expiraEm: number;
}

export interface ProvedorFpsHqOpcoes {
  transporte: TransporteHttp;
  agora?: () => Date;
  tempoLimiteMs?: number;
}

function normalizarNome(valor: string): string {
  return valor.normalize('NFKC').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

function removerFabricante(valor: string): string {
  return valor.replace(/^(amd|intel|nvidia)\s+/, '');
}

function nomesEquivalentes(informado: string, encontrado: string): boolean {
  const alvo = normalizarNome(informado);
  const candidato = normalizarNome(encontrado);
  return alvo === candidato || removerFabricante(alvo) === removerFabricante(candidato);
}

function mapearResolucao(valor: string): ResolucaoFpsHq | null {
  const resolucoes: Record<string, ResolucaoFpsHq> = {
    '1920x1080 (full hd)': '1080p',
    'full hd': '1080p',
    '2560x1440 (2k)': '1440p',
    '2k': '1440p',
    '3840x2160 (4k)': '4K',
    '4k': '4K',
  };

  return resolucoes[normalizarNome(valor)] ?? null;
}

function chaveConsulta(consulta: Consulta): string {
  return JSON.stringify([
    normalizarNome(consulta.jogo),
    normalizarNome(consulta.placaVideo),
    normalizarNome(consulta.processador),
    normalizarNome(consulta.resolucao),
  ]);
}

function duracaoCacheMs(cacheControl: string | null): number {
  if (!cacheControl || /(?:^|,)\s*(?:no-store|no-cache)\b/i.test(cacheControl)) return 0;

  const correspondencia = /(?:^|,)\s*max-age\s*=\s*"?(\d+)"?/i.exec(cacheControl);
  if (!correspondencia) return 0;

  const segundos = Number(correspondencia[1]);
  return Number.isSafeInteger(segundos) && segundos > 0 ? segundos * 1_000 : 0;
}

function registrarFalha(
  estagio: string,
  status: number | 'sem-resposta',
  categoria: CategoriaFalha,
): void {
  console.warn(`[provedorFpsHq] estagio=${estagio} status=${status} categoria=${categoria}`);
}

function categoriaHttp(status: number): CategoriaFalha {
  if (status === 429) return 'http-429';
  if (status >= 500) return 'http-5xx';
  return 'http-4xx';
}

async function consultarJson<T>(
  transporte: TransporteHttp,
  url: string,
  sinal: AbortSignal,
  estagio: string,
  schema: z.ZodType<T>,
): Promise<RespostaValidada<T> | null> {
  let resposta: Response;

  try {
    resposta = await transporte(url, {
      headers: { Accept: 'application/json' },
      signal: sinal,
    });
  } catch (erro) {
    const cancelado = sinal.aborted
      || (erro instanceof Error && erro.name === 'AbortError');
    registrarFalha(estagio, 'sem-resposta', cancelado ? 'cancelamento' : 'rede');
    return null;
  }

  if (!resposta.ok) {
    registrarFalha(estagio, resposta.status, categoriaHttp(resposta.status));
    return null;
  }

  let bruto: unknown;
  try {
    bruto = await resposta.json();
  } catch {
    registrarFalha(estagio, resposta.status, 'json-invalido');
    return null;
  }

  const validado = schema.safeParse(bruto);
  if (!validado.success) {
    registrarFalha(estagio, resposta.status, 'schema-invalido');
    return null;
  }

  return {
    dados: validado.data,
    cachePorMs: duracaoCacheMs(resposta.headers.get('cache-control')),
  };
}

async function resolverEntidade(
  transporte: TransporteHttp,
  tipo: TipoBusca,
  nome: string,
  sinal: AbortSignal,
): Promise<ResolucaoEntidade> {
  const query = new URLSearchParams({ q: nome, type: tipo, limit: '10' });
  const resposta = await consultarJson(
    transporte,
    `${BASE_URL}/search?${query}`,
    sinal,
    `busca-${tipo}`,
    RespostaBuscaSchema,
  );
  if (!resposta) return { estado: 'falha', item: null, cachePorMs: 0 };

  const correspondencias = resposta.dados.results.filter(
    (item) => item.type === tipo && nomesEquivalentes(nome, item.name),
  );

  if (correspondencias.length !== 1) {
    return {
      estado: 'sem-correspondencia',
      item: null,
      cachePorMs: resposta.cachePorMs,
    };
  }

  return {
    estado: 'resolvida',
    item: correspondencias[0],
    cachePorMs: resposta.cachePorMs,
  };
}

function correspondeConsulta(
  resposta: RespostaFps,
  jogo: ItemBusca,
  placaVideo: ItemBusca,
  processador: ItemBusca | null,
  resolucao: ResolucaoFpsHq,
  preset: PresetFpsHq,
): boolean {
  const cpuCorresponde = processador
    ? resposta.cpu?.slug === processador.slug
    : resposta.cpu == null;

  return resposta.game.slug === jogo.slug
    && resposta.gpu.slug === placaVideo.slug
    && cpuCorresponde
    && resposta.resolution === resolucao
    && resposta.preset === preset;
}

function possuiAnomaliaDeOrdem(resultados: readonly RespostaFps[]): boolean {
  const porPreset = new Map(resultados.map((resultado) => [resultado.preset, resultado]));

  return PRESETS.some((presetMenor, indiceMenor) => {
    const resultadoMenor = porPreset.get(presetMenor);
    if (!resultadoMenor) return false;

    return PRESETS.slice(indiceMenor + 1).some((presetMaior) => {
      const resultadoMaior = porPreset.get(presetMaior);
      return !!resultadoMaior && (
        resultadoMaior.fps_min > resultadoMenor.fps_min
        || resultadoMaior.fps > resultadoMenor.fps
        || resultadoMaior.fps_max > resultadoMenor.fps_max
      );
    });
  });
}

function selecionarReferencia(resultados: readonly RespostaFps[]): RespostaFps | null {
  const porQualidade = [...resultados].sort(
    (a, b) => PRESETS.indexOf(b.preset) - PRESETS.indexOf(a.preset),
  );
  const maiorQualidadeNaMeta = porQualidade.find(
    (resultado) => resultado.fps_min >= META_FPS_MINIMO,
  );
  if (maiorQualidadeNaMeta) return maiorQualidadeNaMeta;

  return [...resultados].sort((a, b) =>
    b.fps_min - a.fps_min
    || b.fps - a.fps
    || b.fps_max - a.fps_max
    || PRESETS.indexOf(b.preset) - PRESETS.indexOf(a.preset)
  )[0] ?? null;
}

function menorDuracaoCache(valores: readonly number[]): number {
  return valores.length > 0 && valores.every((valor) => valor > 0)
    ? Math.min(...valores)
    : 0;
}

async function enriquecer(
  transporte: TransporteHttp,
  consulta: Consulta,
  resolucao: ResolucaoFpsHq,
  sinal: AbortSignal,
  agora: () => Date,
): Promise<ResultadoEnriquecimento | null> {
  const [jogoResolvido, placaVideoResolvida, processadorResolvido] = await Promise.all([
    resolverEntidade(transporte, 'game', consulta.jogo, sinal),
    resolverEntidade(transporte, 'gpu', consulta.placaVideo, sinal),
    resolverEntidade(transporte, 'cpu', consulta.processador, sinal),
  ]);
  const buscaFalhou = [jogoResolvido, placaVideoResolvida, processadorResolvido]
    .some((resolucaoEntidade) => resolucaoEntidade.estado === 'falha');
  if (
    buscaFalhou
    || jogoResolvido.estado !== 'resolvida'
    || placaVideoResolvida.estado !== 'resolvida'
    || sinal.aborted
  ) return null;

  const jogo = jogoResolvido.item;
  const placaVideo = placaVideoResolvida.item;
  const processador = processadorResolvido.estado === 'resolvida'
    ? processadorResolvido.item
    : null;
  const respostas = await Promise.all(PRESETS.map(async (preset) => {
    const parametros: Record<string, string> = {
      game: jogo.slug,
      gpu: placaVideo.slug,
      res: resolucao,
      preset,
    };
    if (processador) parametros.cpu = processador.slug;

    const query = new URLSearchParams(parametros);
    return consultarJson(
      transporte,
      `${BASE_URL}/fps?${query}`,
      sinal,
      `fps-${preset}`,
      RespostaFpsSchema,
    );
  }));
  if (sinal.aborted) return null;

  const resultadosValidos = respostas.flatMap((resposta, indice) => {
    if (!resposta) return [];

    const preset = PRESETS[indice];
    return correspondeConsulta(
      resposta.dados,
      jogo,
      placaVideo,
      processador,
      resolucao,
      preset,
    ) ? [resposta.dados] : [];
  });

  if (possuiAnomaliaDeOrdem(resultadosValidos)) {
    console.warn('[provedorFpsHq] estagio=presets status=200 categoria=ordem-nao-monotonica');
  }

  const referencia = selecionarReferencia(resultadosValidos);
  if (!referencia) return null;

  const evidencia = EvidenciaDesempenhoSchema.parse({
    fonte: 'fpshq',
    tipo: referencia.source === 'benchmark' ? 'benchmark' : 'predicao',
    correspondencia: processador ? 'completa' : 'parcial',
    urlAtribuicao: referencia.url,
    consultadoEm: agora().toISOString(),
    jogo: { slug: referencia.game.slug, nome: referencia.game.name },
    placaVideo: { slug: referencia.gpu.slug, nome: referencia.gpu.name },
    processador: processador
      ? { slug: referencia.cpu!.slug, nome: referencia.cpu!.name }
      : null,
    resolucao: referencia.resolution,
    presetReferencia: referencia.preset,
    fpsMedio: referencia.fps,
    fpsMinimo: referencia.fps_min,
    fpsMaximo: referencia.fps_max,
  });

  return {
    evidencia,
    cachePorMs: menorDuracaoCache([
      jogoResolvido.cachePorMs,
      placaVideoResolvida.cachePorMs,
      processadorResolvido.cachePorMs,
      ...respostas.map((resposta) => resposta?.cachePorMs ?? 0),
    ]),
  };
}

export function criarProvedorEvidenciaFpsHq({
  transporte,
  agora = () => new Date(),
  tempoLimiteMs = TEMPO_LIMITE_PADRAO_MS,
}: ProvedorFpsHqOpcoes): ProvedorEvidencia<EvidenciaDesempenho> {
  const cache = new Map<string, EntradaCache>();
  const consultasEmVoo = new Map<string, Promise<EvidenciaDesempenho | null>>();

  async function buscarSemCache(
    consulta: Consulta,
    resolucao: ResolucaoFpsHq,
    chave: string,
  ): Promise<EvidenciaDesempenho | null> {
    const controlador = new AbortController();
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const tempoEsgotado = new Promise<null>((resolve) => {
      temporizador = setTimeout(() => {
        controlador.abort();
        registrarFalha('orcamento', 'sem-resposta', 'tempo-limite');
        resolve(null);
      }, tempoLimiteMs);
    });

    try {
      const resultado = await Promise.race([
        enriquecer(transporte, consulta, resolucao, controlador.signal, agora),
        tempoEsgotado,
      ]);
      if (!resultado) return null;

      if (resultado.cachePorMs > 0) {
        cache.set(chave, {
          evidencia: resultado.evidencia,
          expiraEm: agora().getTime() + resultado.cachePorMs,
        });
      }

      return resultado.evidencia;
    } finally {
      if (temporizador) clearTimeout(temporizador);
    }
  }

  return {
    nome: 'fpshq',
    buscar(consulta) {
      const resolucao = mapearResolucao(consulta.resolucao);
      if (!resolucao) return Promise.resolve(null);

      const chave = chaveConsulta(consulta);
      const armazenado = cache.get(chave);
      if (armazenado && armazenado.expiraEm > agora().getTime()) {
        return Promise.resolve(armazenado.evidencia);
      }
      if (armazenado) cache.delete(chave);

      const existente = consultasEmVoo.get(chave);
      if (existente) return existente;

      const consultaEmVoo = buscarSemCache(consulta, resolucao, chave)
        .finally(() => consultasEmVoo.delete(chave));
      consultasEmVoo.set(chave, consultaEmVoo);
      return consultaEmVoo;
    },
  };
}
