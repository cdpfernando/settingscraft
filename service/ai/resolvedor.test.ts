import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  Consulta,
  Fonte,
  Gerador,
  ProvedorEvidencia,
} from './fonte';
import { ErroFonteLimite } from './fonte';
import { criarFonteGemini } from './fonte-gemini';
import { criarProvedorEvidenciaFpsHq } from './provedor-fpshq';
import { criarPrompt } from './prompt';
import { resolverConsulta } from './resolvedor';
import {
  CONTRATO_VERSAO,
  criarResultadoGerado,
  type EvidenciaDesempenho,
  type FonteEntrega,
  type GeradoPor,
  type Resultado,
} from './schema';

const consulta: Consulta = {
  jogo: 'Cyberpunk 2077',
  placaVideo: 'RTX 4060',
  processador: 'Ryzen 5 5600',
  memoria: '16 GB',
  resolucao: 'Full HD',
};

function resultado(fonte: FonteEntrega): Resultado {
  const geradoPor: GeradoPor = fonte === 'groq' || fonte === 'exemplo' ? fonte : 'gemini';
  return {
    configuracoes: [],
    fpsEstimado: '60 FPS',
    fonte,
    geradoPor,
    confiancaFps: 'baixa',
    evidenciaDesempenho: null,
    geradoEm: '2026-09-03T12:00:00.000Z',
    versaoContrato: CONTRATO_VERSAO,
  };
}

test('cache local encerra a consulta antes dos demais colaboradores', async () => {
  const chamadas: string[] = [];
  const esperado = resultado('salvo');

  const cacheLocal: Fonte = {
    nome: 'cache-local',
    async buscar(consultaRecebida) {
      chamadas.push('cache-local');
      assert.deepEqual(consultaRecebida, consulta);
      return esperado;
    },
  };
  const cacheCompartilhado: Fonte = {
    nome: 'cache-compartilhado',
    async buscar() {
      chamadas.push('cache-compartilhado');
      return resultado('compartilhado');
    },
  };
  const provedorEvidencia: ProvedorEvidencia<{ fpsMinimo: number }> = {
    nome: 'evidencia-falsa',
    async buscar() {
      chamadas.push('evidencia');
      return { fpsMinimo: 60 };
    },
  };
  const gerador: Gerador<{ fpsMinimo: number }> = {
    nome: 'gerador-falso',
    async gerar() {
      chamadas.push('gerador');
      return resultado('gemini');
    },
  };

  const resposta = await resolverConsulta(consulta, {
    caches: [cacheLocal, cacheCompartilhado],
    provedorEvidencia,
    geradores: [gerador],
  });

  assert.deepEqual(resposta, { ok: true, resultado: esperado });
  assert.deepEqual(chamadas, ['cache-local']);
});

test('cache compartilhado encerra a consulta antes da evidência e da IA', async () => {
  const chamadas: string[] = [];
  const esperado = resultado('compartilhado');

  const resposta = await resolverConsulta(consulta, {
    caches: [
      {
        nome: 'cache-local',
        async buscar() {
          chamadas.push('cache-local');
          return null;
        },
      },
      {
        nome: 'cache-compartilhado',
        async buscar() {
          chamadas.push('cache-compartilhado');
          return esperado;
        },
      },
    ],
    provedorEvidencia: {
      nome: 'evidencia-falsa',
      async buscar() {
        chamadas.push('evidencia');
        return { fpsMinimo: 60 };
      },
    },
    geradores: [
      {
        nome: 'gerador-falso',
        async gerar() {
          chamadas.push('gerador');
          return resultado('gemini');
        },
      },
    ],
  });

  assert.deepEqual(resposta, { ok: true, resultado: esperado });
  assert.deepEqual(chamadas, ['cache-local', 'cache-compartilhado']);
});

test('miss dos caches consulta a evidência uma vez e a entrega ao primeiro gerador', async () => {
  const chamadas: string[] = [];
  const evidencia = { fpsMinimo: 63, preset: 'high' };
  const esperado = resultado('gemini');

  const resposta = await resolverConsulta(consulta, {
    caches: [
      {
        nome: 'cache-local',
        async buscar() {
          chamadas.push('cache-local');
          return null;
        },
      },
      {
        nome: 'cache-compartilhado',
        async buscar() {
          chamadas.push('cache-compartilhado');
          return null;
        },
      },
    ],
    provedorEvidencia: {
      nome: 'evidencia-falsa',
      async buscar(consultaRecebida) {
        chamadas.push('evidencia');
        assert.deepEqual(consultaRecebida, consulta);
        return evidencia;
      },
    },
    geradores: [
      {
        nome: 'gemini',
        async gerar(contexto) {
          chamadas.push('gemini');
          assert.deepEqual(contexto.consulta, consulta);
          assert.strictEqual(contexto.evidencia, evidencia);
          return esperado;
        },
      },
      {
        nome: 'groq',
        async gerar() {
          chamadas.push('groq');
          return resultado('groq');
        },
      },
    ],
  });

  assert.deepEqual(resposta, { ok: true, resultado: esperado });
  assert.deepEqual(chamadas, ['cache-local', 'cache-compartilhado', 'evidencia', 'gemini']);
});

test('fallback entrega a mesma evidência ao segundo gerador sem consultar novamente', async () => {
  const chamadas: string[] = [];
  const evidencia = { fpsMinimo: 58, preset: 'medium' };
  const esperado = resultado('groq');

  const resposta = await resolverConsulta(consulta, {
    caches: [],
    provedorEvidencia: {
      nome: 'evidencia-falsa',
      async buscar() {
        chamadas.push('evidencia');
        return evidencia;
      },
    },
    geradores: [
      {
        nome: 'gemini',
        async gerar(contexto) {
          chamadas.push('gemini');
          assert.strictEqual(contexto.evidencia, evidencia);
          return null;
        },
      },
      {
        nome: 'groq',
        async gerar(contexto) {
          chamadas.push('groq');
          assert.strictEqual(contexto.evidencia, evidencia);
          return esperado;
        },
      },
    ],
  });

  assert.deepEqual(resposta, { ok: true, resultado: esperado });
  assert.deepEqual(chamadas, ['evidencia', 'gemini', 'groq']);
});

