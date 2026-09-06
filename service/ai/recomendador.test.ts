import assert from 'node:assert/strict';
import test from 'node:test';

import { criarConsultaTeste } from '../testes/criar-consulta-teste';
import { ErroFonteConfiguracao, ErroFonteLimite } from './fonte';
import {
  criarRecomendador,
  type CacheRecomendacao,
  type ConsultaResultado,
} from './recomendador';
import {
  CONTRATO_VERSAO,
  ResultadoSchema,
  type EvidenciaDesempenho,
  type GeradoPor,
  type RespostaIa,
  type Resultado,
  type ResultadoSalvo,
} from './schema';

const consulta = criarConsultaTeste();

const respostaIa: RespostaIa = {
  configuracoes: [
    { nome: 'Qualidade geral', valor: 'Alto', justificativa: 'Mantém a meta.' },
  ],
  fpsEstimado: '60 FPS',
};

const evidencia: EvidenciaDesempenho = {
  fonte: 'fpshq',
  tipo: 'benchmark',
  correspondencia: 'completa',
  urlAtribuicao: 'https://fpshq.com/games/cyberpunk-2077/',
  consultadoEm: '2026-09-03T12:00:00.000Z',
  jogo: { slug: 'cyberpunk-2077', nome: 'Cyberpunk 2077' },
  placaVideo: { slug: 'rtx-4060', nome: 'GeForce RTX 4060' },
  processador: { slug: 'ryzen-5-5600', nome: 'Ryzen 5 5600' },
  resolucao: '1080p',
  presetReferencia: 'high',
  fpsMedio: 68,
  fpsMinimo: 60,
  fpsMaximo: 79,
};

function resultadoSalvo(geradoPor: GeradoPor = 'gemini'): ResultadoSalvo {
  return {
    ...respostaIa,
    fonte: 'salvo',
    geradoPor,
    confiancaFps: 'baixa',
    evidenciaDesempenho: null,
    geradoEm: '2026-09-03T12:00:00.000Z',
    versaoContrato: CONTRATO_VERSAO,
  };
}

function criarCache(
  resultadoEncontrado: ResultadoSalvo | null,
  chamadas: string[],
  salvos: Resultado[] = [],
  falharAoSalvar = false,
): CacheRecomendacao {
  return {
    async buscar() {
      chamadas.push('cache-local');
      return resultadoEncontrado;
    },
    async salvar(_consulta, resultado) {
      chamadas.push('salvar');
      salvos.push(resultado);
      if (falharAoSalvar) throw new Error('armazenamento indisponível');
    },
  };
}

function obterResultado(resposta: ConsultaResultado): Resultado {
  if (!resposta.ok) assert.fail(resposta.erro);
  return resposta.resultado;
}

async function semErrosNoConsole<T>(acao: () => Promise<T>): Promise<T> {
  const erroOriginal = console.error;
  console.error = () => undefined;
  try {
    return await acao();
  } finally {
    console.error = erroOriginal;
  }
}

test('cache local encerra a consulta, marca a entrega como salva e preserva o gerador', async () => {
  const chamadas: string[] = [];
  const armazenado = resultadoSalvo('gemini');
  const resposta = await criarRecomendador({
    cacheLocal: criarCache(armazenado, chamadas),
    fpsHq: { nome: 'fpshq', async buscar() { assert.fail('FPSHQ não deve rodar.'); } },
    gemini: { nome: 'gemini', async gerar() { assert.fail('Gemini não deve rodar.'); } },
    groq: { nome: 'groq', async gerar() { assert.fail('Groq não deve rodar.'); } },
  }).consultarConfiguracoes(consulta);

  assert.strictEqual(obterResultado(resposta), armazenado);
  assert.deepEqual(chamadas, ['cache-local']);
});

