import assert from 'node:assert/strict';
import test from 'node:test';

import type { ConsultaConfiguracoes } from '../consulta-configuracoes';
import { criarConsultaTeste } from '../testes/criar-consulta-teste';
import { criarProvedorEvidenciaFpsHq } from './provedor-fpshq';

const PRESETS = ['low', 'medium', 'high', 'ultra'] as const;
type Preset = (typeof PRESETS)[number];
type TipoBusca = 'game' | 'gpu' | 'cpu';
type EstadoBusca = 'unica' | 'ausente' | 'ambigua';

interface Medicao {
  fpsMinimo: number;
  fpsMedio?: number;
  fpsMaximo?: number;
  corpo?: unknown;
}

interface OpcoesTransporte {
  buscas?: Partial<Record<TipoBusca, EstadoBusca>>;
  origem?: 'benchmark' | 'prediction';
  medicoes?: Partial<Record<Preset, Medicao>>;
  respostaBusca?: (tipo: TipoBusca) => Response | undefined;
}

const consulta = criarConsultaTeste();

function responderJson(corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function criarTransporte(opcoes: OpcoesTransporte = {}) {
  const urls: URL[] = [];
  const sinais: Array<AbortSignal | null | undefined> = [];
  const slugs = { game: 'cyberpunk-2077', gpu: 'rtx-4060', cpu: 'ryzen-5-5600' } as const;
  const nomes = { game: 'Cyberpunk 2077', gpu: 'GeForce RTX 4060', cpu: 'Ryzen 5 5600' } as const;
  const medicoesPadrao: Record<Preset, Medicao> = {
    low: { fpsMinimo: 92 },
    medium: { fpsMinimo: 82 },
    high: { fpsMinimo: 71 },
    ultra: { fpsMinimo: 60 },
  };

  const transporte: typeof fetch = async (entrada, init) => {
    const url = new URL(String(entrada));
    urls.push(url);
    sinais.push(init?.signal);

    if (url.pathname.endsWith('/search')) {
      const tipo = url.searchParams.get('type') as TipoBusca;
      const respostaEspecial = opcoes.respostaBusca?.(tipo);
      if (respostaEspecial) return respostaEspecial;

      const estado = opcoes.buscas?.[tipo] ?? 'unica';
      const resultados = estado === 'ausente'
        ? []
        : estado === 'ambigua'
          ? [
              { type: tipo, slug: `${slugs[tipo]}-a`, name: nomes[tipo] },
              { type: tipo, slug: `${slugs[tipo]}-b`, name: nomes[tipo] },
            ]
          : [{ type: tipo, slug: slugs[tipo], name: nomes[tipo] }];

      return responderJson({ ok: true, results: resultados });
    }

    assert.equal(url.pathname, '/api/v1/fps');
    const preset = url.searchParams.get('preset') as Preset;
    const medicao = opcoes.medicoes?.[preset] ?? medicoesPadrao[preset];
    if (medicao.corpo !== undefined) return responderJson(medicao.corpo);

    const cpuResolvida = (opcoes.buscas?.cpu ?? 'unica') === 'unica';
    return responderJson({
      ok: true,
      game: { slug: slugs.game, name: nomes.game },
      gpu: { slug: slugs.gpu, name: nomes.gpu },
      cpu: cpuResolvida ? { slug: slugs.cpu, name: nomes.cpu } : null,
      resolution: url.searchParams.get('res'),
      preset,
      fps: medicao.fpsMedio ?? medicao.fpsMinimo + 8,
      fps_min: medicao.fpsMinimo,
      fps_max: medicao.fpsMaximo ?? medicao.fpsMinimo + 16,
      source: opcoes.origem ?? 'benchmark',
      url: 'https://fpshq.com/games/cyberpunk-2077/',
    });
  };

  return { transporte, urls, sinais };
}

async function buscarEvidencia(
  opcoes: OpcoesTransporte = {},
  consultaRecebida: ConsultaConfiguracoes = consulta,
) {
  const falso = criarTransporte(opcoes);
  const evidencia = await criarProvedorEvidenciaFpsHq({
    transporte: falso.transporte,
  }).buscar(consultaRecebida);
  return { ...falso, evidencia };
}

test('corresponde jogo, GPU e CPU por nome equivalente sem exigir o fabricante', async () => {
  const { evidencia, urls } = await buscarEvidencia();
  assert.ok(evidencia);
  const { consultadoEm, ...dadosEvidencia } = evidencia;

  assert.equal(urls.filter((url) => url.pathname.endsWith('/search')).length, 3);
  assert.equal(urls.filter((url) => url.pathname.endsWith('/fps')).length, 4);
  assert.match(consultadoEm, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.deepEqual(dadosEvidencia, {
    fonte: 'fpshq',
    tipo: 'benchmark',
    correspondencia: 'completa',
    urlAtribuicao: 'https://fpshq.com/games/cyberpunk-2077/',
    jogo: { slug: 'cyberpunk-2077', nome: 'Cyberpunk 2077' },
    placaVideo: { slug: 'rtx-4060', nome: 'GeForce RTX 4060' },
    processador: { slug: 'ryzen-5-5600', nome: 'Ryzen 5 5600' },
    resolucao: '1080p',
    presetReferencia: 'ultra',
    fpsMedio: 68,
    fpsMinimo: 60,
    fpsMaximo: 76,
  });
});

test('o fabricante sai do termo de hardware e o título do jogo vai íntegro', async () => {
  // Título sintético: nenhum jogo do catálogo começa por fabricante, mas cortar a
  // primeira palavra de um título é buscar outro jogo — a regra vale só no hardware.
  const { urls } = await buscarEvidencia(
    {},
    criarConsultaTeste({ jogo: 'Intel Extreme Racing' }),
  );

  assert.deepEqual(
    urls.filter((url) => url.pathname.endsWith('/search'))
      .map((url) => [url.searchParams.get('type'), url.searchParams.get('q')]),
    [
      ['game', 'Intel Extreme Racing'],
      ['gpu', 'GeForce RTX 4060'],
      ['cpu', 'Ryzen 5 5600'],
    ],
  );
});

test('sufixo depois de separador não afrouxa a correspondência de hardware', async () => {
  // As regras de título expandido valem só para jogo. Numa GPU, o sufixo é
  // fabricante de placa ou variante de encapsulamento — outro item, não outra
  // edição do mesmo.
  const { evidencia, urls } = await buscarEvidencia(
    {
      respostaBusca: (tipo) => tipo === 'gpu'
        ? responderJson({
            ok: true,
            results: [
              { type: 'gpu', slug: 'rtx-4060-fe', name: 'GeForce RTX 4060: Founders Edition' },
            ],
          })
        : undefined,
    },
    // Sem o fabricante no termo informado: com ele, o `startsWith` falharia
    // sozinho e o teste passaria mesmo sem o recorte por tipo.
    criarConsultaTeste({ placaVideo: 'GeForce RTX 4060' }),
  );

  assert.equal(evidencia, null);
  assert.equal(urls.filter((url) => url.pathname.endsWith('/fps')).length, 0);
});

for (const [informado, nomeCatalogo, casa] of [
  ['Cyberpunk 2077', 'Cyberpunk 2077: Phantom Liberty', true],
  ['Cyberpunk 2077', 'Cyberpunk 2077 - Phantom Liberty', true],
  ['Cyberpunk 2077', 'Cyberpunk 2077 – Phantom Liberty', true],
  ['Cyberpunk 2077', 'Cyberpunk 2077 — Phantom Liberty', true],
  // O separador precisa de espaço depois. Colado, ele faz parte do título de
  // outro jogo: "Counter-Strike 2" não é uma edição de "Counter".
  ['Counter', 'Counter-Strike 2', false],
  // Espaço sozinho não separa edição de sequência.
  ['God of War', 'God of War Ragnarok', false],
  ['Elden Ring', 'Elden Ring Nightreign', false],
] as const) {
  test(`"${informado}" ${casa ? 'casa' : 'não casa'} com "${nomeCatalogo}"`, async () => {
    const { urls } = await buscarEvidencia(
      {
        respostaBusca: (tipo) => tipo === 'game'
          ? responderJson({
              ok: true,
              // Slug que não corresponde ao termo informado: só a regra do
              // título expandido pode resolver este caso.
              results: [{ type: 'game', slug: 'jogo-do-catalogo', name: nomeCatalogo }],
            })
          : undefined,
      },
      criarConsultaTeste({ jogo: informado }),
    );

    assert.equal(urls.filter((url) => url.pathname.endsWith('/fps')).length, casa ? 4 : 0);
  });
}

/**
 * A regra do slug isolada. Os slugs da coluna do meio são os que a API devolveu
 * em 2026-09-07; o `name` é de propósito diferente do termo informado, para que
 * nem a igualdade nem o título expandido alcancem o candidato e só a regra do
 * slug possa decidir. O pareamento é a bancada, não um cenário de campo: contra
 * a API real nenhum destes títulos chega até aqui, porque o `name` do catálogo é
 * igual ao que o jogador digitou e a igualdade resolve antes.
 */
for (const [informado, slugCatalogo, casa] of [
  // Apóstrofo descartado — a forma que `paraSlug` não produzia.
  ["Baldur's Gate 3", 'baldurs-gate-3', true],
  ["No Man's Sky", 'no-mans-sky', true],
  ["Sid Meier's Civilization VI", 'sid-meiers-civilization-vi', true],
  // Apóstrofo virando traço — a forma que já funcionava, e continua.
  ["Tom Clancy's Splinter Cell", 'tom-clancy-s-splinter-cell', true],
  ["Baldur's Gate: Dark Alliance", 'baldur-s-gate-dark-alliance', true],
  // Sem apóstrofo no termo há uma forma só, e ela não alcança a outra: não dá
  // para adivinhar onde o apóstrofo estava.
  ['Baldurs Gate 3', 'baldur-s-gate-3', false],
  ['Tom Clancys Splinter Cell', 'tom-clancy-s-splinter-cell', false],
] as const) {
  test(`"${informado}" ${casa ? 'casa' : 'não casa'} com o slug "${slugCatalogo}"`, async () => {
    const { urls } = await buscarEvidencia(
      {
        respostaBusca: (tipo) => tipo === 'game'
          ? responderJson({
              ok: true,
              // `name` que não bate por igualdade nem por sufixo de edição: só a
              // regra do slug pode resolver este caso.
              results: [{ type: 'game', slug: slugCatalogo, name: 'Outro título qualquer' }],
            })
          : undefined,
      },
      criarConsultaTeste({ jogo: informado }),
    );

    assert.equal(urls.filter((url) => url.pathname.endsWith('/fps')).length, casa ? 4 : 0);
  });
}

for (const [resolucaoInformada, resolucaoFpsHq] of [
  ['1920x1080 (Full HD)', '1080p'],
  ['2560x1440 (2K)', '1440p'],
  ['3840x2160 (4K)', '4K'],
] as const) {
  test(`mapeia ${resolucaoInformada} para ${resolucaoFpsHq}`, async () => {
    const { evidencia, urls } = await buscarEvidencia(
      {},
      criarConsultaTeste({ resolucao: resolucaoInformada }),
    );

    assert.equal(evidencia?.resolucao, resolucaoFpsHq);
    assert.ok(
      urls.filter((url) => url.pathname.endsWith('/fps'))
        .every((url) => url.searchParams.get('res') === resolucaoFpsHq),
    );
  });
}

test('resolução não suportada devolve ausência sem chamar o transporte', async () => {
  let chamadas = 0;
  const evidencia = await criarProvedorEvidenciaFpsHq({
    transporte: async () => {
      chamadas += 1;
      throw new Error('O transporte não deveria ser chamado.');
    },
  }).buscar(criarConsultaTeste({ resolucao: '1280x720 (HD)' }));

  assert.equal(evidencia, null);
  assert.equal(chamadas, 0);
});

for (const estadoCpu of ['ausente', 'ambigua'] as const) {
  test(`CPU ${estadoCpu === 'ausente' ? 'ausente' : 'ambígua'} produz evidência parcial`, async () => {
    const { evidencia, urls } = await buscarEvidencia({ buscas: { cpu: estadoCpu } });
    const urlsFps = urls.filter((url) => url.pathname.endsWith('/fps'));

    assert.equal(urlsFps.length, 4);
    assert.ok(urlsFps.every((url) => !url.searchParams.has('cpu')));
    assert.equal(evidencia?.correspondencia, 'parcial');
    assert.equal(evidencia?.processador, null);
  });
}

for (const tipo of ['game', 'gpu'] as const) {
  for (const estado of ['ausente', 'ambigua'] as const) {
    test(`${tipo === 'game' ? 'jogo' : 'GPU'} ${estado === 'ausente' ? 'ausente' : 'ambígua'} impede a consulta de presets`, async () => {
      const { evidencia, urls } = await buscarEvidencia({ buscas: { [tipo]: estado } });

      assert.equal(evidencia, null);
      assert.equal(urls.filter((url) => url.pathname.endsWith('/fps')).length, 0);
    });
  }
}

const cenariosPreset: Array<{
  esperado: Preset;
  minimos: Record<Preset, number>;
}> = [
  { esperado: 'ultra', minimos: { low: 92, medium: 82, high: 71, ultra: 60 } },
  { esperado: 'high', minimos: { low: 88, medium: 74, high: 60, ultra: 58 } },
  { esperado: 'medium', minimos: { low: 76, medium: 60, high: 57, ultra: 49 } },
  { esperado: 'low', minimos: { low: 60, medium: 58, high: 51, ultra: 43 } },
];

for (const { esperado, minimos } of cenariosPreset) {
  test(`seleciona ${esperado} como maior preset cujo mínimo atinge 60 FPS`, async () => {
    const medicoes = Object.fromEntries(
      PRESETS.map((preset) => [preset, { fpsMinimo: minimos[preset] }]),
    ) as Record<Preset, Medicao>;
    const { evidencia, urls } = await buscarEvidencia({ medicoes });

    assert.deepEqual(
      urls.filter((url) => url.pathname.endsWith('/fps')).map((url) => url.searchParams.get('preset')).sort(),
      [...PRESETS].sort(),
    );
    assert.equal(evidencia?.presetReferencia, esperado);
    assert.equal(evidencia?.fpsMinimo, minimos[esperado]);
  });
}

test('sem preset na meta escolhe o resultado válido de melhor desempenho', async () => {
  const { evidencia } = await buscarEvidencia({
    medicoes: {
      low: { fpsMinimo: 58, fpsMedio: 66, fpsMaximo: 74 },
      medium: { fpsMinimo: 52 },
      high: { fpsMinimo: 45 },
      ultra: { fpsMinimo: 39 },
    },
  });

  assert.equal(evidencia?.presetReferencia, 'low');
  assert.equal(evidencia?.fpsMinimo, 58);
  assert.equal(evidencia?.fpsMedio, 66);
  assert.equal(evidencia?.fpsMaximo, 74);
});

test('descarta uma resposta de preset fora do schema sem contaminar as válidas', async () => {
  const avisoOriginal = console.warn;
  console.warn = () => undefined;
  try {
    const { evidencia } = await buscarEvidencia({
      medicoes: {
        low: { fpsMinimo: 83 },
        medium: { fpsMinimo: 72, corpo: { ok: true, fps_min: 'inválido' } },
        high: { fpsMinimo: 61 },
        ultra: { fpsMinimo: 55 },
      },
    });

    assert.equal(evidencia?.presetReferencia, 'high');
  } finally {
    console.warn = avisoOriginal;
  }
});

for (const origem of ['benchmark', 'prediction'] as const) {
  test(`preserva origem ${origem} e a atribuição do FPSHQ`, async () => {
    const { evidencia } = await buscarEvidencia({ origem });

    assert.equal(evidencia?.tipo, origem === 'benchmark' ? 'benchmark' : 'predicao');
    assert.equal(evidencia?.urlAtribuicao, 'https://fpshq.com/games/cyberpunk-2077/');
  });
}

for (const respostaInvalida of [
  () => new Response('{não-json', { status: 200 }),
  () => responderJson({ ok: true, results: 'inválido' }),
  () => new Response('', { status: 503 }),
]) {
  test('resposta de busca inválida produz ausência de evidência', async () => {
    const avisoOriginal = console.warn;
    console.warn = () => undefined;
    try {
      const { evidencia, urls } = await buscarEvidencia({
        respostaBusca: (tipo) => tipo === 'game' ? respostaInvalida() : undefined,
      });

      assert.equal(evidencia, null);
      assert.equal(urls.filter((url) => url.pathname.endsWith('/fps')).length, 0);
    } finally {
      console.warn = avisoOriginal;
    }
  });
}

test('timeout aborta o transporte pendente e devolve ausência de evidência', { timeout: 1_000 }, async () => {
  const sinais: Array<AbortSignal | null | undefined> = [];
  const avisoOriginal = console.warn;
  console.warn = () => undefined;
  try {
    const evidencia = await criarProvedorEvidenciaFpsHq({
      tempoLimiteMs: 10,
      transporte: async (_entrada, init) => {
        sinais.push(init?.signal);
        return new Promise<Response>(() => undefined);
      },
    }).buscar(consulta);

    assert.equal(evidencia, null);
    assert.equal(sinais.length, 3);
    assert.ok(sinais.every((sinal) => sinal?.aborted));
  } finally {
    console.warn = avisoOriginal;
  }
});