for (const cenario of ['sem provedor', 'provedor sem evidência'] as const) {
  test(`${cenario} mantém a geração por IA sem evidência`, async () => {
    const chamadas: string[] = [];
    const esperado = resultado('gemini');
    const provedorEvidencia: ProvedorEvidencia | undefined = cenario === 'sem provedor'
      ? undefined
      : {
          nome: 'evidencia-falsa',
          async buscar() {
            chamadas.push('evidencia');
            return null;
          },
        };

    const resposta = await resolverConsulta(consulta, {
      caches: [],
      provedorEvidencia,
      geradores: [
        {
          nome: 'gemini',
          async gerar(contexto) {
            chamadas.push('gemini');
            assert.deepEqual(contexto, { consulta, evidencia: undefined });
            return esperado;
          },
        },
        {
          nome: 'groq',
          async gerar() {
            chamadas.push('groq');
            return resultado('groq');
          },
        },
      ],
    });

    assert.deepEqual(resposta, { ok: true, resultado: esperado });
    assert.deepEqual(
      chamadas,
      cenario === 'sem provedor' ? ['gemini'] : ['evidencia', 'gemini'],
    );
  });
}

test('benchmark exato do FPSHQ ancora o Gemini e produz metadados confiáveis', async () => {
  const consultaComBenchmark: Consulta = {
    jogo: 'Alan Wake 2',
    placaVideo: 'NVIDIA GeForce RTX 4070 Super',
    processador: 'AMD Ryzen 7 7800X3D',
    memoria: '32 GB',
    resolucao: '2560x1440 (2K)',
  };
  const urlsFpsHq: string[] = [];
  let promptEnviado = '';

  const responderJson = (corpo: unknown): Response => new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  const transporteFpsHq: typeof fetch = async (entrada) => {
    const url = new URL(String(entrada));
    urlsFpsHq.push(url.toString());

    if (url.pathname.endsWith('/search')) {
      const tipo = url.searchParams.get('type');
      const resultados = {
        game: [{ type: 'game', slug: 'alan-wake-2', name: 'Alan Wake 2' }],
        gpu: [{ type: 'gpu', slug: 'rtx-4070-super', name: 'GeForce RTX 4070 Super' }],
        cpu: [{ type: 'cpu', slug: 'ryzen-7-7800x3d', name: 'Ryzen 7 7800X3D' }],
      };

      return responderJson({
        ok: true,
        query: url.searchParams.get('q'),
        count: 1,
        results: resultados[tipo as keyof typeof resultados],
      });
    }

    assert.equal(url.pathname, '/api/v1/fps');
    assert.equal(url.searchParams.get('game'), 'alan-wake-2');
    assert.equal(url.searchParams.get('gpu'), 'rtx-4070-super');
    assert.equal(url.searchParams.get('cpu'), 'ryzen-7-7800x3d');
    assert.equal(url.searchParams.get('res'), '1440p');
    const preset = url.searchParams.get('preset');
    const fpsPorPreset = {
      low: { fps: 96, fps_min: 88, fps_max: 110 },
      medium: { fps: 88, fps_min: 79, fps_max: 100 },
      high: { fps: 79, fps_min: 69, fps_max: 91 },
      ultra: { fps: 72, fps_min: 61, fps_max: 84 },
    };
    assert.ok(preset && preset in fpsPorPreset);
    const fps = fpsPorPreset[preset as keyof typeof fpsPorPreset];

    return responderJson({
      ok: true,
      game: { slug: 'alan-wake-2', name: 'Alan Wake 2' },
      gpu: { slug: 'rtx-4070-super', name: 'GeForce RTX 4070 Super' },
      cpu: { slug: 'ryzen-7-7800x3d', name: 'Ryzen 7 7800X3D' },
      resolution: '1440p',
      preset,
      ...fps,
      verdict: 'good',
      source: 'benchmark',
      url: 'https://fpshq.com/games/alan-wake-2/',
    });
  };

  const transporteGemini: typeof fetch = async (_entrada, init) => {
    const requisicao = JSON.parse(String(init?.body)) as {
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    promptEnviado = requisicao.contents[0].parts[0].text;

    return responderJson({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              configuracoes: [{
                nome: 'Qualidade geral',
                valor: 'Ultra',
                justificativa: 'Benchmark confirma margem para este preset',
              }],
              fpsEstimado: '65 a 78 FPS',
              geradoPor: 'fonte-inventada',
              confiancaFps: 'alta',
              evidenciaDesempenho: { fonte: 'inventada' },
            }),
          }],
        },
      }],
    });
  };

  const resposta = await resolverConsulta(consultaComBenchmark, {
    caches: [],
    provedorEvidencia: criarProvedorEvidenciaFpsHq({
      transporte: transporteFpsHq,
      agora: () => new Date('2026-09-03T12:00:00.000Z'),
    }),
    geradores: [criarFonteGemini({ apiKey: 'teste', transporte: transporteGemini })],
  });

  assert.equal(resposta.ok, true);
  if (!resposta.ok) return;

  assert.equal(urlsFpsHq.filter((url) => url.includes('/search?')).length, 3);
  assert.equal(urlsFpsHq.filter((url) => url.includes('/fps?')).length, 4);
  assert.match(promptEnviado, /Evidência externa validada: FPSHQ/);
  assert.match(promptEnviado, /Preset completo de referência: Ultra/);
  assert.match(promptEnviado, /FPS médio: 72; mínimo: 61; máximo: 84/);
  assert.equal(resposta.resultado.fonte, 'gemini');
  assert.equal(resposta.resultado.geradoPor, 'gemini');
  assert.equal(resposta.resultado.confiancaFps, 'media');
  assert.deepEqual(resposta.resultado.evidenciaDesempenho, {
    fonte: 'fpshq',
    tipo: 'benchmark',
    correspondencia: 'completa',
    urlAtribuicao: 'https://fpshq.com/games/alan-wake-2/',
    consultadoEm: '2026-09-03T12:00:00.000Z',
    jogo: { slug: 'alan-wake-2', nome: 'Alan Wake 2' },
    placaVideo: { slug: 'rtx-4070-super', nome: 'GeForce RTX 4070 Super' },
    processador: { slug: 'ryzen-7-7800x3d', nome: 'Ryzen 7 7800X3D' },
    resolucao: '1440p',
    presetReferencia: 'ultra',
    fpsMedio: 72,
    fpsMinimo: 61,
    fpsMaximo: 84,
  });
  assert.notEqual(resposta.resultado.geradoEm, '2026-09-03T12:00:00.000Z');
});

