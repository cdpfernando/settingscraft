import assert from 'node:assert/strict';
import test from 'node:test';

import { formatarConfiancaFps, formatarPresetFpsHq } from './formatacao';

test('formatadores traduzem presets e confiança sem expor valores do contrato', () => {
  assert.deepEqual(
    (['low', 'medium', 'high', 'ultra'] as const).map(formatarPresetFpsHq),
    ['Baixo', 'Médio', 'Alto', 'Ultra'],
  );
  assert.equal(formatarConfiancaFps('media'), 'média');
  assert.equal(formatarConfiancaFps('baixa'), 'baixa');
});
