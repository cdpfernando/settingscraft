import assert from 'node:assert/strict';
import test from 'node:test';

import type { ArmazenamentoChaveValor } from '../armazenamento';
import { criarConsultaTeste } from '../testes/criar-consulta-teste';
import { criarRepositorioCacheLocal } from './cache-local';
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
  evidenciaDesempenho: null,
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

function unicaChave(armazenamento: ArmazenamentoMemoria): string {
  assert.equal(armazenamento.dados.size, 1);
  return [...armazenamento.dados.keys()][0];
}

test('mantém o namespace v2 e a identidade anterior sem expor helpers de chave', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  await criarRepositorioCacheLocal(armazenamento).salvar(consulta, resultado);

  assert.equal(
    unicaChave(armazenamento),
    '@settingscraft/resultados:v2:["alan wake 2","nvidia geforce rtx 4070 super","amd ryzen 7 7800x3d","32 gb","2560x1440 (2k)"]',
  );
});

test('persiste e busca uma recomendação por uma consulta equivalente', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioCacheLocal(armazenamento);
  await repositorio.salvar(consulta, resultado);
  const equivalente = criarConsultaTeste({
    jogo: ' alan  wake 2 ',
    placaVideo: ' nvidia geForce RTX 4070 SUPER ',
    processador: ' amd ryzen 7 7800x3d ',
    memoria: ' 32   gb ',
    resolucao: ' 2560X1440   (2k) ',
  });

  assert.deepEqual(await repositorio.buscar(equivalente), resultado);
  assert.equal(armazenamento.dados.size, 1);
});

test('histórico recebe somente a consulta reconstruída e congelada', async () => {
  const repositorio = criarRepositorioCacheLocal(new ArmazenamentoMemoria());
  await repositorio.salvar(consulta, resultado);

  const itens = await repositorio.listar();
  assert.deepEqual(itens, [{
    consulta,
    resultado: { ...resultado, fonte: 'salvo' },
  }]);
  assert.equal(Object.isFrozen(itens[0].consulta), true);
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

  assert.deepEqual(await criarRepositorioCacheLocal(armazenamento).buscar(consulta), resultado);
  assert.deepEqual(armazenamento.removidas, []);
});

test('descarta JSON ilegível ao buscar', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioCacheLocal(armazenamento);
  await repositorio.salvar(consulta, resultado);
  const chave = unicaChave(armazenamento);
  armazenamento.dados.set(chave, '{json inválido');

  assert.equal(await repositorio.buscar(consulta), null);
  assert.deepEqual(armazenamento.removidas, [chave]);
  assert.equal(armazenamento.dados.has(chave), false);
});

test('descarta valor vazio ao buscar', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioCacheLocal(armazenamento);
  await repositorio.salvar(consulta, resultado);
  const chave = unicaChave(armazenamento);
  armazenamento.dados.set(chave, '');

  assert.equal(await repositorio.buscar(consulta), null);
  assert.deepEqual(armazenamento.removidas, [chave]);
  assert.equal(armazenamento.dados.has(chave), false);
});

test('descarta consulta persistida inválida ao buscar', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioCacheLocal(armazenamento);
  await repositorio.salvar(consulta, resultado);
  const chave = unicaChave(armazenamento);
  armazenamento.dados.set(chave, JSON.stringify({
    consulta: { ...consulta, memoria: '24 GB' },
    resultado,
  }));

  assert.equal(await repositorio.buscar(consulta), null);
  assert.deepEqual(armazenamento.removidas, [chave]);
});

test('histórico ignora e remove recomendação fora do contrato', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioCacheLocal(armazenamento);
  await repositorio.salvar(consulta, resultado);
  const chave = unicaChave(armazenamento);
  armazenamento.dados.set(chave, JSON.stringify({
    consulta,
    resultado: { versaoContrato: 1 },
  }));

  assert.deepEqual(await repositorio.listar(), []);
  assert.deepEqual(armazenamento.removidas, [chave]);
});

test('histórico ignora e remove valor vazio', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioCacheLocal(armazenamento);
  await repositorio.salvar(consulta, resultado);
  const chave = unicaChave(armazenamento);
  armazenamento.dados.set(chave, '');

  assert.deepEqual(await repositorio.listar(), []);
  assert.deepEqual(armazenamento.removidas, [chave]);
  assert.equal(armazenamento.dados.has(chave), false);
});