const PRESETS_TESTE = ['low', 'medium', 'high', 'ultra'] as const;
type PresetTeste = (typeof PRESETS_TESTE)[number];

interface MedicaoTeste {
  fpsMinimo: number;
  fpsMedio?: number;
  fpsMaximo?: number;
  corpo?: unknown;
}

type CenarioPresets = Record<PresetTeste, MedicaoTeste>;

function respostaJson(corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function criarRespostaFps(preset: PresetTeste, medicao: MedicaoTeste): Response {
  if (medicao.corpo !== undefined) return respostaJson(medicao.corpo);

  return respostaJson({
    ok: true,
    game: { slug: 'cyberpunk-2077', name: 'Cyberpunk 2077' },
    gpu: { slug: 'rtx-4060', name: 'RTX 4060' },
    cpu: { slug: 'ryzen-5-5600', name: 'Ryzen 5 5600' },
    resolution: '1080p',
    preset,
    fps: medicao.fpsMedio ?? medicao.fpsMinimo + 8,
    fps_min: medicao.fpsMinimo,
    fps_max: medicao.fpsMaximo ?? medicao.fpsMinimo + 16,
    verdict: 'good',
    source: 'benchmark',
    url: 'https://fpshq.com/games/cyberpunk-2077/',
  });
}

function criarTransportePresets(
  cenario: CenarioPresets,
  aoConsultarPreset?: (preset: PresetTeste, init: RequestInit | undefined) => Promise<Response> | Response,
): typeof fetch {
  return async (entrada, init) => {
    const url = new URL(String(entrada));

    if (url.pathname.endsWith('/search')) {
      const tipo = url.searchParams.get('type');
      const resultados = {
        game: [{ type: 'game', slug: 'cyberpunk-2077', name: 'Cyberpunk 2077' }],
        gpu: [{ type: 'gpu', slug: 'rtx-4060', name: 'RTX 4060' }],
        cpu: [{ type: 'cpu', slug: 'ryzen-5-5600', name: 'Ryzen 5 5600' }],
      };
      return respostaJson({
        ok: true,
        results: resultados[tipo as keyof typeof resultados],
      });
    }

    assert.equal(url.pathname, '/api/v1/fps');
    assert.equal(url.searchParams.get('game'), 'cyberpunk-2077');
    assert.equal(url.searchParams.get('gpu'), 'rtx-4060');
    assert.equal(url.searchParams.get('cpu'), 'ryzen-5-5600');
    assert.equal(url.searchParams.get('res'), '1080p');
    const preset = url.searchParams.get('preset');
    assert.ok(PRESETS_TESTE.includes(preset as PresetTeste));
    const presetTipado = preset as PresetTeste;

    return aoConsultarPreset
      ? aoConsultarPreset(presetTipado, init)
      : criarRespostaFps(presetTipado, cenario[presetTipado]);
  };
}

async function executarCenarioPresets(
  cenario: CenarioPresets,
  opcoes: {
    transporte?: typeof fetch;
    aoGerar?: (evidencia: EvidenciaDesempenho | undefined) => void;
  } = {},
): Promise<EvidenciaDesempenho | undefined> {
  let evidenciaRecebida: EvidenciaDesempenho | undefined;
  const resposta = await resolverConsulta(consulta, {
    caches: [],
    provedorEvidencia: criarProvedorEvidenciaFpsHq({
      transporte: opcoes.transporte ?? criarTransportePresets(cenario),
      agora: () => new Date('2026-09-03T12:00:00.000Z'),
    }),
    geradores: [{
      nome: 'gerador-falso',
      async gerar(contexto) {
        evidenciaRecebida = contexto.evidencia;
        opcoes.aoGerar?.(contexto.evidencia);
        return resultado('gemini');
      },
    }],
  });

  assert.equal(resposta.ok, true);
  return evidenciaRecebida;
}

const cenariosVencedores: Array<{
  nome: string;
  esperado: PresetTeste;
  cenario: CenarioPresets;
}> = [
  {
    nome: 'Ultra',
    esperado: 'ultra',
    cenario: {
      low: { fpsMinimo: 92 },
      medium: { fpsMinimo: 82 },
      high: { fpsMinimo: 71 },
      ultra: { fpsMinimo: 60 },
    },
  },
  {
    nome: 'High',
    esperado: 'high',
    cenario: {
      low: { fpsMinimo: 88 },
      medium: { fpsMinimo: 74 },
      high: { fpsMinimo: 60 },
      ultra: { fpsMinimo: 58 },
    },
  },
  {
    nome: 'Medium',
    esperado: 'medium',
    cenario: {
      low: { fpsMinimo: 76 },
      medium: { fpsMinimo: 60 },
      high: { fpsMinimo: 57 },
      ultra: { fpsMinimo: 49 },
    },
  },
  {
    nome: 'Low',
    esperado: 'low',
    cenario: {
      low: { fpsMinimo: 60 },
      medium: { fpsMinimo: 58 },
      high: { fpsMinimo: 51 },
      ultra: { fpsMinimo: 43 },
    },
  },
];

for (const { nome, esperado, cenario } of cenariosVencedores) {
  test(`seleciona ${nome} como maior preset cujo mínimo atinge 60 FPS`, async () => {
    const evidencia = await executarCenarioPresets(cenario);

    assert.equal(evidencia?.presetReferencia, esperado);
    assert.equal(evidencia?.fpsMinimo, cenario[esperado].fpsMinimo);
  });
}

test('quando nenhum preset atinge 60 FPS usa o melhor desempenho e orienta a IA sem prometer a meta', async () => {
  const cenario: CenarioPresets = {
    low: { fpsMinimo: 58, fpsMedio: 66, fpsMaximo: 74 },
    medium: { fpsMinimo: 52 },
    high: { fpsMinimo: 45 },
    ultra: { fpsMinimo: 39 },
  };

  const evidencia = await executarCenarioPresets(cenario, {
    aoGerar(evidenciaRecebida) {
      const prompt = criarPrompt(consulta, evidenciaRecebida);
      assert.match(prompt, /Nenhum preset consultado atingiu mínimo de 60 FPS/);
      assert.match(prompt, /não prometa 60 FPS/);
      assert.doesNotMatch(prompt, /1% low/i);
    },
  });

  assert.equal(evidencia?.presetReferencia, 'low');
  assert.equal(evidencia?.fpsMinimo, 58);
  assert.equal(evidencia?.fpsMedio, 66);
  assert.equal(evidencia?.fpsMaximo, 74);
});

test('uma resposta de preset inválida é descartada sem contaminar as demais', async () => {
  const cenario: CenarioPresets = {
    low: { fpsMinimo: 83 },
    medium: { fpsMinimo: 72, corpo: { ok: true, fps_min: 'inválido' } },
    high: { fpsMinimo: 61 },
    ultra: { fpsMinimo: 55 },
  };

  const evidencia = await executarCenarioPresets(cenario);

  assert.equal(evidencia?.presetReferencia, 'high');
  assert.equal(evidencia?.fpsMinimo, 61);
});

test('resultados não monotônicos são preservados e registrados para diagnóstico', async () => {
  const cenario: CenarioPresets = {
    low: { fpsMinimo: 95 },
    medium: { fpsMinimo: 78 },
    high: { fpsMinimo: 62 },
    ultra: { fpsMinimo: 80, fpsMedio: 91, fpsMaximo: 103 },
  };
  const avisos: unknown[][] = [];
  const consoleWarnOriginal = console.warn;
  console.warn = (...argumentos: unknown[]) => avisos.push(argumentos);

  try {
    const evidencia = await executarCenarioPresets(cenario);

    assert.equal(evidencia?.presetReferencia, 'ultra');
    assert.equal(evidencia?.fpsMinimo, 80);
    assert.equal(evidencia?.fpsMedio, 91);
    assert.equal(evidencia?.fpsMaximo, 103);
    assert.equal(avisos.length, 1);
    assert.match(
      String(avisos[0][0]),
      /\[provedorFpsHq\] estagio=presets status=200 categoria=ordem-nao-monotonica/,
    );
  } finally {
    console.warn = consoleWarnOriginal;
  }
});

test('as quatro consultas de preset começam em paralelo com o mesmo sinal de cancelamento', {
  timeout: 1_000,
}, async () => {
  const cenario = cenariosVencedores[0].cenario;
  const iniciados: PresetTeste[] = [];
  const sinais: Array<AbortSignal | null | undefined> = [];
  const pendentes: Array<() => void> = [];
  const transporte = criarTransportePresets(cenario, (preset, init) => new Promise((resolve) => {
    iniciados.push(preset);
    sinais.push(init?.signal);
    pendentes.push(() => resolve(criarRespostaFps(preset, cenario[preset])));

    if (iniciados.length === PRESETS_TESTE.length) {
      for (const concluir of pendentes) concluir();
    }
  }));

  const evidencia = await executarCenarioPresets(cenario, { transporte });

  assert.deepEqual([...iniciados].sort(), [...PRESETS_TESTE].sort());
  assert.equal(new Set(sinais).size, 1);
  assert.ok(sinais[0] instanceof AbortSignal);
  assert.equal(sinais[0]?.aborted, false);
  assert.equal(evidencia?.presetReferencia, 'ultra');
});

type TipoBuscaTeste = 'game' | 'gpu' | 'cpu';
type EstadoBuscaTeste = 'unica' | 'ausente' | 'ambigua';
type OrigemFpsHqTeste = 'benchmark' | 'prediction';

interface OpcoesTransporteFpsHq {
  origem?: OrigemFpsHqTeste;
  buscas?: Partial<Record<TipoBuscaTeste, EstadoBuscaTeste>>;
  cacheControl?: (etapa: string) => string | undefined;
  aoChamar?: (url: URL, init: RequestInit | undefined) => void;
}

function respostaJsonComCache(corpo: unknown, cacheControl?: string): Response {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...(cacheControl ? { 'Cache-Control': cacheControl } : {}),
    },
  });
}

