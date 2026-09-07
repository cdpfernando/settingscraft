import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONTRATO_VERSAO,
  EvidenciaDesempenhoSchema,
  ResultadoSchema,
  type EvidenciaDesempenho,
  type Resultado,
} from './schema';

const evidenciaBenchmark: EvidenciaDesempenho = {
  fonte: 'fpshq',
  tipo: 'benchmark',
  correspondencia: 'completa',
  urlAtribuicao: 'https://fpshq.com/games/alan-wake-2/',
  consultadoEm: '2026-09-05T10:00:00.000Z',
  jogo: { slug: 'alan-wake-2', nome: 'Alan Wake 2' },
  placaVideo: { slug: 'rtx-4070-super', nome: 'GeForce RTX 4070 Super' },
  processador: { slug: 'ryzen-7-7800x3d', nome: 'Ryzen 7 7800X3D' },
  resolucao: '1440p',
  presetReferencia: 'ultra',
  fpsMedio: 72,
  fpsMinimo: 61,
  fpsMaximo: 84,
};

function criarResultado(): Resultado {
  return {
    configuracoes: [{ nome: 'Qualidade geral', valor: 'Ultra', justificativa: 'Mantém a meta.' }],
    fpsEstimado: '61 a 72 FPS',
    fonte: 'gemini',
    geradoPor: 'gemini',
    confiancaFps: 'media',
    evidenciaDesempenho: evidenciaBenchmark,
    geradoEm: '2026-09-05T10:01:00.000Z',
    versaoContrato: CONTRATO_VERSAO,
  };
}

test('ResultadoSchema exige procedência, confiança, evidência e versão atuais', () => {
  const atual = criarResultado();
  assert.equal(ResultadoSchema.safeParse(atual).success, true);

  for (const campo of ['geradoPor', 'confiancaFps', 'evidenciaDesempenho'] as const) {
    const incompleto: Record<string, unknown> = { ...atual };
    delete incompleto[campo];
    assert.equal(ResultadoSchema.safeParse(incompleto).success, false, campo);
  }

  for (const invalido of [
    { ...atual, fonte: 'fpshq' },
    { ...atual, geradoPor: 'armazenamento' },
    { ...atual, confiancaFps: 'alta' },
    { ...atual, versaoContrato: CONTRATO_VERSAO - 1 },
    {
      ...atual,
      evidenciaDesempenho: { ...evidenciaBenchmark, urlAtribuicao: 'https://example.com/benchmark' },
    },
  ]) {
    assert.equal(ResultadoSchema.safeParse(invalido).success, false);
  }
});

test('confiança média exige benchmark com correspondência completa e CPU', () => {
  const atual = criarResultado();
  const parcial = {
    ...evidenciaBenchmark,
    correspondencia: 'parcial' as const,
    processador: null,
  };

  for (const resultadoInvalido of [
    { ...atual, evidenciaDesempenho: null },
    { ...atual, evidenciaDesempenho: { ...evidenciaBenchmark, tipo: 'predicao' as const } },
    { ...atual, evidenciaDesempenho: parcial },
  ]) {
    assert.equal(ResultadoSchema.safeParse(resultadoInvalido).success, false);
  }
});

test('EvidenciaDesempenhoSchema mantém CPU coerente com a correspondência', () => {
  assert.equal(EvidenciaDesempenhoSchema.safeParse(evidenciaBenchmark).success, true);
  assert.equal(EvidenciaDesempenhoSchema.safeParse({
    ...evidenciaBenchmark,
    correspondencia: 'parcial',
    processador: null,
  }).success, true);
  assert.equal(EvidenciaDesempenhoSchema.safeParse({
    ...evidenciaBenchmark,
    processador: null,
  }).success, false);
  assert.equal(EvidenciaDesempenhoSchema.safeParse({
    ...evidenciaBenchmark,
    correspondencia: 'parcial',
  }).success, false);
});
