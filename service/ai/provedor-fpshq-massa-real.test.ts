import assert from 'node:assert/strict';
import test from 'node:test';

import { criarConsultaTeste } from '../testes/criar-consulta-teste';
import { criarTransporteFpsHqGravado } from '../testes/massa-fpshq';
import { criarProvedorEvidenciaFpsHq } from './provedor-fpshq';

/**
 * Cenários montados sobre a massa gravada do FPSHQ. Diferente de
 * `provedor-fpshq.test.ts`, que exercita as regras com respostas sintéticas,
 * aqui as respostas são as que o serviço devolve hoje.
 */

function buscar(dados: Parameters<typeof criarConsultaTeste>[0]) {
  const { transporte, urls } = criarTransporteFpsHqGravado();
  const provedor = criarProvedorEvidenciaFpsHq({ transporte });
  return {
    urls,
    evidencia: provedor.buscar(criarConsultaTeste(dados)),
    /** Os termos que saíram no `q`, na ordem em que o provedor busca. */
    termos: () => urls
      .filter((url) => url.pathname.endsWith('/search'))
      .map((url) => url.searchParams.get('q')),
  };
}

test('Elden Ring a 1080p entrega benchmark completo no preset que bate a meta', async () => {
  const { evidencia } = buscar({
    jogo: 'Elden Ring',
    placaVideo: 'GeForce RTX 4060',
    processador: 'Ryzen 5 5600',
    resolucao: '1920x1080 (Full HD)',
  });

  assert.partialDeepStrictEqual(await evidencia, {
    fonte: 'fpshq',
    tipo: 'benchmark',
    correspondencia: 'completa',
    jogo: { slug: 'elden-ring', nome: 'Elden Ring' },
    placaVideo: { slug: 'rtx-4060', nome: 'GeForce RTX 4060' },
    processador: { slug: 'ryzen-5-5600', nome: 'Ryzen 5 5600' },
    resolucao: '1080p',
    // ultra/high/medium ficam em 47 fps mínimos; só low passa dos 60.
    presetReferencia: 'low',
    fpsMedio: 143,
    fpsMinimo: 112,
    fpsMaximo: 169,
    urlAtribuicao: 'https://fpshq.com/games/elden-ring/',
  });
});

test('CS2 a 1440p escolhe o preset mais alto na meta mesmo com curva não monotônica', async () => {
  const { evidencia } = buscar({
    jogo: 'Counter-Strike 2',
    placaVideo: 'Radeon RX 6600',
    processador: 'Core i5-12400F',
    resolucao: '2560x1440 (2K)',
  });

  assert.partialDeepStrictEqual(await evidencia, {
    tipo: 'benchmark',
    correspondencia: 'completa',
    jogo: { slug: 'cs2', nome: 'Counter-Strike 2' },
    resolucao: '1440p',
    presetReferencia: 'ultra',
    fpsMedio: 156,
    fpsMinimo: 122,
  });
});

test('sem nenhum preset na meta, cai no maior fps mínimo disponível', async () => {
  const { evidencia, termos } = buscar({
    jogo: 'Elden Ring',
    placaVideo: 'GeForce RTX 4060',
    processador: 'AMD Ryzen 7 5700G',
    resolucao: '3840x2160 (4K)',
  });

  // O Ryzen 7 5700G não está no catálogo do FPSHQ nem com o termo já sem o
  // fabricante: é ausência de catálogo, não de normalização. O processador fica
  // de fora da consulta e a correspondência é parcial.
  assert.deepEqual(termos(), ['Elden Ring', 'GeForce RTX 4060', 'Ryzen 7 5700G']);
  assert.partialDeepStrictEqual(await evidencia, {
    tipo: 'benchmark',
    correspondencia: 'parcial',
    processador: null,
    resolucao: '4K',
    presetReferencia: 'low',
    fpsMedio: 51,
    fpsMinimo: 40,
  });
});

test('jogo sem benchmark medido vira evidência de predição', async () => {
  const { evidencia } = buscar({
    jogo: 'VA-11 Hall-A: Cyberpunk Bartender Action',
    placaVideo: 'Radeon RX 6600',
    processador: 'AMD Ryzen 7 5700G',
    resolucao: '1920x1080 (Full HD)',
  });

  assert.partialDeepStrictEqual(await evidencia, {
    tipo: 'predicao',
    correspondencia: 'parcial',
    processador: null,
    presetReferencia: 'ultra',
    fpsMedio: 77,
    fpsMinimo: 60,
  });
});

