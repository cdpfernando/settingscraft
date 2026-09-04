import assert from 'node:assert/strict';
import test from 'node:test';

import type { ArmazenamentoChaveValor } from '../armazenamento';
import {
  criarFonteCacheCompartilhado,
  publicarNoCacheCompartilhado,
} from './cache-compartilhado';
import {
  criarChaveCache,
  criarFonteCacheLocal,
  criarRepositorioCacheLocal,
} from './cache-local';
import type { Consulta } from './fonte';
import { resolverConsulta } from './resolvedor';
import {
  CONTRATO_VERSAO,
  ResultadoSchema,
  type EvidenciaDesempenho,
  type GeradoPor,
  type Resultado,
} from './schema';

const consulta: Consulta = {
  jogo: 'Alan Wake 2',
  placaVideo: 'NVIDIA GeForce RTX 4070 Super',
  processador: 'AMD Ryzen 7 7800X3D',
  memoria: '32 GB',
  resolucao: '2560x1440 (2K)',
};

const evidenciaBenchmark: EvidenciaDesempenho = {
  fonte: 'fpshq',
  tipo: 'benchmark',
  correspondencia: 'completa',
  urlAtribuicao: 'https://fpshq.com/games/alan-wake-2/',
  consultadoEm: '2026-09-04T10:00:00.000Z',
  jogo: { slug: 'alan-wake-2', nome: 'Alan Wake 2' },
  placaVideo: { slug: 'rtx-4070-super', nome: 'GeForce RTX 4070 Super' },
  processador: { slug: 'ryzen-7-7800x3d', nome: 'Ryzen 7 7800X3D' },
  resolucao: '1440p',
  presetReferencia: 'ultra',
  fpsMedio: 72,
  fpsMinimo: 61,
  fpsMaximo: 84,
};

const evidenciaPredicao: EvidenciaDesempenho = {
  fonte: 'fpshq',
  tipo: 'predicao',
  correspondencia: 'parcial',
  urlAtribuicao: 'https://fpshq.com/games/alan-wake-2/',
  consultadoEm: '2026-09-04T10:01:00.000Z',
  jogo: { slug: 'alan-wake-2', nome: 'Alan Wake 2' },
  placaVideo: { slug: 'rtx-4070-super', nome: 'GeForce RTX 4070 Super' },
  processador: null,
  resolucao: '1440p',
  presetReferencia: 'high',
  fpsMedio: 68,
  fpsMinimo: 57,
  fpsMaximo: 79,
};

function criarResultado(
  geradoPor: GeradoPor,
  confiancaFps: 'media' | 'baixa',
  evidenciaDesempenho: EvidenciaDesempenho | null,
): Resultado {
  return {
    configuracoes: [{
      nome: 'Qualidade geral',
      valor: evidenciaDesempenho?.presetReferencia ?? 'Alto',
      justificativa: evidenciaDesempenho
        ? 'Ajustado a partir da evidência recebida.'
        : 'Estimativa produzida somente pela IA.',
    }],
    fpsEstimado: evidenciaDesempenho ? '61 a 72 FPS' : '55 a 70 FPS',
    fonte: geradoPor,
    geradoPor,
    confiancaFps,
    evidenciaDesempenho,
    geradoEm: '2026-09-04T10:02:00.000Z',
    versaoContrato: CONTRATO_VERSAO,
  };
}

const cenarios = [
  {
    nome: 'benchmark completo',
    resultado: criarResultado('gemini', 'media', evidenciaBenchmark),
  },
  {
    nome: 'predição parcial',
    resultado: criarResultado('groq', 'baixa', evidenciaPredicao),
  },
  {
    nome: 'resultado somente IA',
    resultado: criarResultado('exemplo', 'baixa', null),
  },
] as const;

class ArmazenamentoMemoria implements ArmazenamentoChaveValor {
  readonly dados = new Map<string, string>();
  readonly removidas: string[] = [];

  async getItem(chave: string): Promise<string | null> {
    return this.dados.get(chave) ?? null;
  }

  async setItem(chave: string, valor: string): Promise<void> {
    this.dados.set(chave, valor);
  }

