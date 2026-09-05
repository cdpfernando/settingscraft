import assert from 'node:assert/strict';
import test from 'node:test';

import type { Consulta } from './fonte';
import { criarPrompt } from './prompt';
import type { EvidenciaDesempenho } from './schema';

const consulta: Consulta = {
  jogo: 'Cyberpunk 2077', placaVideo: 'RTX 4060', processador: 'Ryzen 5 5600', memoria: '16 GB', resolucao: 'Full HD',
};

const evidencia: EvidenciaDesempenho = {
  fonte: 'fpshq', tipo: 'benchmark', correspondencia: 'completa', urlAtribuicao: 'https://fpshq.com/games/cyberpunk-2077/', consultadoEm: '2026-09-03T12:00:00.000Z',
  jogo: { slug: 'cyberpunk-2077', nome: 'Cyberpunk 2077' }, placaVideo: { slug: 'rtx-4060', nome: 'RTX 4060' }, processador: { slug: 'ryzen-5-5600', nome: 'Ryzen 5 5600' },
  resolucao: '1080p', presetReferencia: 'ultra', fpsMedio: 72, fpsMinimo: 61, fpsMaximo: 84,
};

test('compõe o prompt com benchmark completo', () => {
  const prompt = criarPrompt(consulta, evidencia);
  assert.match(prompt, /Evidência externa validada: FPSHQ/);
  assert.match(prompt, /Tipo: benchmark medido/);
  assert.match(prompt, /Correspondência: completa/);
  assert.match(prompt, /Preset completo de referência: Ultra/);
  assert.match(prompt, /FPS médio: 72; mínimo: 61; máximo: 84/);
  assert.match(prompt, /maior qualidade consultado cujo mínimo informado atinge 60 FPS/);
});

test('compõe o prompt com predição parcial', () => {
  const prompt = criarPrompt(consulta, {
    ...evidencia,
    tipo: 'predicao',
    correspondencia: 'parcial',
    processador: null,
  });

  assert.match(prompt, /Tipo: projeção calculada pelo FPSHQ/);
  assert.match(prompt, /Correspondência: parcial/);
  assert.match(prompt, /CPU não correspondida/);
  assert.doesNotMatch(prompt, /Tipo: benchmark medido/);
});

test('orienta a IA quando a evidência indica que a meta não é viável', () => {
  const prompt = criarPrompt(consulta, { ...evidencia, fpsMinimo: 58 });

  assert.match(prompt, /Nenhum preset consultado atingiu mínimo de 60 FPS/);
  assert.match(prompt, /não prometa 60 FPS/);
  assert.doesNotMatch(prompt, /1% low/i);
});

test('sem evidência não menciona FPSHQ, origem ou números externos', () => {
  const prompt = criarPrompt(consulta);
  assert.doesNotMatch(prompt, /FPSHQ|evidência externa|benchmark|predição/i);
  assert.doesNotMatch(prompt, /projeção|correspondência/i);
  assert.doesNotMatch(prompt, /FPS médio|FPS mínimo|FPS máximo/i);
});