function criarConsultaTeste(sufixo: string, resolucao = 'Full HD'): Consulta {
  return {
    jogo: `Jogo ${sufixo}`,
    placaVideo: `GPU ${sufixo}`,
    processador: `CPU ${sufixo}`,
    memoria: '32 GB',
    resolucao,
  };
}

function criarTransporteFpsHqConfiguravel(
  opcoes: OpcoesTransporteFpsHq = {},
): { transporte: typeof fetch; urls: URL[]; sinais: Array<AbortSignal | null | undefined> } {
  const urls: URL[] = [];
  const sinais: Array<AbortSignal | null | undefined> = [];
  const slugs = {
    game: 'jogo-fixture',
    gpu: 'gpu-fixture',
    cpu: 'cpu-fixture',
  } as const;

  const transporte: typeof fetch = async (entrada, init) => {
    const url = new URL(String(entrada));
    urls.push(url);
    sinais.push(init?.signal);
    opcoes.aoChamar?.(url, init);

    if (url.pathname.endsWith('/search')) {
      const tipo = url.searchParams.get('type') as TipoBuscaTeste;
      const nome = url.searchParams.get('q') ?? tipo;
      const estado = opcoes.buscas?.[tipo] ?? 'unica';
      const resultados = estado === 'ausente'
        ? []
        : estado === 'ambigua'
          ? [
              { type: tipo, slug: `${slugs[tipo]}-a`, name: nome },
              { type: tipo, slug: `${slugs[tipo]}-b`, name: nome },
            ]
          : [{ type: tipo, slug: slugs[tipo], name: nome }];

      return respostaJsonComCache(
        { ok: true, results: resultados },
        opcoes.cacheControl?.(`busca-${tipo}`),
      );
    }

    assert.equal(url.pathname, '/api/v1/fps');
    const preset = url.searchParams.get('preset') as PresetTeste;
    const cpuFoiResolvida = (opcoes.buscas?.cpu ?? 'unica') === 'unica';
    assert.equal(url.searchParams.has('cpu'), cpuFoiResolvida);

    const minimos: Record<PresetTeste, number> = {
      low: 91,
      medium: 81,
      high: 71,
      ultra: 61,
    };
    return respostaJsonComCache({
      ok: true,
      game: { slug: slugs.game, name: 'Jogo Fixture' },
      gpu: { slug: slugs.gpu, name: 'GPU Fixture' },
      cpu: cpuFoiResolvida ? { slug: slugs.cpu, name: 'CPU Fixture' } : null,
      resolution: '1080p',
      preset,
      fps: minimos[preset] + 8,
      fps_min: minimos[preset],
      fps_max: minimos[preset] + 16,
      source: opcoes.origem ?? 'benchmark',
      url: 'https://fpshq.com/games/jogo-fixture/',
    }, opcoes.cacheControl?.(`fps-${preset}`));
  };

  return { transporte, urls, sinais };
}