  async removeItem(chave: string): Promise<void> {
    this.removidas.push(chave);
    this.dados.delete(chave);
  }

  async getAllKeys(): Promise<readonly string[]> {
    return [...this.dados.keys()];
  }

  async multiGet(chaves: readonly string[]): Promise<readonly (readonly [string, string | null])[]> {
    return chaves.map((chave) => [chave, this.dados.get(chave) ?? null] as const);
  }
}

test('ResultadoSchema exige metadados finais e rejeita contrato anterior', () => {
  assert.equal(CONTRATO_VERSAO, 2);
  for (const cenario of cenarios) {
    assert.equal(ResultadoSchema.safeParse(cenario.resultado).success, true, cenario.nome);
  }

  const atual = cenarios[0].resultado;
  for (const campo of ['geradoPor', 'confiancaFps', 'evidenciaDesempenho'] as const) {
    const incompleto: Record<string, unknown> = { ...atual };
    delete incompleto[campo];
    assert.equal(
      ResultadoSchema.safeParse(incompleto).success,
      false,
      `o campo ${campo} não pode ser omitido`,
    );
  }

  assert.equal(ResultadoSchema.safeParse({
    configuracoes: atual.configuracoes,
    fpsEstimado: atual.fpsEstimado,
    fonte: atual.fonte,
    geradoEm: atual.geradoEm,
    versaoContrato: 1,
  }).success, false);

  for (const invalido of [
    { ...atual, fonte: 'fpshq' },
    { ...atual, geradoPor: 'cache-local' },
    { ...atual, confiancaFps: 'alta' },
    {
      ...atual,
      evidenciaDesempenho: {
        ...evidenciaBenchmark,
        urlAtribuicao: 'https://example.com/sem-atribuicao',
      },
    },
  ]) {
    assert.equal(ResultadoSchema.safeParse(invalido).success, false);
  }
});

test('ResultadoSchema rejeita combinações incoerentes de procedência e confiança', () => {
  const benchmarkCompleto = cenarios[0].resultado;
  const somenteIa = cenarios[2].resultado;

  const predicaoCompleta = {
    ...evidenciaBenchmark,
    tipo: 'predicao' as const,
  };
  const benchmarkParcial = {
    ...evidenciaBenchmark,
    correspondencia: 'parcial' as const,
    processador: null,
  };

  for (const [nome, resultadoInvalido] of [
    ['confiança média sem evidência', { ...somenteIa, confiancaFps: 'media' }],
    [
      'confiança média com predição',
      { ...benchmarkCompleto, confiancaFps: 'media', evidenciaDesempenho: predicaoCompleta },
    ],
    [
      'confiança média com correspondência parcial',
      { ...benchmarkCompleto, confiancaFps: 'media', evidenciaDesempenho: benchmarkParcial },
    ],
    [
      'correspondência completa sem CPU',
      {
        ...benchmarkCompleto,
        confiancaFps: 'baixa',
        evidenciaDesempenho: { ...evidenciaBenchmark, processador: null },
      },
    ],
    [
      'correspondência parcial com CPU',
      {
        ...benchmarkCompleto,
        confiancaFps: 'baixa',
        evidenciaDesempenho: { ...evidenciaBenchmark, correspondencia: 'parcial' },
      },
    ],
  ] as const) {
    assert.equal(
      ResultadoSchema.safeParse(resultadoInvalido).success,
      false,
      nome,
    );
  }
});