test('miss consulta evidência uma vez, tenta Gemini antes de Groq e finaliza o conteúdo', async () => {
  const chamadas: string[] = [];
  const salvos: Resultado[] = [];
  const resposta = await criarRecomendador({
    cacheLocal: criarCache(null, chamadas, salvos),
    fpsHq: { nome: 'fpshq', async buscar() { chamadas.push('fpshq'); return evidencia; } },
    gemini: {
      nome: 'gemini',
      async gerar(contexto) {
        chamadas.push('gemini');
        assert.strictEqual(contexto.evidencia, evidencia);
        return null;
      },
    },
    groq: {
      nome: 'groq',
      async gerar(contexto) {
        chamadas.push('groq');
        assert.strictEqual(contexto.evidencia, evidencia);
        return respostaIa;
      },
    },
  }).consultarConfiguracoes(consulta);

  const resultado = obterResultado(resposta);
  assert.deepEqual(resultado.configuracoes, respostaIa.configuracoes);
  assert.equal(resultado.fpsEstimado, respostaIa.fpsEstimado);
  assert.equal(resultado.fonte, 'groq');
  assert.equal(resultado.geradoPor, 'groq');
  assert.equal(resultado.confiancaFps, 'media');
  assert.deepEqual(resultado.evidenciaDesempenho, evidencia);
  assert.match(resultado.geradoEm, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(resultado.versaoContrato, CONTRATO_VERSAO);
  assert.equal(ResultadoSchema.safeParse(resultado).success, true);
  assert.deepEqual(salvos, [resultado]);
  assert.deepEqual(chamadas, ['cache-local', 'fpshq', 'gemini', 'groq', 'salvar']);
});

test('nova recomendação pula só a leitura do cache e persiste o resultado finalizado', async () => {
  const chamadas: string[] = [];
  const salvos: Resultado[] = [];
  const resposta = await criarRecomendador({
    cacheLocal: criarCache(resultadoSalvo(), chamadas, salvos),
    gemini: { nome: 'gemini', async gerar() { chamadas.push('gemini'); return respostaIa; } },
  }).consultarConfiguracoes(consulta, { forcarNovaRecomendacao: true });

  const resultado = obterResultado(resposta);
  assert.equal(resultado.fonte, 'gemini');
  assert.equal(resultado.geradoPor, 'gemini');
  assert.equal(resultado.confiancaFps, 'baixa');
  assert.equal(resultado.evidenciaDesempenho, null);
  assert.deepEqual(salvos, [resultado]);
  assert.deepEqual(chamadas, ['gemini', 'salvar']);
});

test('conteúdo inválido não é persistido e permite o próximo gerador', async () => {
  const chamadas: string[] = [];
  const salvos: Resultado[] = [];

  const resposta = await semErrosNoConsole(() => criarRecomendador({
    cacheLocal: criarCache(null, chamadas, salvos),
    gemini: {
      nome: 'gemini',
      async gerar() {
        chamadas.push('gemini');
        return { configuracoes: 'inválidas', fpsEstimado: 60 } as unknown as RespostaIa;
      },
    },
    groq: {
      nome: 'groq',
      async gerar() {
        chamadas.push('groq');
        return respostaIa;
      },
    },
  }).consultarConfiguracoes(consulta));

  assert.equal(obterResultado(resposta).geradoPor, 'groq');
  assert.equal(salvos.length, 1);
  assert.equal(salvos[0].geradoPor, 'groq');
  assert.deepEqual(chamadas, ['cache-local', 'gemini', 'groq', 'salvar']);
});

test('falha ao persistir não descarta uma recomendação válida', async () => {
  const chamadas: string[] = [];
  const resposta = await semErrosNoConsole(() => criarRecomendador({
    cacheLocal: criarCache(null, chamadas, [], true),
    gemini: { nome: 'gemini', async gerar() { return respostaIa; } },
  }).consultarConfiguracoes(consulta));

  assert.equal(obterResultado(resposta).geradoPor, 'gemini');
  assert.deepEqual(chamadas, ['cache-local', 'salvar']);
});

test('modo de exemplo usa somente o gerador in-process identificado como exemplo', async () => {
  const chamadas: string[] = [];
  const resposta = await criarRecomendador({
    cacheLocal: criarCache(null, chamadas),
    exemplo: { nome: 'exemplo', async gerar() { chamadas.push('exemplo'); return respostaIa; } },
    fpsHq: { nome: 'fpshq', async buscar() { assert.fail('FPSHQ não deve rodar.'); } },
    gemini: { nome: 'gemini', async gerar() { assert.fail('Gemini não deve rodar.'); } },
    groq: { nome: 'groq', async gerar() { assert.fail('Groq não deve rodar.'); } },
  }).consultarConfiguracoes(consulta);

  const resultado = obterResultado(resposta);
  assert.equal(resultado.fonte, 'exemplo');
  assert.equal(resultado.geradoPor, 'exemplo');
  assert.deepEqual(chamadas, ['cache-local', 'exemplo', 'salvar']);
});

test('erros de configuração encerram a cadeia e limite preserva o fallback', async () => {
  await semErrosNoConsole(async () => {
    const chamadas: string[] = [];
    const fallback = await criarRecomendador({
      cacheLocal: criarCache(null, chamadas),
      gemini: {
        nome: 'gemini',
        async gerar() {
          chamadas.push('gemini');
          throw new ErroFonteLimite('gemini');
        },
      },
      groq: {
        nome: 'groq',
        async gerar() {
          chamadas.push('groq');
          return respostaIa;
        },
      },
    }).consultarConfiguracoes(consulta);
    assert.equal(obterResultado(fallback).geradoPor, 'groq');
    assert.deepEqual(chamadas, ['cache-local', 'gemini', 'groq', 'salvar']);

    const limite = await criarRecomendador({
      cacheLocal: criarCache(null, []),
      gemini: { nome: 'gemini', async gerar() { throw new ErroFonteLimite('gemini'); } },
    }).consultarConfiguracoes(consulta);
    assert.deepEqual(limite, {
      ok: false,
      erro: 'Limite de requisições atingido. Tente novamente em alguns segundos.',
    });

    const configuracao = await criarRecomendador({
      cacheLocal: criarCache(null, []),
      gemini: {
        nome: 'gemini',
        async gerar() { throw new ErroFonteConfiguracao('gemini', 401); },
      },
      groq: {
        nome: 'groq',
        async gerar() { assert.fail('Groq não deve rodar após erro de configuração.'); },
      },
    }).consultarConfiguracoes(consulta);
    assert.deepEqual(configuracao, {
      ok: false,
      erro: 'Não foi possível gerar as configurações. Tente novamente.',
    });
  });
});
