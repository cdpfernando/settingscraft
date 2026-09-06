import assert from 'node:assert/strict';
import test from 'node:test';

import {
  criarConsultaConfiguracoes,
  identificarConsultaConfiguracoes,
  OPCOES_MEMORIA,
  RESOLUCOES,
} from './consulta-configuracoes';

const entradaValida = {
  jogo: 'Cyberpunk 2077',
  placaVideo: 'NVIDIA GeForce RTX 4060',
  processador: 'AMD Ryzen 5 5600',
  memoria: '16 GB',
  resolucao: '1920x1080 (Full HD)',
};

function criarValida(sobrescritas: Partial<typeof entradaValida> = {}) {
  const resultado = criarConsultaConfiguracoes({ ...entradaValida, ...sobrescritas });
  if (!resultado.ok) assert.fail(JSON.stringify(resultado.erros));
  return resultado.consulta;
}

test('expõe as opções suportadas atuais de memória e resolução', () => {
  assert.deepEqual(OPCOES_MEMORIA, ['8 GB', '16 GB', '32 GB', '64 GB', '128 GB']);
  assert.deepEqual(RESOLUCOES, [
    '1280x720 (HD)',
    '1920x1080 (Full HD)',
    '2560x1440 (2K)',
    '3840x2160 (4K)',
  ]);
});

test('constrói uma consulta válida, opaca e congelada sem serializar a marca', () => {
  const consulta = criarValida();

  assert.deepEqual({ ...consulta }, entradaValida);
  assert.equal(Object.isFrozen(consulta), true);
  assert.equal(Reflect.set(consulta, 'jogo', 'Outro jogo'), false);
  assert.equal(consulta.jogo, entradaValida.jogo);
  assert.equal(JSON.stringify(consulta), JSON.stringify(entradaValida));
});

test('acumula todos os campos ausentes ou vazios como obrigatórios', () => {
  const resultado = criarConsultaConfiguracoes({
    jogo: '',
    placaVideo: '   ',
    processador: '\t\n',
  });

  assert.deepEqual(resultado, {
    ok: false,
    erros: {
      jogo: 'obrigatorio',
      placaVideo: 'obrigatorio',
      processador: 'obrigatorio',
      memoria: 'obrigatorio',
      resolucao: 'obrigatorio',
    },
  });
});

test('distingue tipos inválidos e acumula um motivo por campo', () => {
  const resultado = criarConsultaConfiguracoes({
    jogo: 42,
    placaVideo: null,
    processador: false,
    memoria: ['16 GB'],
    resolucao: {},
  });

  assert.deepEqual(resultado, {
    ok: false,
    erros: {
      jogo: 'tipo_invalido',
      placaVideo: 'tipo_invalido',
      processador: 'tipo_invalido',
      memoria: 'tipo_invalido',
      resolucao: 'tipo_invalido',
    },
  });
});

test('aceita textos livres e normaliza espaços preservando a caixa legível', () => {
  const consulta = criarValida({
    jogo: '  Jogo   Fora\tdo Catálogo ',
    placaVideo: ' GPU   Experimental ',
    processador: 'CPU\nDesconhecida',
    memoria: '  16   gb ',
    resolucao: ' 1920X1080   (full hd) ',
  });

  assert.deepEqual({ ...consulta }, {
    jogo: 'Jogo Fora do Catálogo',
    placaVideo: 'GPU Experimental',
    processador: 'CPU Desconhecida',
    memoria: '16 GB',
    resolucao: '1920x1080 (Full HD)',
  });
});

test('rejeita memória e resolução não suportadas separadamente', () => {
  const resultado = criarConsultaConfiguracoes({
    ...entradaValida,
    memoria: '24 GB',
    resolucao: '1024x768',
  });

  assert.deepEqual(resultado, {
    ok: false,
    erros: {
      memoria: 'opcao_nao_suportada',
      resolucao: 'opcao_nao_suportada',
    },
  });
});

test('mantém a identidade v2 ordenada e equivalente por caixa e espaços', () => {
  const original = criarValida({
    jogo: 'Ação',
    placaVideo: 'NVIDIA GeForce RTX 4060',
  });
  const equivalente = criarValida({
    jogo: '  AÇÃO ',
    placaVideo: ' nvidia   geforce rtx 4060 ',
    memoria: ' 16   gb ',
    resolucao: ' 1920X1080   (FULL HD) ',
  });
  const identidade = identificarConsultaConfiguracoes(original);

  assert.equal(
    identidade,
    '["ação","nvidia geforce rtx 4060","amd ryzen 5 5600","16 gb","1920x1080 (full hd)"]',
  );
  assert.equal(identificarConsultaConfiguracoes(equivalente), identidade);
  assert.notEqual(
    identificarConsultaConfiguracoes(criarValida({ jogo: 'Outro jogo' })),
    identidade,
  );
});

test('uma entrada raiz inválida nunca lança e reporta os campos obrigatórios', () => {
  assert.doesNotThrow(() => criarConsultaConfiguracoes(null));
  const resultado = criarConsultaConfiguracoes('não é um objeto');
  assert.equal(resultado.ok, false);
  if (!resultado.ok) assert.equal(Object.keys(resultado.erros).length, 5);
});
