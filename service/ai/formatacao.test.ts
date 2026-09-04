import assert from 'node:assert/strict';
import test from 'node:test';

import { criarFonteGemini } from './fonte-gemini';
import { formatarConfiancaFps, formatarPresetFpsHq } from './formatacao';

test('formatadores traduzem presets e confiança sem expor valores do contrato', () => {
  assert.deepEqual(
    (['low', 'medium', 'high', 'ultra'] as const).map(formatarPresetFpsHq),
    ['Baixo', 'Médio', 'Alto', 'Ultra'],
  );
  assert.equal(formatarConfiancaFps('media'), 'média');
  assert.equal(formatarConfiancaFps('baixa'), 'baixa');
});

test('resultado de exemplo mantém configurações e justificativas em pt-BR', async () => {
  const fonte = criarFonteGemini({
    apiKey: '',
    usarResultadoExemplo: true,
    transporte: async () => {
      assert.fail('O resultado de exemplo não deve chamar a rede.');
    },
  });

  const resultado = await fonte.gerar({
    consulta: {
      jogo: 'Jogo de exemplo',
      placaVideo: 'GPU de exemplo',
      processador: 'CPU de exemplo',
      memoria: '16 GB',
      resolucao: 'Full HD',
    },
    evidencia: undefined,
  });

  assert.ok(resultado);
  const textoVisivel = resultado.configuracoes
    .flatMap((configuracao) => [configuracao.nome, configuracao.valor, configuracao.justificativa])
    .join(' ');
  assert.match(textoVisivel, /Distância de renderização/);
  assert.doesNotMatch(textoVisivel, /draw distance/i);
});