test('hardware escrito com o fabricante resolve e mantém a correspondência completa', async () => {
  const { evidencia, termos } = buscar({
    jogo: 'Elden Ring',
    placaVideo: 'NVIDIA GeForce RTX 4060',
    processador: 'AMD Ryzen 5 5600',
    resolucao: '1920x1080 (Full HD)',
  });

  // Mesmo resultado do primeiro cenário, que informa o hardware sem o fabricante.
  assert.partialDeepStrictEqual(await evidencia, {
    correspondencia: 'completa',
    placaVideo: { slug: 'rtx-4060', nome: 'GeForce RTX 4060' },
    processador: { slug: 'ryzen-5-5600', nome: 'Ryzen 5 5600' },
    presetReferencia: 'low',
    fpsMinimo: 112,
  });
  // O jogo vai íntegro; só placa de vídeo e processador perdem o fabricante.
  assert.deepEqual(termos(), ['Elden Ring', 'GeForce RTX 4060', 'Ryzen 5 5600']);
});

test('processador Intel escrito com o fabricante resolve o mesmo slug', async () => {
  const { evidencia, termos } = buscar({
    jogo: 'Counter-Strike 2',
    placaVideo: 'AMD Radeon RX 6600',
    processador: 'Intel Core i5-12400F',
    resolucao: '2560x1440 (2K)',
  });

  assert.partialDeepStrictEqual(await evidencia, {
    correspondencia: 'completa',
    placaVideo: { slug: 'radeon-rx-6600', nome: 'Radeon RX 6600' },
    processador: { slug: 'core-i5-12400f', nome: 'Core i5-12400F' },
    presetReferencia: 'ultra',
    fpsMinimo: 122,
  });
  assert.deepEqual(termos(), ['Counter-Strike 2', 'Radeon RX 6600', 'Core i5-12400F']);
});

test('a fixture padrão do repo produz evidência completa ponta a ponta', async () => {
  // Jogo e hardware exatamente como o app sugere hoje: título sem a expansão e
  // hardware com o fabricante à frente. As duas correções se encontram aqui.
  const { evidencia, termos } = buscar({});

  assert.deepEqual(termos(), ['Cyberpunk 2077', 'GeForce RTX 4060', 'Ryzen 5 5600']);
  assert.partialDeepStrictEqual(await evidencia, {
    correspondencia: 'completa',
    jogo: { slug: 'cyberpunk-2077', nome: 'Cyberpunk 2077: Phantom Liberty' },
    presetReferencia: 'medium',
    fpsMinimo: 63,
  });
});

test('título cujo nome canônico traz a expansão resolve pelo slug', async () => {
  const { evidencia } = buscar({
    jogo: 'Cyberpunk 2077',
    placaVideo: 'GeForce RTX 4060',
    processador: 'Ryzen 5 5600',
    resolucao: '1920x1080 (Full HD)',
  });

  // Sete candidatos, todos com o título como prefixo: só o slug desempata.
  assert.partialDeepStrictEqual(await evidencia, {
    jogo: { slug: 'cyberpunk-2077', nome: 'Cyberpunk 2077: Phantom Liberty' },
    presetReferencia: 'medium',
    fpsMedio: 81,
    fpsMinimo: 63,
    fpsMaximo: 96,
  });
});

test('título cujo slug também traz a expansão resolve pelo sufixo de edição', async () => {
  const { evidencia } = buscar({
    jogo: 'The Witcher 3',
    placaVideo: 'GeForce RTX 4060',
    processador: 'Ryzen 5 5600',
    resolucao: '1920x1080 (Full HD)',
  });

  // Nem o `name` nem o slug (`the-witcher-3-wild-hunt`) são iguais ao termo:
  // sobra a regra do título expandido, com candidato único.
  assert.partialDeepStrictEqual(await evidencia, {
    jogo: { slug: 'the-witcher-3-wild-hunt', nome: 'The Witcher 3: Wild Hunt' },
    presetReferencia: 'ultra',
    fpsMinimo: 64,
  });
});

test('a sequência não é confundida com uma edição do jogo informado', async () => {
  const { evidencia, urls } = buscar({
    jogo: 'God of War',
    placaVideo: 'GeForce RTX 4060',
    processador: 'Ryzen 5 5600',
    resolucao: '1920x1080 (Full HD)',
  });

  // "God of War Ragnarok" é outro jogo, e o espaço antes de "Ragnarok" não é um
  // separador de edição. A igualdade resolve primeiro e as regras afrouxadas nem
  // chegam a ser tentadas.
  assert.partialDeepStrictEqual(await evidencia, {
    jogo: { slug: 'god-of-war-2018', nome: 'God of War' },
    presetReferencia: 'ultra',
    fpsMinimo: 76,
  });
  assert.ok(
    urls.filter((url) => url.pathname.endsWith('/fps'))
      .every((url) => url.searchParams.get('game') === 'god-of-war-2018'),
  );
});