async function resolverComResultadoGerado(
  consultaRecebida: Consulta,
  provedorEvidencia: ProvedorEvidencia<EvidenciaDesempenho>,
): Promise<{ resultado: Resultado; evidencia: EvidenciaDesempenho | undefined }> {
  let evidenciaRecebida: EvidenciaDesempenho | undefined;
  const resposta = await resolverConsulta(consultaRecebida, {
    caches: [],
    provedorEvidencia,
    geradores: [{
      nome: 'gemini',
      async gerar({ evidencia }) {
        evidenciaRecebida = evidencia;
        return criarResultadoGerado({
          configuracoes: [],
          fpsEstimado: '61 a 77 FPS',
        }, 'gemini', evidencia);
      },
    }],
  });

  assert.equal(resposta.ok, true);
  if (!resposta.ok) throw new Error('O gerador falso deveria responder com sucesso.');
  return { resultado: resposta.resultado, evidencia: evidenciaRecebida };
}

for (const origem of ['benchmark', 'prediction'] as const) {
  test(`${origem === 'benchmark' ? 'benchmark' : 'predição'} completa preserva o tipo e calcula a confiança correspondente`, async () => {
    const consultaDoTeste = criarConsultaTeste(`origem-${origem}`);
    const { transporte } = criarTransporteFpsHqConfiguravel({ origem });
    const { resultado: resultadoGerado, evidencia } = await resolverComResultadoGerado(
      consultaDoTeste,
      criarProvedorEvidenciaFpsHq({
        transporte,
        agora: () => new Date('2026-09-04T10:00:00.000Z'),
      }),
    );

    assert.equal(evidencia?.tipo, origem === 'benchmark' ? 'benchmark' : 'predicao');
    assert.equal(evidencia?.correspondencia, 'completa');
    assert.equal(evidencia?.processador?.slug, 'cpu-fixture');
    assert.equal(resultadoGerado.confiancaFps, origem === 'benchmark' ? 'media' : 'baixa');
    assert.strictEqual(resultadoGerado.evidenciaDesempenho, evidencia);

    const prompt = criarPrompt(consultaDoTeste, evidencia);
    if (origem === 'benchmark') {
      assert.match(prompt, /benchmark medido/i);
    } else {
      assert.match(prompt, /Tipo:\s*proje[cç][aã]o/i);
      assert.doesNotMatch(prompt, /Tipo:\s*benchmark medido/i);
    }
  });
}

for (const estadoCpu of ['ausente', 'ambigua'] as const) {
  for (const origem of ['benchmark', 'prediction'] as const) {
    test(`${origem === 'benchmark' ? 'benchmark' : 'predição'} com CPU ${estadoCpu === 'ausente' ? 'ausente' : 'ambígua'} consulta sem CPU e produz evidência parcial de confiança baixa`, async () => {
      const consultaDoTeste = criarConsultaTeste(`cpu-${estadoCpu}-${origem}`);
      const { transporte, urls } = criarTransporteFpsHqConfiguravel({
        origem,
        buscas: { cpu: estadoCpu },
      });
      const { resultado: resultadoGerado, evidencia } = await resolverComResultadoGerado(
        consultaDoTeste,
        criarProvedorEvidenciaFpsHq({
          transporte,
          agora: () => new Date('2026-09-04T10:01:00.000Z'),
        }),
      );

      const urlsFps = urls.filter((url) => url.pathname.endsWith('/fps'));
      assert.equal(urlsFps.length, 4);
      assert.ok(urlsFps.every((url) => !url.searchParams.has('cpu')));
      assert.equal(evidencia?.processador, null);
      assert.equal(evidencia?.correspondencia, 'parcial');
      assert.equal(evidencia?.tipo, origem === 'benchmark' ? 'benchmark' : 'predicao');
      assert.equal(resultadoGerado.confiancaFps, 'baixa');
      assert.match(criarPrompt(consultaDoTeste, evidencia), /correspond[eê]ncia:\s*parcial/i);
    });
  }
}

