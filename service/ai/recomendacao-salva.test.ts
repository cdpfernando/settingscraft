import assert from 'node:assert/strict';
import test from 'node:test';

import type { ArmazenamentoChaveValor } from '../armazenamento';
import { criarConsultaTeste } from '../testes/criar-consulta-teste';
import { criarRepositorioRecomendacoesSalvas } from './recomendacao-salva';
import { CONTRATO_VERSAO, type Resultado } from './schema';

const consulta = criarConsultaTeste({
  jogo: 'Alan Wake 2',
  placaVideo: 'NVIDIA GeForce RTX 4070 Super',
  processador: 'AMD Ryzen 7 7800X3D',
  memoria: '32 GB',
  resolucao: '2560x1440 (2K)',
});

const resultado: Resultado = {
  configuracoes: [{ nome: 'Qualidade geral', valor: 'Alto', justificativa: 'Mantém bom equilíbrio.' }],
  fpsEstimado: '60 a 70 FPS',
  fonte: 'gemini',
  geradoPor: 'gemini',
  confiancaFps: 'baixa',
  evidenciaDesempenho: {
    fonte: 'fpshq',
    tipo: 'predicao',
    correspondencia: 'parcial',
    urlAtribuicao: 'https://fpshq.com/games/alan-wake-2/',
    consultadoEm: '2026-09-05T09:59:00.000Z',
    jogo: { slug: 'alan-wake-2', nome: 'Alan Wake 2' },
    placaVideo: { slug: 'rtx-4070-super', nome: 'GeForce RTX 4070 Super' },
    processador: null,
    resolucao: '1440p',
    presetReferencia: 'high',
    fpsMedio: 66,
    fpsMinimo: 58,
    fpsMaximo: 74,
  },
  geradoEm: '2026-09-05T10:00:00.000Z',
  versaoContrato: CONTRATO_VERSAO,
};

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

class ArmazenamentoComFalhaAoRemover extends ArmazenamentoMemoria {
  override async removeItem(chave: string): Promise<void> {
    this.removidas.push(chave);
    throw new Error('falha simulada ao remover');
  }
}

async function semRegistrarErro<T>(operacao: () => Promise<T>): Promise<T> {
  const erroOriginal = console.error;
  console.error = () => undefined;
  try {
    return await operacao();
  } finally {
    console.error = erroOriginal;
  }
}

function unicaChave(armazenamento: ArmazenamentoMemoria): string {
  assert.equal(armazenamento.dados.size, 1);
  return [...armazenamento.dados.keys()][0];
}

test('mantém o namespace v2 e a identidade anterior sem expor helpers de chave', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  await criarRepositorioRecomendacoesSalvas(armazenamento).salvar(consulta, resultado);

  assert.equal(
    unicaChave(armazenamento),
    '@settingscraft/resultados:v2:["alan wake 2","nvidia geforce rtx 4070 super","amd ryzen 7 7800x3d","32 gb","2560x1440 (2k)"]',
  );
});

test('persiste e busca uma recomendação salva por uma consulta equivalente', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioRecomendacoesSalvas(armazenamento);
  await repositorio.salvar(consulta, resultado);
  const equivalente = criarConsultaTeste({
    jogo: ' alan  wake 2 ',
    placaVideo: ' nvidia geForce RTX 4070 SUPER ',
    processador: ' amd ryzen 7 7800x3d ',
    memoria: ' 32   gb ',
    resolucao: ' 2560X1440   (2k) ',
  });

  assert.deepEqual(await repositorio.buscar(equivalente), {
    ...resultado,
    fonte: 'salvo',
  });
  assert.equal(armazenamento.dados.size, 1);
});

test('salvar novamente para a mesma identidade substitui a recomendação anterior', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioRecomendacoesSalvas(armazenamento);
  const maisRecente: Resultado = {
    ...resultado,
    configuracoes: [{
      nome: 'Qualidade geral',
      valor: 'Ultra',
      justificativa: 'Reflete a recomendação mais recente.',
    }],
    fpsEstimado: '52 a 60 FPS',
    geradoEm: '2026-09-05T12:00:00.000Z',
  };

  await repositorio.salvar(consulta, resultado);
  await repositorio.salvar(consulta, maisRecente);

  assert.equal(armazenamento.dados.size, 1);
  assert.deepEqual(await repositorio.buscar(consulta), {
    ...maisRecente,
    fonte: 'salvo',
  });
  assert.deepEqual(await repositorio.listar(), [{
    consulta,
    resultado: { ...maisRecente, fonte: 'salvo' },
  }]);
});