// As cinco sugestões de processador do app que o FPSHQ não tem. Nenhuma regra de
// nome as alcança: a saída é a correspondência parcial, sem o processador.
for (const processador of [
  'AMD Ryzen 3 4100',
  'AMD Ryzen 5 4500',
  'AMD Ryzen 5 8600G',
  'AMD Ryzen 7 5700G',
  'AMD Ryzen 7 8700G',
] as const) {
  test(`${processador} está fora do catálogo e produz correspondência parcial`, async () => {
    const { evidencia } = buscar({
      jogo: 'Elden Ring',
      placaVideo: 'GeForce RTX 4060',
      processador,
      resolucao: '3840x2160 (4K)',
    });

    assert.partialDeepStrictEqual(await evidencia, {
      correspondencia: 'parcial',
      processador: null,
    });
  });
}

test('página cheia de resultados não afrouxa a correspondência de título', async () => {
  const { evidencia, urls } = buscar({
    jogo: 'Serious Sam',
    placaVideo: 'GeForce RTX 4060',
    processador: 'Ryzen 5 5600',
    resolucao: '1920x1080 (Full HD)',
  });

  // Entre os dez primeiros só "Serious Sam: The Random Encounter" tem sufixo de
  // edição; no catálogo inteiro são três. Numa página cheia não dá para afirmar
  // que o candidato é único, e escolher um deles seria medir outro jogo.
  assert.equal(await evidencia, null);
  assert.ok(!urls.some((url) => url.pathname.endsWith('/fps')));
});

test('placa dividida por memória de vídeo continua sendo descartada', async () => {
  const { evidencia, urls } = buscar({
    jogo: 'Elden Ring',
    placaVideo: 'NVIDIA GeForce GTX 1060',
    processador: 'Ryzen 5 5600',
    resolucao: '1920x1080 (Full HD)',
  });

  // O FPSHQ tem a GTX 1060 de 3GB e a de 6GB, com números diferentes, e o app
  // não pergunta a memória. Escolher uma seria inventar dado.
  assert.equal(await evidencia, null);
  assert.ok(!urls.some((url) => url.pathname.endsWith('/fps')));
});

/** Os slugs de jogo que saíram no `/fps` — é ali que a entidade escolhida aparece. */
function jogosConsultados(urls: readonly URL[]): string[] {
  return [...new Set(
    urls.filter((url) => url.pathname.endsWith('/fps'))
      .map((url) => url.searchParams.get('game') ?? ''),
  )];
}

test('apóstrofo trocado por traço no catálogo resolve pela regra do slug', async () => {
  const { evidencia, urls } = buscar({
    jogo: "Tom Clancy's Splinter Cell",
    placaVideo: 'GeForce RTX 4060',
    processador: 'Ryzen 5 5600',
    resolucao: '1920x1080 (Full HD)',
  });

  // Os três `name` da página terminam em `®`, então a igualdade não alcança
  // ninguém, e a página não veio cheia: a regra do slug decide, com
  // `tom-clancy-s-splinter-cell`. A massa não tem `/fps` para esse jogo, então a
  // evidência cai — o que este cenário fixa é a entidade escolhida.
  await evidencia;
  assert.deepEqual(jogosConsultados(urls), ['tom-clancy-s-splinter-cell']);
});

test('apóstrofo descartado no catálogo já vinha resolvido pela igualdade', async () => {
  const { evidencia, urls } = buscar({
    jogo: "Baldur's Gate 3",
    placaVideo: 'GeForce RTX 4060',
    processador: 'Ryzen 5 5600',
    resolucao: '1920x1080 (Full HD)',
  });

  // `baldurs-gate-3` é a forma que descarta o apóstrofo, a que `formasDeSlug`
  // passou a produzir. Aqui ela não muda nada: o `name` do catálogo é igual ao
  // termo digitado e a igualdade resolve antes de a regra do slug ter vez. É o
  // que acontece com todo título de apóstrofo em forma descartada que o serviço
  // devolve hoje — o `/search` casa `q` como substring literal do `name`, então
  // um termo que traz resultados traz também o `name` inteiro.
  await evidencia;
  assert.deepEqual(jogosConsultados(urls), ['baldurs-gate-3']);
});

test('as duas formas de apóstrofo na mesma página não resolvem nada', async () => {
  const { evidencia, urls } = buscar({
    jogo: "Baldur's Gate",
    placaVideo: 'GeForce RTX 4060',
    processador: 'Ryzen 5 5600',
    resolucao: '1920x1080 (Full HD)',
  });

  // A página traz `baldur-s-gate-dark-alliance` e `baldurs-gate-3` lado a lado:
  // o FPSHQ usa as duas formas. Nenhuma das duas é o slug do termo digitado, e o
  // título expandido alcança três candidatos — ambiguidade, que não resolve.
  assert.equal(await evidencia, null);
  assert.deepEqual(jogosConsultados(urls), []);
});

test('720p não chega a consultar o FPSHQ', async () => {
  const { evidencia, urls } = buscar({
    jogo: 'Elden Ring',
    placaVideo: 'GeForce RTX 4060',
    processador: 'Ryzen 5 5600',
    resolucao: '1280x720 (HD)',
  });

  assert.equal(await evidencia, null);
  assert.deepEqual(urls, []);
});