for (const entidade of ['game', 'gpu'] as const) {
  for (const estado of ['ausente', 'ambigua'] as const) {
    test(`${entidade === 'game' ? 'jogo' : 'GPU'} ${estado === 'ausente' ? 'ausente' : 'ambígua'} não consulta FPS e segue para a IA sem evidência`, async () => {
      const consultaDoTeste = criarConsultaTeste(`${entidade}-${estado}`);
      const { transporte, urls } = criarTransporteFpsHqConfiguravel({
        buscas: { [entidade]: estado },
      });
      const { resultado: resultadoGerado, evidencia } = await resolverComResultadoGerado(
        consultaDoTeste,
        criarProvedorEvidenciaFpsHq({ transporte }),
      );

      assert.equal(urls.filter((url) => url.pathname.endsWith('/search')).length, 3);
      assert.equal(urls.filter((url) => url.pathname.endsWith('/fps')).length, 0);
      assert.equal(evidencia, undefined);
      assert.equal(resultadoGerado.confiancaFps, 'baixa');
      assert.equal(resultadoGerado.evidenciaDesempenho, null);
    });
  }
}

test('sem evidência o prompt não menciona FPSHQ, benchmark, predição ou números externos', () => {
  const prompt = criarPrompt(criarConsultaTeste('somente-ia'));

  assert.doesNotMatch(prompt, /FPSHQ/i);
  assert.doesNotMatch(prompt, /evid[eê]ncia externa/i);
  assert.doesNotMatch(prompt, /benchmark medido/i);
  assert.doesNotMatch(prompt, /predi[cç][aã]o/i);
  assert.doesNotMatch(prompt, /proje[cç][aã]o/i);
  assert.doesNotMatch(prompt, /FPS m[eé]dio|FPS m[ií]nimo|FPS m[aá]ximo/i);
});

test('resolução 720p não chama o FPSHQ e permite fallback de Gemini para Groq sem evidência', async () => {
  const consulta720p = criarConsultaTeste('720p', '1280x720 (HD)');
  let chamadasHttp = 0;
  const geradoresChamados: string[] = [];

  const resposta = await resolverConsulta(consulta720p, {
    caches: [],
    provedorEvidencia: criarProvedorEvidenciaFpsHq({
      transporte: async () => {
        chamadasHttp += 1;
        throw new Error('O transporte não deveria ser chamado para 720p.');
      },
    }),
    geradores: [
      {
        nome: 'gemini',
        async gerar({ evidencia }) {
          geradoresChamados.push('gemini');
          assert.equal(evidencia, undefined);
          return null;
        },
      },
      {
        nome: 'groq',
        async gerar({ evidencia }) {
          geradoresChamados.push('groq');
          return criarResultadoGerado({ configuracoes: [], fpsEstimado: '50 FPS' }, 'groq', evidencia);
        },
      },
    ],
  });

  assert.equal(chamadasHttp, 0);
  assert.deepEqual(geradoresChamados, ['gemini', 'groq']);
  assert.equal(resposta.ok, true);
  if (!resposta.ok) return;
  assert.equal(resposta.resultado.geradoPor, 'groq');
  assert.equal(resposta.resultado.confiancaFps, 'baixa');
  assert.equal(resposta.resultado.evidenciaDesempenho, null);
});

test('buscas e presets compartilham um único sinal e as três buscas começam em paralelo', {
  timeout: 1_000,
}, async () => {
  const consultaDoTeste = criarConsultaTeste('paralelismo-buscas');
  const base = criarTransporteFpsHqConfiguravel();
  const buscasIniciadas: TipoBuscaTeste[] = [];
  const liberarBuscas: Array<() => void> = [];

  const transporte: typeof fetch = async (entrada, init) => {
    const url = new URL(String(entrada));
    if (!url.pathname.endsWith('/search')) return base.transporte(entrada, init);

    const tipo = url.searchParams.get('type') as TipoBuscaTeste;
    buscasIniciadas.push(tipo);
    return new Promise<Response>((resolve) => {
      liberarBuscas.push(() => {
        void base.transporte(entrada, init).then(resolve);
      });
      if (liberarBuscas.length === 3) {
        for (const liberar of liberarBuscas) liberar();
      }
    });
  };

  const evidencia = await criarProvedorEvidenciaFpsHq({ transporte }).buscar(consultaDoTeste);

  assert.deepEqual([...buscasIniciadas].sort(), ['cpu', 'game', 'gpu']);
  assert.equal(base.sinais.length, 7);
  assert.equal(new Set(base.sinais).size, 1);
  assert.ok(base.sinais[0] instanceof AbortSignal);
  assert.equal(base.sinais[0]?.aborted, false);
  assert.equal(evidencia?.presetReferencia, 'ultra');
});

test('orçamento único expira, aborta transporte pendente sem cooperação e segue para a IA sem retry', {
  timeout: 1_000,
}, async () => {
  const consultaDoTeste = criarConsultaTeste('timeout-sem-cooperacao');
  const sinais: Array<AbortSignal | null | undefined> = [];
  const logs: string[] = [];
  const erroOriginal = console.error;
  const avisoOriginal = console.warn;
  console.error = (...argumentos: unknown[]) => logs.push(argumentos.join(' '));
  console.warn = (...argumentos: unknown[]) => logs.push(argumentos.join(' '));

  try {
    const { resultado: resultadoGerado, evidencia } = await resolverComResultadoGerado(
      consultaDoTeste,
      criarProvedorEvidenciaFpsHq({
        tempoLimiteMs: 15,
        transporte: async (_entrada, init) => {
          sinais.push(init?.signal);
          return new Promise<Response>(() => undefined);
        },
      }),
    );

    assert.equal(sinais.length, 3);
    assert.equal(new Set(sinais).size, 1);
    assert.ok(sinais.every((sinal) => sinal?.aborted === true));
    assert.equal(evidencia, undefined);
    assert.equal(resultadoGerado.confiancaFps, 'baixa');
    assert.match(logs.join('\n'), /\[provedorFpsHq\] estagio=orcamento status=sem-resposta categoria=tempo-limite/);
  } finally {
    console.error = erroOriginal;
    console.warn = avisoOriginal;
  }
});

