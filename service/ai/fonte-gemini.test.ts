import assert from 'node:assert/strict';
import test from 'node:test';

import { criarConsultaTeste } from '../testes/criar-consulta-teste';
import { ErroFonteConfiguracao, ErroFonteLimite } from './fonte';
import { criarFonteGemini } from './fonte-gemini';
import { INSTRUCAO_SISTEMA } from './prompt';

const consulta = criarConsultaTeste();

const respostaIa = {
  configuracoes: [{ nome: 'Qualidade geral', valor: 'Alto', justificativa: 'Mantém a meta.' }],
  fpsEstimado: '60 a 70 FPS',
};

function respostaGemini(conteudo: unknown): Response {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(conteudo) }] } }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
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

test('envia instrução, prompt e JSON Schema derivado no payload', async () => {
  let urlRecebida: URL | undefined;
  let requisicao: Record<string, unknown> | undefined;
  const fonte = criarFonteGemini({
    apiKey: 'chave-de-teste',
    transporte: async (entrada, init) => {
      urlRecebida = new URL(String(entrada));
      requisicao = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return respostaGemini(respostaIa);
    },
  });

  const resultado = await fonte.gerar({ consulta });
  const payload = requisicao as {
    system_instruction: { parts: Array<{ text: string }> };
    contents: Array<{ parts: Array<{ text: string }> }>;
    generationConfig: {
      responseMimeType: string;
      responseSchema: Record<string, unknown> & { properties?: Record<string, unknown> };
    };
  };

  assert.equal(urlRecebida?.hostname, 'generativelanguage.googleapis.com');
  assert.equal(urlRecebida?.searchParams.get('key'), 'chave-de-teste');
  assert.equal(payload.system_instruction.parts[0].text, INSTRUCAO_SISTEMA);
  assert.match(payload.contents[0].parts[0].text, /Jogo: Cyberpunk 2077/);
  assert.equal(payload.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(Object.keys(payload.generationConfig.responseSchema.properties ?? {}).sort(), [
    'configuracoes',
    'fpsEstimado',
  ]);
  assert.equal('$schema' in payload.generationConfig.responseSchema, false);
  assert.deepEqual(resultado, respostaIa);
});

test('conteúdo fora de RespostaIaSchema é rejeitado', async () => {
  const resultado = await semErrosNoConsole(() => criarFonteGemini({
    apiKey: 'teste',
    transporte: async () => respostaGemini({ configuracoes: 'inválidas', fpsEstimado: 60 }),
  }).gerar({ consulta }));

  assert.equal(resultado, null);
});

for (const status of [400, 401] as const) {
  test(`HTTP ${status} produz erro de configuração`, async () => {
    await semErrosNoConsole(async () => {
      await assert.rejects(
        criarFonteGemini({
          apiKey: 'teste',
          transporte: async () => new Response('{}', { status }),
        }).gerar({ consulta }),
        (erro: unknown) => erro instanceof ErroFonteConfiguracao && erro.status === status,
      );
    });
  });
}

test('HTTP 429 produz erro de limite em uma única tentativa', async () => {
  let chamadas = 0;

  await semErrosNoConsole(async () => {
    await assert.rejects(
      criarFonteGemini({
        apiKey: 'teste',
        transporte: async () => {
          chamadas += 1;
          return new Response('{}', { status: 429 });
        },
      }).gerar({ consulta }),
      ErroFonteLimite,
    );
  });
  assert.equal(chamadas, 1);
});

test('HTTP 5xx devolve ausência em uma única tentativa', async () => {
  let chamadas = 0;
  const resultado = await criarFonteGemini({
    apiKey: 'teste',
    transporte: async () => {
      chamadas += 1;
      return new Response('{}', { status: 503 });
    },
  }).gerar({ consulta });

  assert.equal(resultado, null);
  assert.equal(chamadas, 1);
});

test('falha de rede devolve ausência de resultado', async () => {
  const resultado = await semErrosNoConsole(() => criarFonteGemini({
    apiKey: 'teste',
    transporte: async () => { throw new TypeError('rede indisponível'); },
  }).gerar({ consulta }));

  assert.equal(resultado, null);
});
