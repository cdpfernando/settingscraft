import assert from 'node:assert/strict';
import test from 'node:test';

import { criarConsultaTeste } from '../testes/criar-consulta-teste';
import { ErroFonteConfiguracao, ErroFonteLimite } from './fonte';
import { criarFonteGroq } from './fonte-groq';

const consulta = criarConsultaTeste();

const respostaIa = {
  configuracoes: [{ nome: 'Qualidade geral', valor: 'Alto', justificativa: 'Mantém a meta.' }],
  fpsEstimado: '60 a 70 FPS',
};

function respostaGroq(conteudo: unknown): Response {
  return new Response(JSON.stringify({
    id: 'chatcmpl-teste',
    created: 1_788_531_200,
    model: 'openai/gpt-oss-120b',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: JSON.stringify(conteudo) },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function respostaErro(status: number): Response {
  return new Response(JSON.stringify({
    error: { message: `erro ${status}`, type: 'invalid_request_error' },
  }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('envia o contrato estruturado e valida o conteúdo retornado', async () => {
  let urlRecebida: URL | undefined;
  let requisicao: Record<string, unknown> | undefined;
  const resultado = await criarFonteGroq({
    apiKey: 'chave-de-teste',
    transporte: async (entrada, init) => {
      urlRecebida = new URL(String(entrada));
      requisicao = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return respostaGroq(respostaIa);
    },
  }).gerar({ consulta });
  const payload = requisicao as {
    model: string;
    messages: Array<{ role: string; content: string }>;
    response_format: { type: string; json_schema?: { schema?: { properties?: Record<string, unknown> } } };
  };

  assert.equal(urlRecebida?.hostname, 'api.groq.com');
  assert.equal(urlRecebida?.pathname, '/openai/v1/chat/completions');
  assert.equal(payload.model, 'openai/gpt-oss-120b');
  assert.ok(payload.messages.some((mensagem) => mensagem.role === 'system'));
  assert.ok(payload.messages.some((mensagem) => mensagem.content.includes('Jogo: Cyberpunk 2077')));
  assert.equal(payload.response_format.type, 'json_schema');
  assert.deepEqual(Object.keys(payload.response_format.json_schema?.schema?.properties ?? {}).sort(), [
    'configuracoes',
    'fpsEstimado',
  ]);
  assert.deepEqual(resultado, respostaIa);
});

test('conteúdo fora de RespostaIaSchema é rejeitado', async () => {
  const resultado = await criarFonteGroq({
    apiKey: 'teste',
    transporte: async () => respostaGroq({ configuracoes: [], fpsEstimado: 60 }),
  }).gerar({ consulta });

  assert.equal(resultado, null);
});

for (const status of [400, 401] as const) {
  test(`HTTP ${status} produz erro de configuração`, async () => {
    await assert.rejects(
      criarFonteGroq({
        apiKey: 'teste',
        transporte: async () => respostaErro(status),
      }).gerar({ consulta }),
      (erro: unknown) => erro instanceof ErroFonteConfiguracao && erro.status === status,
    );
  });
}

test('HTTP 429 produz erro de limite sem retry do SDK', async () => {
  let chamadas = 0;

  await assert.rejects(
    criarFonteGroq({
      apiKey: 'teste',
      transporte: async () => {
        chamadas += 1;
        return respostaErro(429);
      },
    }).gerar({ consulta }),
    ErroFonteLimite,
  );
  assert.equal(chamadas, 1);
});

test('HTTP 5xx devolve ausência sem retry do SDK', async () => {
  let chamadas = 0;
  const resultado = await criarFonteGroq({
    apiKey: 'teste',
    transporte: async () => {
      chamadas += 1;
      return respostaErro(503);
    },
  }).gerar({ consulta });

  assert.equal(resultado, null);
  assert.equal(chamadas, 1);
});

test('falha de rede devolve ausência de resultado', async () => {
  const resultado = await criarFonteGroq({
    apiKey: 'teste',
    transporte: async () => { throw new TypeError('rede indisponível'); },
  }).gerar({ consulta });

  assert.equal(resultado, null);
});