interface CenarioFalhaHttp {
  nome: string;
  resposta(): Promise<Response> | Response;
  categoria: string;
  status: string;
}

const cenariosFalhaHttp: readonly CenarioFalhaHttp[] = [
  {
    nome: 'HTTP 429',
    resposta: () => new Response('', { status: 429 }),
    categoria: 'http-429',
    status: '429',
  },
  {
    nome: 'HTTP 4xx',
    resposta: () => new Response('', { status: 404 }),
    categoria: 'http-4xx',
    status: '404',
  },
  {
    nome: 'HTTP 5xx',
    resposta: () => new Response('', { status: 503 }),
    categoria: 'http-5xx',
    status: '503',
  },
  {
    nome: 'falha de rede',
    resposta: () => { throw new TypeError('segredo-rede Jogo falha-rede'); },
    categoria: 'rede',
    status: 'sem-resposta',
  },
  {
    nome: 'cancelamento',
    resposta: () => {
      const erro = new Error('segredo-cancelamento Jogo cancelamento');
      erro.name = 'AbortError';
      throw erro;
    },
    categoria: 'cancelamento',
    status: 'sem-resposta',
  },
  {
    nome: 'corpo não JSON',
    resposta: () => new Response('{não-json', { status: 200 }),
    categoria: 'json-invalido',
    status: '200',
  },
  {
    nome: 'corpo fora do schema',
    resposta: () => respostaJson({ ok: true, results: 'segredo-schema' }),
    categoria: 'schema-invalido',
    status: '200',
  },
];