for (const cenario of cenarios) {
  test(`cache local preserva ${cenario.nome} e separa fonte de entrega do gerador`, async () => {
    const armazenamento = new ArmazenamentoMemoria();
    const repositorio = criarRepositorioCacheLocal(armazenamento);
    await repositorio.salvar(consulta, cenario.resultado);

    const resposta = await resolverConsulta(consulta, {
      caches: [criarFonteCacheLocal(repositorio)],
      geradores: [{
        nome: 'não-deve-rodar',
        async gerar() {
          assert.fail('O gerador não deve rodar depois do cache hit local.');
        },
      }],
    });

    assert.equal(resposta.ok, true);
    if (!resposta.ok) return;
    assert.deepEqual(resposta.resultado, { ...cenario.resultado, fonte: 'salvo' });
    assert.equal(resposta.resultado.geradoPor, cenario.resultado.geradoPor);
    assert.equal(resposta.resultado.confiancaFps, cenario.resultado.confiancaFps);
    assert.deepEqual(resposta.resultado.evidenciaDesempenho, cenario.resultado.evidenciaDesempenho);

    const historico = await repositorio.listar();
    assert.deepEqual(historico, [{
      consulta,
      resultado: { ...cenario.resultado, fonte: 'salvo' },
    }]);
    assert.equal(historico[0].resultado.geradoPor, cenario.resultado.geradoPor);
    assert.deepEqual(
      historico[0].resultado.evidenciaDesempenho,
      cenario.resultado.evidenciaDesempenho,
    );
  });
}

test('cache local ignora mas não apaga registro da versão anterior', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const chaveAntiga = criarChaveCache(consulta, 1);
  const registroAntigo = JSON.stringify({
    consulta,
    resultado: {
      configuracoes: [],
      fpsEstimado: '60 FPS',
      fonte: 'gemini',
      geradoEm: '2026-09-01T10:00:00.000Z',
      versaoContrato: 1,
    },
  });
  armazenamento.dados.set(chaveAntiga, registroAntigo);

  const repositorio = criarRepositorioCacheLocal(armazenamento);
  assert.equal(await repositorio.buscar(consulta), null);
  assert.deepEqual(await repositorio.listar(), []);
  assert.equal(armazenamento.dados.get(chaveAntiga), registroAntigo);
  assert.deepEqual(armazenamento.removidas, []);
  assert.notEqual(criarChaveCache(consulta), chaveAntiga);
});

for (const cenario of cenarios) {
  test(`cache compartilhado publica e relê ${cenario.nome} sem perder procedência`, async () => {
    let publicado: Record<string, unknown> | undefined;
    let urlLeitura: URL | undefined;
    const transporte: typeof fetch = async (entrada, init) => {
      const url = new URL(String(entrada));
      if (init?.method === 'POST') {
        publicado = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ gravado: true, chave: 'v2:fixture' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      urlLeitura = url;
      assert.ok(publicado, 'a leitura deve acontecer depois da publicação');
      const {
        jogo: _jogo,
        placaVideo: _placaVideo,
        processador: _processador,
        memoria: _memoria,
        resolucao: _resolucao,
        ...resultadoPublicado
      } = publicado;
      return new Response(JSON.stringify(resultadoPublicado), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const opcoes = { baseUrl: 'https://cache.settingscraft.test', transporte, token: 'teste' };

    await publicarNoCacheCompartilhado(opcoes, consulta, cenario.resultado, false);

    assert.ok(publicado);
    assert.equal(publicado.versaoContrato, 2);
    assert.equal(publicado.fonte, cenario.resultado.fonte);
    assert.equal(publicado.geradoPor, cenario.resultado.geradoPor);
    assert.equal(publicado.confiancaFps, cenario.resultado.confiancaFps);
    assert.deepEqual(publicado.evidenciaDesempenho, cenario.resultado.evidenciaDesempenho);
    assert.equal('gerado_por' in publicado, false);
    assert.equal('confianca_fps' in publicado, false);
    assert.equal('evidencia_desempenho' in publicado, false);

    const resposta = await resolverConsulta(consulta, {
      caches: [criarFonteCacheCompartilhado(opcoes)],
      geradores: [{
        nome: 'não-deve-rodar',
        async gerar() {
          assert.fail('O gerador não deve rodar depois do cache hit compartilhado.');
        },
      }],
    });

    assert.equal(urlLeitura?.searchParams.get('versaoContrato'), '2');
    assert.equal(resposta.ok, true);
    if (!resposta.ok) return;
    assert.deepEqual(resposta.resultado, { ...cenario.resultado, fonte: 'compartilhado' });
    assert.equal(resposta.resultado.geradoPor, cenario.resultado.geradoPor);
    assert.deepEqual(resposta.resultado.evidenciaDesempenho, cenario.resultado.evidenciaDesempenho);
  });
}