test('consultas com identidades diferentes permanecem salvas separadamente', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioRecomendacoesSalvas(armazenamento);
  const outraConsulta = criarConsultaTeste({ jogo: 'Cyberpunk 2077' });
  const outroResultado: Resultado = {
    ...resultado,
    fonte: 'groq',
    geradoPor: 'groq',
    geradoEm: '2026-09-05T11:00:00.000Z',
  };

  await repositorio.salvar(consulta, resultado);
  await repositorio.salvar(outraConsulta, outroResultado);

  assert.equal(armazenamento.dados.size, 2);
  assert.deepEqual(await repositorio.buscar(consulta), { ...resultado, fonte: 'salvo' });
  assert.deepEqual(await repositorio.buscar(outraConsulta), {
    ...outroResultado,
    fonte: 'salvo',
  });
});

test('listagem recebe somente a consulta reconstruída e congelada', async () => {
  const repositorio = criarRepositorioRecomendacoesSalvas(new ArmazenamentoMemoria());
  await repositorio.salvar(consulta, resultado);

  const itens = await repositorio.listar();
  assert.deepEqual(itens, [{
    consulta,
    resultado: { ...resultado, fonte: 'salvo' },
  }]);
  assert.equal(Object.isFrozen(itens[0].consulta), true);
});

test('listagem marca todas as recomendações como salvas e preserva seus geradores', async () => {
  const repositorio = criarRepositorioRecomendacoesSalvas(new ArmazenamentoMemoria());
  const outraConsulta = criarConsultaTeste({ jogo: 'Cyberpunk 2077' });
  await repositorio.salvar(consulta, resultado);
  await repositorio.salvar(outraConsulta, {
    ...resultado,
    fonte: 'groq',
    geradoPor: 'groq',
    geradoEm: '2026-09-05T11:00:00.000Z',
  });

  const itens = await repositorio.listar();
  assert.equal(itens.length, 2);
  assert.equal(itens.every((item) => item.resultado.fonte === 'salvo'), true);
  assert.deepEqual(itens.map((item) => item.resultado.geradoPor), ['groq', 'gemini']);
  assert.deepEqual(itens[1].resultado.evidenciaDesempenho, resultado.evidenciaDesempenho);
});

test('continua recuperando um registro válido persistido no contrato v2', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const chave = '@settingscraft/resultados:v2:["alan wake 2","nvidia geforce rtx 4070 super","amd ryzen 7 7800x3d","32 gb","2560x1440 (2k)"]';
  armazenamento.dados.set(chave, JSON.stringify({
    consulta: {
      jogo: 'Alan Wake 2',
      placaVideo: 'NVIDIA GeForce RTX 4070 Super',
      processador: 'AMD Ryzen 7 7800X3D',
      memoria: '32 GB',
      resolucao: '2560x1440 (2K)',
    },
    resultado,
  }));

  assert.deepEqual(await criarRepositorioRecomendacoesSalvas(armazenamento).buscar(consulta), {
    ...resultado,
    fonte: 'salvo',
  });
  assert.deepEqual(armazenamento.removidas, []);
});

test('descarta fonte persistida inválida antes de marcar a recomendação como salva', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioRecomendacoesSalvas(armazenamento);
  await repositorio.salvar(consulta, resultado);
  const chave = unicaChave(armazenamento);
  armazenamento.dados.set(chave, JSON.stringify({
    consulta,
    resultado: { ...resultado, fonte: 'desconhecida' },
  }));

  assert.equal(await repositorio.buscar(consulta), null);
  assert.deepEqual(armazenamento.removidas, [chave]);
  assert.equal(armazenamento.dados.has(chave), false);
});

test('descarta JSON ilegível ao buscar', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioRecomendacoesSalvas(armazenamento);
  await repositorio.salvar(consulta, resultado);
  const chave = unicaChave(armazenamento);
  armazenamento.dados.set(chave, '{json inválido');

  assert.equal(await repositorio.buscar(consulta), null);
  assert.deepEqual(armazenamento.removidas, [chave]);
  assert.equal(armazenamento.dados.has(chave), false);
});

test('descarta valor vazio ao buscar', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioRecomendacoesSalvas(armazenamento);
  await repositorio.salvar(consulta, resultado);
  const chave = unicaChave(armazenamento);
  armazenamento.dados.set(chave, '');

  assert.equal(await repositorio.buscar(consulta), null);
  assert.deepEqual(armazenamento.removidas, [chave]);
  assert.equal(armazenamento.dados.has(chave), false);
});

test('descarta consulta persistida inválida ao buscar', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioRecomendacoesSalvas(armazenamento);
  await repositorio.salvar(consulta, resultado);
  const chave = unicaChave(armazenamento);
  armazenamento.dados.set(chave, JSON.stringify({
    consulta: { ...consulta, memoria: '24 GB' },
    resultado,
  }));

  assert.equal(await repositorio.buscar(consulta), null);
  assert.deepEqual(armazenamento.removidas, [chave]);
});