for (const cenario of cenariosFalhaHttp) {
  test(`${cenario.nome} vira ausência de evidência, não repete a busca e registra log sanitizado`, async () => {
    const consultaDoTeste = criarConsultaTeste(cenario.nome);
    const base = criarTransporteFpsHqConfiguravel();
    const urls: URL[] = [];
    const logs: string[] = [];
    const erroOriginal = console.error;
    const avisoOriginal = console.warn;
    console.error = (...argumentos: unknown[]) => logs.push(argumentos.join(' '));
    console.warn = (...argumentos: unknown[]) => logs.push(argumentos.join(' '));

    try {
      const transporte: typeof fetch = async (entrada, init) => {
        const url = new URL(String(entrada));
        urls.push(url);
        return url.pathname.endsWith('/search') && url.searchParams.get('type') === 'game'
          ? cenario.resposta()
          : base.transporte(entrada, init);
      };

      const { resultado: resultadoGerado, evidencia } = await resolverComResultadoGerado(
        consultaDoTeste,
        criarProvedorEvidenciaFpsHq({ transporte }),
      );

      assert.equal(evidencia, undefined);
      assert.equal(resultadoGerado.confiancaFps, 'baixa');
      assert.equal(urls.filter((url) => url.searchParams.get('type') === 'game').length, 1);
      assert.equal(urls.filter((url) => url.pathname.endsWith('/fps')).length, 0);

      const registro = logs.join('\n');
      assert.match(
        registro,
        new RegExp(`\\[provedorFpsHq\\] estagio=busca-game status=${cenario.status} categoria=${cenario.categoria}`),
      );
      assert.doesNotMatch(registro, /https?:\/\//);
      assert.doesNotMatch(registro, new RegExp(consultaDoTeste.jogo, 'i'));
      assert.doesNotMatch(registro, /segredo-/i);
    } finally {
      console.error = erroOriginal;
      console.warn = avisoOriginal;
    }
  });
}

for (const cenario of cenariosFalhaHttp) {
  test(`${cenario.nome} somente na busca de CPU encerra o enriquecimento sem consultar FPS`, async () => {
    const consultaDoTeste = criarConsultaTeste(`cpu-${cenario.nome}`);
    const base = criarTransporteFpsHqConfiguravel();
    const urls: URL[] = [];
    const avisoOriginal = console.warn;
    console.warn = () => undefined;

    try {
      const transporte: typeof fetch = async (entrada, init) => {
        const url = new URL(String(entrada));
        urls.push(url);
        return url.pathname.endsWith('/search') && url.searchParams.get('type') === 'cpu'
          ? cenario.resposta()
          : base.transporte(entrada, init);
      };

      const { resultado: resultadoGerado, evidencia } = await resolverComResultadoGerado(
        consultaDoTeste,
        criarProvedorEvidenciaFpsHq({ transporte }),
      );

      assert.equal(urls.filter((url) => url.pathname.endsWith('/search')).length, 3);
      assert.equal(urls.filter((url) => url.pathname.endsWith('/fps')).length, 0);
      assert.equal(evidencia, undefined);
      assert.equal(resultadoGerado.confiancaFps, 'baixa');
      assert.equal(resultadoGerado.evidenciaDesempenho, null);
    } finally {
      console.warn = avisoOriginal;
    }
  });
}

test('falha do FPSHQ não substitui a mensagem de limite produzida pelos geradores', async () => {
  const consultaDoTeste = criarConsultaTeste('mensagem-preservada');
  const { transporte } = criarTransporteFpsHqConfiguravel({ buscas: { game: 'ausente' } });
  const erroOriginal = console.error;
  console.error = () => undefined;

  try {
    const resposta = await resolverConsulta(consultaDoTeste, {
      caches: [],
      provedorEvidencia: criarProvedorEvidenciaFpsHq({ transporte }),
      geradores: [{
        nome: 'gemini',
        async gerar({ evidencia }) {
          assert.equal(evidencia, undefined);
          throw new ErroFonteLimite('gemini');
        },
      }],
    });

    assert.deepEqual(resposta, {
      ok: false,
      erro: 'Limite de requisições atingido. Tente novamente em alguns segundos.',
    });
  } finally {
    console.error = erroOriginal;
  }
});

test('fallback Gemini para Groq reutiliza a mesma evidência válida sem nova consulta ao FPSHQ', async () => {
  const consultaDoTeste = criarConsultaTeste('fallback-com-evidencia');
  const { transporte, urls } = criarTransporteFpsHqConfiguravel();
  let evidenciaGemini: EvidenciaDesempenho | undefined;
  let evidenciaGroq: EvidenciaDesempenho | undefined;

  const resposta = await resolverConsulta(consultaDoTeste, {
    caches: [],
    provedorEvidencia: criarProvedorEvidenciaFpsHq({ transporte }),
    geradores: [
      {
        nome: 'gemini',
        async gerar({ evidencia }) {
          evidenciaGemini = evidencia;
          return null;
        },
      },
      {
        nome: 'groq',
        async gerar({ evidencia }) {
          evidenciaGroq = evidencia;
          return criarResultadoGerado({ configuracoes: [], fpsEstimado: '61 FPS' }, 'groq', evidencia);
        },
      },
    ],
  });

  assert.equal(urls.length, 7);
  assert.ok(evidenciaGemini);
  assert.strictEqual(evidenciaGroq, evidenciaGemini);
  assert.equal(resposta.ok, true);
  if (!resposta.ok) return;
  assert.strictEqual(resposta.resultado.evidenciaDesempenho, evidenciaGemini);
  assert.equal(resposta.resultado.geradoPor, 'groq');
});

test('consultas simultâneas equivalentes são deduplicadas por Consulta normalizada', async () => {
  const consultaDoTeste = criarConsultaTeste('deduplicacao');
  const equivalente: Consulta = {
    jogo: `  ${consultaDoTeste.jogo.toLocaleUpperCase('pt-BR')}  `,
    placaVideo: ` ${consultaDoTeste.placaVideo.toLocaleLowerCase('pt-BR')} `,
    processador: ` ${consultaDoTeste.processador} `,
    memoria: '  32   GB ',
    resolucao: ' full HD ',
  };
  const { transporte, urls } = criarTransporteFpsHqConfiguravel();
  const provedor = criarProvedorEvidenciaFpsHq({ transporte });

  const [primeira, segunda] = await Promise.all([
    provedor.buscar(consultaDoTeste),
    provedor.buscar(equivalente),
  ]);

  assert.equal(urls.length, 7);
  assert.ok(primeira);
  assert.strictEqual(segunda, primeira);
  assert.equal(primeira.correspondencia, 'completa');
});

test('Cache-Control reutiliza evidência completa até o menor max-age e refaz a consulta após expirar', async () => {
  const consultaDoTeste = criarConsultaTeste('cache-http');
  let instante = new Date('2026-09-04T12:00:00.000Z');
  const { transporte, urls } = criarTransporteFpsHqConfiguravel({
    origem: 'prediction',
    cacheControl: (etapa) => etapa === 'fps-ultra'
      ? 'public, max-age=2'
      : 'public, max-age=120',
  });
  const provedor = criarProvedorEvidenciaFpsHq({
    transporte,
    agora: () => instante,
  });

  const primeira = await provedor.buscar(consultaDoTeste);
  instante = new Date('2026-09-04T12:00:01.500Z');
  const reutilizada = await provedor.buscar(consultaDoTeste);

  assert.equal(urls.length, 7);
  assert.ok(primeira);
  assert.strictEqual(reutilizada, primeira);
  assert.deepEqual(reutilizada, {
    ...primeira,
    tipo: 'predicao',
    urlAtribuicao: 'https://fpshq.com/games/jogo-fixture/',
    consultadoEm: '2026-09-04T12:00:00.000Z',
  });

  instante = new Date('2026-09-04T12:00:02.001Z');
  const renovada = await provedor.buscar(consultaDoTeste);

  assert.equal(urls.length, 14);
  assert.ok(renovada);
  assert.notStrictEqual(renovada, primeira);
  assert.equal(renovada.consultadoEm, '2026-09-04T12:00:02.001Z');
  assert.equal(renovada.tipo, 'predicao');
  assert.equal(renovada.urlAtribuicao, primeira.urlAtribuicao);
});

test('sem Cache-Control reutilizável a evidência não é mantida em cache permanente', async () => {
  const consultaDoTeste = criarConsultaTeste('sem-cache-http');
  const { transporte, urls } = criarTransporteFpsHqConfiguravel({
    cacheControl: () => 'no-store',
  });
  const provedor = criarProvedorEvidenciaFpsHq({ transporte });

  const primeira = await provedor.buscar(consultaDoTeste);
  const segunda = await provedor.buscar(consultaDoTeste);

  assert.ok(primeira);
  assert.ok(segunda);
  assert.equal(urls.length, 14);
  assert.notStrictEqual(segunda, primeira);
  assert.equal(segunda.urlAtribuicao, primeira.urlAtribuicao);
});

test('integração usa somente endpoints oficiais sem chave ou segredo no request', async () => {
  const consultaDoTeste = criarConsultaTeste('endpoints-oficiais');
  const { transporte, urls } = criarTransporteFpsHqConfiguravel({
    aoChamar(url, init) {
      assert.equal(url.origin, 'https://fpshq.com');
      assert.ok(['/api/v1/search', '/api/v1/fps'].includes(url.pathname));
      assert.equal(url.searchParams.has('key'), false);
      assert.equal(url.searchParams.has('token'), false);
      const headers = new Headers(init?.headers);
      assert.equal(headers.has('Authorization'), false);
      assert.equal(headers.has('X-Api-Key'), false);
    },
  });

  const evidencia = await criarProvedorEvidenciaFpsHq({ transporte }).buscar(consultaDoTeste);

  assert.ok(evidencia);
  assert.equal(urls.length, 7);
  assert.deepEqual(
    [...new Set(urls.map((url) => url.pathname))].sort(),
    ['/api/v1/fps', '/api/v1/search'],
  );
});
