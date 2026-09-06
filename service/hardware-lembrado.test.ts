import assert from 'node:assert/strict';
import test from 'node:test';

import type { ArmazenamentoChaveValor } from './armazenamento';
import {
  criarRepositorioHardwareLembrado,
  type HardwareLembrado,
} from './hardware-lembrado';

const hardware: HardwareLembrado = {
  placaVideo: 'NVIDIA GeForce RTX 4060',
  processador: 'AMD Ryzen 5 5600',
  memoria: '16 GB',
  resolucao: '1920x1080 (Full HD)',
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
  override async removeItem(): Promise<void> {
    throw new Error('falha simulada ao remover');
  }
}

function unicaChave(armazenamento: ArmazenamentoMemoria): string {
  assert.equal(armazenamento.dados.size, 1);
  return [...armazenamento.dados.keys()][0];
}

test('salvar persiste um único hardware com os rótulos canônicos', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioHardwareLembrado(armazenamento);

  await repositorio.salvar(hardware);

  const chave = unicaChave(armazenamento);
  assert.deepEqual(JSON.parse(armazenamento.dados.get(chave)!), hardware);
});

test('ler devolve integralmente o hardware válido armazenado', async () => {
  const repositorio = criarRepositorioHardwareLembrado(new ArmazenamentoMemoria());
  await repositorio.salvar(hardware);

  assert.deepEqual(await repositorio.ler(), hardware);
});

test('salvar substitui o registro anterior pelo hardware mais recente', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioHardwareLembrado(armazenamento);
  const maisRecente: HardwareLembrado = {
    ...hardware,
    placaVideo: 'GPU Experimental',
    processador: 'CPU Fora do Catálogo',
    memoria: '32 GB',
    resolucao: '2560x1440 (2K)',
  };

  await repositorio.salvar(hardware);
  await repositorio.salvar(maisRecente);

  assert.equal(armazenamento.dados.size, 1);
  assert.deepEqual(await repositorio.ler(), maisRecente);
});

test('apagar remove o registro e a leitura posterior devolve ausência', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioHardwareLembrado(armazenamento);
  await repositorio.salvar(hardware);

  await repositorio.apagar();

  assert.equal(await repositorio.ler(), null);
  assert.equal(armazenamento.dados.size, 0);
});

test('ler remove JSON ilegível e o trata como ausência', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioHardwareLembrado(armazenamento);
  await repositorio.salvar(hardware);
  const chave = unicaChave(armazenamento);
  armazenamento.dados.set(chave, '{json inválido');

  assert.equal(await repositorio.ler(), null);
  assert.deepEqual(armazenamento.removidas, [chave]);
  assert.equal(armazenamento.dados.has(chave), false);
});

test('ler remove opções não suportadas e as trata como ausência', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioHardwareLembrado(armazenamento);
  await repositorio.salvar(hardware);
  const chave = unicaChave(armazenamento);
  armazenamento.dados.set(chave, JSON.stringify({ ...hardware, memoria: '24 GB' }));

  assert.equal(await repositorio.ler(), null);
  assert.deepEqual(armazenamento.removidas, [chave]);
  assert.equal(armazenamento.dados.has(chave), false);
});

test('ler remove texto livre vazio e o trata como ausência', async () => {
  const armazenamento = new ArmazenamentoMemoria();
  const repositorio = criarRepositorioHardwareLembrado(armazenamento);
  await repositorio.salvar(hardware);
  const chave = unicaChave(armazenamento);
  armazenamento.dados.set(chave, JSON.stringify({ ...hardware, processador: '   ' }));

  assert.equal(await repositorio.ler(), null);
  assert.deepEqual(armazenamento.removidas, [chave]);
});

test('ler trata registro inválido como ausente mesmo se a remoção falhar', async () => {
  const armazenamento = new ArmazenamentoComFalhaAoRemover();
  const repositorio = criarRepositorioHardwareLembrado(armazenamento);
  await repositorio.salvar(hardware);
  const chave = unicaChave(armazenamento);
  armazenamento.dados.set(chave, JSON.stringify({ ...hardware, resolucao: '1024x768' }));

  assert.equal(await repositorio.ler(), null);
  assert.equal(armazenamento.dados.has(chave), true);
});