test('listagem ignora e remove recomendação fora do contrato', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioRecomendacoesSalvas(armazenamento);
  await repositorio.salvar(consulta, resultado);
  const chave = unicaChave(armazenamento);
  armazenamento.dados.set(chave, JSON.stringify({
    consulta,
    resultado: { versaoContrato: 1 },
  }));

  assert.deepEqual(await repositorio.listar(), []);
  assert.deepEqual(armazenamento.removidas, [chave]);
});

test('listagem ignora e remove valor vazio', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioRecomendacoesSalvas(armazenamento);
  await repositorio.salvar(consulta, resultado);
  const chave = unicaChave(armazenamento);
  armazenamento.dados.set(chave, '');

  assert.deepEqual(await repositorio.listar(), []);
  assert.deepEqual(armazenamento.removidas, [chave]);
  assert.equal(armazenamento.dados.has(chave), false);
});

test('busca trata registro corrompido como ausente mesmo se a remoção falhar', async () => {
  const armazenamento = new ArmazenamentoComFalhaAoRemover();
  const repositorio = criarRepositorioRecomendacoesSalvas(armazenamento);
  await repositorio.salvar(consulta, resultado);
  const chave = unicaChave(armazenamento);
  armazenamento.dados.set(chave, '{json inválido');

  assert.equal(await semRegistrarErro(() => repositorio.buscar(consulta)), null);
  assert.deepEqual(armazenamento.removidas, [chave]);
  assert.equal(armazenamento.dados.has(chave), true);
});

test('listagem devolve os registros válidos mesmo se a remoção de um corrompido falhar', async () => {
  const armazenamento = new ArmazenamentoComFalhaAoRemover();
  const repositorio = criarRepositorioRecomendacoesSalvas(armazenamento);
  const outraConsulta = criarConsultaTeste({ jogo: 'Cyberpunk 2077' });
  await repositorio.salvar(consulta, resultado);
  const chaveCorrompida = unicaChave(armazenamento);
  armazenamento.dados.set(chaveCorrompida, '{json inválido');
  await repositorio.salvar(outraConsulta, {
    ...resultado,
    fonte: 'groq',
    geradoPor: 'groq',
    geradoEm: '2026-09-05T11:00:00.000Z',
  });

  const itens = await semRegistrarErro(() => repositorio.listar());

  assert.deepEqual(itens, [{
    consulta: outraConsulta,
    resultado: {
      ...resultado,
      fonte: 'salvo',
      geradoPor: 'groq',
      geradoEm: '2026-09-05T11:00:00.000Z',
    },
  }]);
  assert.deepEqual(armazenamento.removidas, [chaveCorrompida]);
});

test('falhas reais de leitura e enumeração continuam sendo lançadas', async () => {
  const falha = new Error('armazenamento indisponível');
  const falhaAoLer = new ArmazenamentoMemoria();
  falhaAoLer.getItem = async () => { throw falha; };
  await assert.rejects(
    criarRepositorioRecomendacoesSalvas(falhaAoLer).buscar(consulta),
    (erro: unknown) => erro === falha,
  );

  const falhaAoEnumerar = new ArmazenamentoMemoria();
  falhaAoEnumerar.getAllKeys = async () => { throw falha; };
  await assert.rejects(
    criarRepositorioRecomendacoesSalvas(falhaAoEnumerar).listar(),
    (erro: unknown) => erro === falha,
  );

  const falhaAoBuscarEmLote = new ArmazenamentoMemoria();
  await criarRepositorioRecomendacoesSalvas(falhaAoBuscarEmLote).salvar(consulta, resultado);
  falhaAoBuscarEmLote.multiGet = async () => { throw falha; };
  await assert.rejects(
    criarRepositorioRecomendacoesSalvas(falhaAoBuscarEmLote).listar(),
    (erro: unknown) => erro === falha,
  );
});

test('falha real de escrita continua sendo lançada', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const falha = new Error('armazenamento indisponível');
  armazenamento.setItem = async () => { throw falha; };

  await assert.rejects(
    criarRepositorioRecomendacoesSalvas(armazenamento).salvar(consulta, resultado),
    (erro: unknown) => erro === falha,
  );
  assert.equal(armazenamento.dados.size, 0);
});

test('resultado inválido falha antes de qualquer persistência', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const resultadoInvalido = {
    ...resultado,
    configuracoes: [{ nome: 'Qualidade geral', valor: 'Alto' }],
  } as unknown as Resultado;

  assert.throws(
    () => criarRepositorioRecomendacoesSalvas(armazenamento).salvar(consulta, resultadoInvalido),
  );
  assert.equal(armazenamento.dados.size, 0);
});
