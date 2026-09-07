import { z } from 'zod';

import type { ConsultaConfiguracoes } from '../consulta-configuracoes';
import type { ProvedorEvidencia, TransporteHttp } from './fonte';
import {
  EvidenciaDesempenhoSchema,
  UrlAtribuicaoFpsHqSchema,
  type EvidenciaDesempenho,
} from './schema';

const BASE_URL = 'https://fpshq.com/api/v1';
const META_FPS_MINIMO = 60;
const TEMPO_LIMITE_PADRAO_MS = 3_000;
const PRESETS = ['low', 'medium', 'high', 'ultra'] as const;
const LIMITE_BUSCA = 10;

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

type ResolucaoEntidade =
  | { estado: 'resolvida'; item: ItemBusca }
  | { estado: 'sem-correspondencia'; item: null }
  | { estado: 'falha'; item: null };

export interface ProvedorFpsHqOpcoes {
  transporte: TransporteHttp;
  tempoLimiteMs?: number;
}

function normalizarNome(valor: string): string {
  return valor.normalize('NFKC').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

/**
 * Única autoridade sobre o fabricante à frente do modelo. O `/search` do FPSHQ
 * casa `q` como substring do `name`, e nenhum `name` do catálogo traz o
 * fabricante: "NVIDIA GeForce RTX 4060" volta vazio, "GeForce RTX 4060" volta
 * cinco resultados. Termo de busca e comparação passam por aqui — se divergirem,
 * a evidência some sem erro.
 */
function termoDeBusca(tipo: TipoBusca, nome: string): string {
  // No título do jogo o começo é o título, não ruído de fabricante.
  return tipo === 'game' ? nome : nome.replace(/^(amd|intel|nvidia)\s+/i, '');
}

function nomesEquivalentes(tipo: TipoBusca, informado: string, encontrado: string): boolean {
  // Os dois lados passam pela mesma remoção: o jogador pode escrever o fabricante
  // ou não, e o catálogo pode registrar de qualquer das formas.
  return normalizarNome(termoDeBusca(tipo, informado))
    === normalizarNome(termoDeBusca(tipo, encontrado));
}

/**
 * Formas de slug do FPSHQ para um título. Desempata quando o `name` canônico
 * traz a expansão mas o slug guardou o título que o jogador digitou —
 * `cyberpunk-2077` responde por "Cyberpunk 2077: Phantom Liberty".
 *
 * São duas porque o próprio FPSHQ é inconsistente com o apóstrofo, conferido na
 * API em 2026-09-07: `baldurs-gate-3` e `no-mans-sky` descartam o apóstrofo,
 * `baldur-s-gate-dark-alliance` e `tom-clancy-s-splinter-cell` o trocam por
 * traço — e as duas formas convivem na mesma página de "Baldur's Gate". Nada no
 * `name` diz qual delas o catálogo escolheu, então a regra aceita as duas.
 * Continua sendo igualdade de slug, não aproximação: nenhum item do catálogo
 * responde pelas duas formas, então aceitar as duas não inventa empate.
 */
function formasDeSlug(valor: string): readonly string[] {
  const semAcento = normalizarNome(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const emSlug = (texto: string) => texto
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const comTraco = emSlug(semAcento);
  const semApostrofo = emSlug(semAcento.replace(/['\u2019\u02bc]/g, ''));

  return comTraco === semApostrofo ? [comTraco] : [comTraco, semApostrofo];
}

/**
 * O FPSHQ registra vários jogos pelo título base seguido da edição ou da
 * expansão. O sufixo só conta depois de um separador: "God of War Ragnarok" é
 * outro jogo, não uma edição de "God of War".
 */
function ehTituloExpandido(informado: string, encontrado: string): boolean {
  const alvo = normalizarNome(informado);
  const candidato = normalizarNome(encontrado);
  return candidato.startsWith(alvo) && /^\s*[:–—-]\s/.test(candidato.slice(alvo.length));
}

/**
 * Regras de correspondência em ordem de precedência. A primeira que alcança
 * algum candidato decide: um único candidato resolve, mais de um é ambiguidade
 * e não resolve nada.
 *
 * As regras afrouxadas têm duas condições. Valem só para o jogo — no hardware o
 * sufixo é fabricante de placa ("ASUS ROG Strix Radeon RX 6600") ou variante de
 * encapsulamento ("Core i5-12400F Box"), que não são edições do mesmo item. E
 * valem só quando a página não veio cheia: `/search` devolve uma página, não o
 * catálogo, e ali candidato único não significa único no catálogo. "Serious Sam"
 * traz uma edição entre os dez primeiros e três no catálogo inteiro — afrouxar
 * sobre a página seria escolher uma delas no escuro.
 */
function escolherCandidato(
  tipo: TipoBusca,
  nome: string,
  resultados: readonly ItemBusca[],
): ItemBusca | null {
  const candidatos = resultados.filter((item) => item.type === tipo);
  const alvo = termoDeBusca(tipo, nome);
  const regras: Array<(item: ItemBusca) => boolean> = [
    (item) => nomesEquivalentes(tipo, nome, item.name),
  ];
  if (tipo === 'game' && resultados.length < LIMITE_BUSCA) {
    const slugsAlvo = formasDeSlug(alvo);
    regras.push(
      (item) => slugsAlvo.includes(item.slug),
      (item) => ehTituloExpandido(alvo, termoDeBusca(tipo, item.name)),
    );
  }

  for (const regra of regras) {
    const casados = candidatos.filter(regra);
    if (casados.length === 0) continue;

    return casados.length === 1 ? casados[0] : null;
  }

  return null;
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

async function consultarJson<T>(
  transporte: TransporteHttp,
  url: string,
  sinal: AbortSignal,
  schema: z.ZodType<T>,
): Promise<T | null> {
  try {
    const resposta = await transporte(url, {
      headers: { Accept: 'application/json' },
      signal: sinal,
    });
    if (!resposta.ok) return null;

    const bruto: unknown = await resposta.json();
    const validado = schema.safeParse(bruto);
    return validado.success ? validado.data : null;
  } catch {
    return null;
  }
}

async function resolverEntidade(
  transporte: TransporteHttp,
  tipo: TipoBusca,
  nome: string,
  sinal: AbortSignal,
): Promise<ResolucaoEntidade> {
  const query = new URLSearchParams({
    q: termoDeBusca(tipo, nome),
    type: tipo,
    limit: String(LIMITE_BUSCA),
  });
  const resposta = await consultarJson(
    transporte,
    `${BASE_URL}/search?${query}`,
    sinal,
    RespostaBuscaSchema,
  );
  if (!resposta) return { estado: 'falha', item: null };

  const item = escolherCandidato(tipo, nome, resposta.results);

  return item
    ? { estado: 'resolvida', item }
    : { estado: 'sem-correspondencia', item: null };
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

async function enriquecer(
  transporte: TransporteHttp,
  consulta: ConsultaConfiguracoes,
  resolucao: ResolucaoFpsHq,
  sinal: AbortSignal,
): Promise<EvidenciaDesempenho | null> {
  const [jogoResolvido, placaVideoResolvida, processadorResolvido] = await Promise.all([
    resolverEntidade(transporte, 'game', consulta.jogo, sinal),
    resolverEntidade(transporte, 'gpu', consulta.placaVideo, sinal),
    resolverEntidade(transporte, 'cpu', consulta.processador, sinal),
  ]);
  const buscaFalhou = [jogoResolvido, placaVideoResolvida, processadorResolvido]
    .some((entidade) => entidade.estado === 'falha');
  if (buscaFalhou) throw new Error('Falha ao consultar entidades no FPSHQ.');
  if (
    jogoResolvido.estado !== 'resolvida'
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

    return consultarJson(
      transporte,
      `${BASE_URL}/fps?${new URLSearchParams(parametros)}`,
      sinal,
      RespostaFpsSchema,
    );
  }));
  if (sinal.aborted) return null;

  const resultadosValidos = respostas.flatMap((resposta, indice) => {
    if (!resposta) return [];

    return correspondeConsulta(
      resposta,
      jogo,
      placaVideo,
      processador,
      resolucao,
      PRESETS[indice],
    ) ? [resposta] : [];
  });
  const referencia = selecionarReferencia(resultadosValidos);
  if (!referencia && respostas.every((resposta) => resposta === null)) {
    throw new Error('Falha ao consultar presets no FPSHQ.');
  }
  if (!referencia) return null;

  return EvidenciaDesempenhoSchema.parse({
    fonte: 'fpshq',
    tipo: referencia.source === 'benchmark' ? 'benchmark' : 'predicao',
    correspondencia: processador ? 'completa' : 'parcial',
    urlAtribuicao: referencia.url,
    consultadoEm: new Date().toISOString(),
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
}

export function criarProvedorEvidenciaFpsHq({
  transporte,
  tempoLimiteMs = TEMPO_LIMITE_PADRAO_MS,
}: ProvedorFpsHqOpcoes): ProvedorEvidencia {
  return {
    nome: 'fpshq',
    async buscar(consulta) {
      const resolucao = mapearResolucao(consulta.resolucao);
      if (!resolucao) return null;

      const controlador = new AbortController();
      let temporizador: ReturnType<typeof setTimeout> | undefined;
      let excedeuTempoLimite = false;
      const tempoEsgotado = new Promise<null>((resolve) => {
        temporizador = setTimeout(() => {
          excedeuTempoLimite = true;
          controlador.abort();
          resolve(null);
        }, tempoLimiteMs);
      });

      try {
        const evidencia = await Promise.race([
          enriquecer(transporte, consulta, resolucao, controlador.signal),
          tempoEsgotado,
        ]);
        if (excedeuTempoLimite) console.warn('[provedorFpsHq] Evidência indisponível.');
        return evidencia;
      } catch {
        console.warn('[provedorFpsHq] Evidência indisponível.');
        return null;
      } finally {
        if (temporizador) clearTimeout(temporizador);
      }
    },
  };
}
