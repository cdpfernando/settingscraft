import assert from 'node:assert/strict';
import test from 'node:test';

import type { ArmazenamentoChaveValor } from '../armazenamento';
import { criarChaveCache, criarRepositorioCacheLocal } from './cache-local';
import type { Consulta } from './fonte';
import { CONTRATO_VERSAO, type Resultado } from './schema';

const consulta: Consulta = {
  jogo: 'Alan Wake 2',
  placaVideo: 'NVIDIA GeForce RTX 4070 Super',
  processador: 'AMD Ryzen 7 7800X3D',
  memoria: '32 GB',
  resolucao: '2560x1440 (2K)',
};

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

test('normaliza espaços e caixa ao criar a chave', () => {
  const equivalente: Consulta = {
    jogo: '  ALAN   WAKE 2 ',
    placaVideo: ' nvidia geForce RTX 4070 SUPER ',
    processador: ' amd ryzen 7 7800x3d ',
    memoria: ' 32   gb ',
    resolucao: ' 2560X1440   (2k) ',
  };

  assert.equal(criarChaveCache(equivalente), criarChaveCache(consulta));
});

test('persiste e busca uma recomendação pela consulta normalizada', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioCacheLocal(armazenamento);
  await repositorio.salvar(consulta, resultado);

  assert.deepEqual(await repositorio.buscar({ ...consulta, jogo: ' alan  wake 2 ' }), resultado);
  assert.equal(armazenamento.dados.size, 1);
});

test('histórico preserva o gerador e marca a fonte de entrega como salva', async () => {
  const repositorio = criarRepositorioCacheLocal(new ArmazenamentoMemoria());
  await repositorio.salvar(consulta, resultado);

  assert.deepEqual(await repositorio.listar(), [{
    consulta,
    resultado: { ...resultado, fonte: 'salvo' },
  }]);
});

test('descarta registro local corrompido ao buscar', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const chave = criarChaveCache(consulta);
  armazenamento.dados.set(chave, '{json inválido');
  const repositorio = criarRepositorioCacheLocal(armazenamento);

  assert.equal(await repositorio.buscar(consulta), null);
  assert.deepEqual(armazenamento.removidas, [chave]);
  assert.equal(armazenamento.dados.has(chave), false);
});

test('histórico ignora e remove registros fora do contrato', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const chave = criarChaveCache(consulta);
  armazenamento.dados.set(chave, JSON.stringify({ consulta, resultado: { versaoContrato: 1 } }));
  const repositorio = criarRepositorioCacheLocal(armazenamento);

  assert.deepEqual(await repositorio.listar(), []);
  assert.deepEqual(armazenamento.removidas, [chave]);
});
