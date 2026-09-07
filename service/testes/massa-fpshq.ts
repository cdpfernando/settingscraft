/**
 * Massa de testes gravada da API pública do FPSHQ em 2026-09-06.
 *
 * Cada entrada é a resposta literal de `https://fpshq.com/api/v1/...`, capturada
 * com os mesmos parâmetros que `criarProvedorEvidenciaFpsHq` monta. Serve para
 * simular cenários com o comportamento real do serviço — inclusive os que
 * derrubam a evidência (hardware fora do catálogo) e os que só resolvem pelas
 * regras afrouxadas de título — sem depender de rede no teste.
 *
 * Para regravar, com o mesmo `limit` que o provedor envia:
 * `curl "https://fpshq.com/api/v1/search?q=<termo>&type=<tipo>&limit=10"`
 * e `curl "https://fpshq.com/api/v1/fps?game=<slug>&gpu=<slug>[&cpu=<slug>]&res=<res>&preset=<preset>"`.
 */

import type { TransporteHttp } from '../ai/fonte';

interface RespostaGravada {
  status: number;
  corpo: unknown;
}

/** `/search` responde 200 mesmo sem resultado; casa o termo como substring do `name`. */
const BUSCAS: Record<string, RespostaGravada> = {
  'game:Elden Ring': {
    status: 200,
    corpo: {
      ok: true,
      query: 'Elden Ring',
      count: 3,
      results: [
        { type: 'game', slug: 'elden-ring', name: 'Elden Ring', year: 2022, url: 'https://fpshq.com/games/elden-ring/' },
        { type: 'game', slug: 'elden-ring-shadow', name: 'Elden Ring: Shadow of the Erdtree', year: 2024, url: 'https://fpshq.com/games/elden-ring-shadow/' },
        { type: 'game', slug: 'elden-ring-nightreign', name: 'Elden Ring: Nightreign', year: 2025, url: 'https://fpshq.com/games/elden-ring-nightreign/' },
      ],
    },
  },
  'game:Counter-Strike 2': {
    status: 200,
    corpo: {
      ok: true,
      query: 'Counter-Strike 2',
      count: 1,
      results: [
        { type: 'game', slug: 'cs2', name: 'Counter-Strike 2', year: 2023, url: 'https://fpshq.com/games/cs2/' },
      ],
    },
  },
  // O slug canônico do jogo vem com o nome expandido: nenhum `name` é igual a
  // "Cyberpunk 2077", então a igualdade não casa e a regra do slug precisa resolver.
  'game:Cyberpunk 2077': {
    status: 200,
    corpo: {
      ok: true,
      query: 'Cyberpunk 2077',
      count: 7,
      results: [
        { type: 'game', slug: 'cyberpunk-2077', name: 'Cyberpunk 2077: Phantom Liberty', year: 2020, url: 'https://fpshq.com/games/cyberpunk-2077/' },
        { type: 'game', slug: 'cyberpunk-2077-phantom-liberty-game-of-the-year-edition', name: 'Cyberpunk 2077: Phantom Liberty: Game of the Year Edition', year: 2023, url: 'https://fpshq.com/games/cyberpunk-2077-phantom-liberty-game-of-the-year-edition/' },
        { type: 'game', slug: 'cyberpunk-2077-phantom-liberty-definitive-edition', name: 'Cyberpunk 2077: Phantom Liberty: Definitive Edition', year: 2023, url: 'https://fpshq.com/games/cyberpunk-2077-phantom-liberty-definitive-edition/' },
        { type: 'game', slug: 'cyberpunk-2077-phantom-liberty-complete-edition', name: 'Cyberpunk 2077: Phantom Liberty: Complete Edition', year: 2023, url: 'https://fpshq.com/games/cyberpunk-2077-phantom-liberty-complete-edition/' },
        { type: 'game', slug: 'cyberpunk-2077-phantom-liberty-deluxe-edition', name: 'Cyberpunk 2077: Phantom Liberty: Deluxe Edition', year: 2023, url: 'https://fpshq.com/games/cyberpunk-2077-phantom-liberty-deluxe-edition/' },
        { type: 'game', slug: 'cyberpunk-2077-phantom-liberty-ultimate-edition', name: 'Cyberpunk 2077: Phantom Liberty: Ultimate Edition', year: 2023, url: 'https://fpshq.com/games/cyberpunk-2077-phantom-liberty-ultimate-edition/' },
        { type: 'game', slug: 'cyberpunk-2077-phantom-liberty-remastered', name: 'Cyberpunk 2077: Phantom Liberty: Remastered', year: 2023, url: 'https://fpshq.com/games/cyberpunk-2077-phantom-liberty-remastered/' },
      ],
    },
  },
  // O nome canônico traz a expansão e o slug guarda o título digitado: nenhum
  // `name` é igual a "The Witcher 3", e o slug é `the-witcher-3-wild-hunt`.
  // Só a regra de título expandido alcança este caso.
  'game:The Witcher 3': {
    status: 200,
    corpo: {
      ok: true,
      query: 'The Witcher 3',
      count: 1,
      results: [
        { type: 'game', slug: 'the-witcher-3-wild-hunt', name: 'The Witcher 3: Wild Hunt', year: 2015, url: 'https://fpshq.com/games/the-witcher-3-wild-hunt/' },
      ],
    },
  },
  // O contraexemplo: "God of War Ragnarok" é outro jogo, não uma edição. A
  // igualdade resolve o primeiro e as regras afrouxadas nem chegam a ser tentadas.
  'game:God of War': {
    status: 200,
    corpo: {
      ok: true,
      query: 'God of War',
      count: 2,
      results: [
        { type: 'game', slug: 'god-of-war-2018', name: 'God of War', year: 2022, url: 'https://fpshq.com/games/god-of-war-2018/' },
        { type: 'game', slug: 'god-of-war-ragnarok', name: 'God of War Ragnarok', year: 2021, url: 'https://fpshq.com/games/god-of-war-ragnarok/' },
      ],
    },
  },
  // Página cheia. Entre os dez primeiros só "Serious Sam: The Random Encounter"
  // satisfaz a regra do título expandido; no catálogo inteiro são três
  // (`: The Random Encounter`, `: Kamikaze Attack!`, `: Siberian Mayhem`).
  // É o caso que obriga as regras afrouxadas a se calarem numa página truncada.
  'game:Serious Sam': {
    status: 200,
    corpo: {
      ok: true,
      query: "Serious Sam",
      count: 10,
      results: [
        { type: "game", slug: "serious-sam-hd-the-first-encounter", name: "Serious Sam HD: The First Encounter", year: 0, url: "https://fpshq.com/games/serious-sam-hd-the-first-encounter/" },
        { type: "game", slug: "serious-sam-hd-the-second-encounter", name: "Serious Sam HD: The Second Encounter", year: 0, url: "https://fpshq.com/games/serious-sam-hd-the-second-encounter/" },
        { type: "game", slug: "serious-sam-classic-the-first-encounter", name: "Serious Sam Classic: The First Encounter", year: 0, url: "https://fpshq.com/games/serious-sam-classic-the-first-encounter/" },
        { type: "game", slug: "serious-sam-classic-the-second-encounter", name: "Serious Sam Classic: The Second Encounter", year: 0, url: "https://fpshq.com/games/serious-sam-classic-the-second-encounter/" },
        { type: "game", slug: "serious-sam-3-bfe", name: "Serious Sam 3: BFE", year: 0, url: "https://fpshq.com/games/serious-sam-3-bfe/" },
        { type: "game", slug: "serious-sam-double-d-xxl", name: "Serious Sam Double D XXL", year: 0, url: "https://fpshq.com/games/serious-sam-double-d-xxl/" },
        { type: "game", slug: "serious-sam-the-random-encounter", name: "Serious Sam: The Random Encounter", year: 0, url: "https://fpshq.com/games/serious-sam-the-random-encounter/" },
        { type: "game", slug: "serious-sam-ii", name: "Serious Sam II", year: 0, url: "https://fpshq.com/games/serious-sam-ii/" },
        { type: "game", slug: "serious-sam-classics-revolution", name: "Serious Sam Classics: Revolution", year: 0, url: "https://fpshq.com/games/serious-sam-classics-revolution/" },
        { type: "game", slug: "serious-sam-4", name: "Serious Sam 4", year: 0, url: "https://fpshq.com/games/serious-sam-4/" },
      ],
    },
  },
  'game:VA-11 Hall-A: Cyberpunk Bartender Action': {
    status: 200,
    corpo: {
      ok: true,
      query: 'VA-11 Hall-A: Cyberpunk Bartender Action',
      count: 1,
      results: [
        { type: 'game', slug: 'va-11-hall-a-cyberpunk-bartender-action', name: 'VA-11 Hall-A: Cyberpunk Bartender Action', year: 0, url: 'https://fpshq.com/games/va-11-hall-a-cyberpunk-bartender-action/' },
      ],
    },
  },
  // As três buscas de apóstrofo, gravadas em 2026-09-07. O FPSHQ usa duas formas
  // de slug para o mesmo sinal: `baldurs-gate-3` descarta o apóstrofo,
  // `baldur-s-gate-dark-alliance` e `tom-clancy-s-splinter-cell` o trocam por
  // traço. A página de "Baldur's Gate" traz as duas lado a lado.
  "game:Baldur's Gate 3": {
    status: 200,
    corpo: {
      ok: true,
      query: "Baldur's Gate 3",
      count: 1,
      results: [
        { type: 'game', slug: 'baldurs-gate-3', name: "Baldur's Gate 3", year: 2023, url: 'https://fpshq.com/games/baldurs-gate-3/' },
      ],
    },
  },
  "game:Baldur's Gate": {
    status: 200,
    corpo: {
      ok: true,
      query: "Baldur's Gate",
      count: 5,
      results: [
        { type: 'game', slug: 'baldur-s-gate-ii-enhanced-edition', name: "Baldur's Gate II: Enhanced Edition", year: 0, url: 'https://fpshq.com/games/baldur-s-gate-ii-enhanced-edition/' },
        { type: 'game', slug: 'baldur-s-gate-dark-alliance', name: "Baldur's Gate: Dark Alliance", year: 0, url: 'https://fpshq.com/games/baldur-s-gate-dark-alliance/' },
        { type: 'game', slug: 'baldur-s-gate-dark-alliance-ii', name: "Baldur's Gate: Dark Alliance II", year: 0, url: 'https://fpshq.com/games/baldur-s-gate-dark-alliance-ii/' },
        { type: 'game', slug: 'baldurs-gate-3', name: "Baldur's Gate 3", year: 2023, url: 'https://fpshq.com/games/baldurs-gate-3/' },
        { type: 'game', slug: 'baldurs-gate-enhanced-edition', name: "Baldur's Gate: Enhanced Edition", year: 2022, url: 'https://fpshq.com/games/baldurs-gate-enhanced-edition/' },
      ],
    },
  },
  // Os três `name` terminam em `®`, então a igualdade não alcança ninguém e quem
  // resolve é a regra do slug — na forma com traço.
  "game:Tom Clancy's Splinter Cell": {
    status: 200,
    corpo: {
      ok: true,
      query: "Tom Clancy's Splinter Cell",
      count: 3,
      results: [
        { type: 'game', slug: 'tom-clancy-s-splinter-cell', name: "Tom Clancy's Splinter Cell®", year: 0, url: 'https://fpshq.com/games/tom-clancy-s-splinter-cell/' },
        { type: 'game', slug: 'tom-clancy-s-splinter-cell-chaos-theory', name: "Tom Clancy's Splinter Cell Chaos Theory®", year: 0, url: 'https://fpshq.com/games/tom-clancy-s-splinter-cell-chaos-theory/' },
        { type: 'game', slug: 'tom-clancy-s-splinter-cell-double-agent', name: "Tom Clancy's Splinter Cell Double Agent®", year: 0, url: 'https://fpshq.com/games/tom-clancy-s-splinter-cell-double-agent/' },
      ],
    },
  },
  'gpu:GeForce RTX 4060': {
    status: 200,
    corpo: {
      ok: true,
      query: "GeForce RTX 4060",
      count: 10,
      results: [
        { type: "gpu", slug: "rtx-4060", name: "GeForce RTX 4060", bench_score: 3700, url: "https://fpshq.com/gpu/rtx-4060/" },
        { type: "gpu", slug: "rtx-4060-ti", name: "GeForce RTX 4060 Ti", bench_score: 4400, url: "https://fpshq.com/gpu/rtx-4060-ti/" },
        { type: "gpu", slug: "geforce-rtx-4060-laptop", name: "GeForce RTX 4060 Laptop", bench_score: 3000, url: "https://fpshq.com/gpu/geforce-rtx-4060-laptop/" },
        { type: "gpu", slug: "rtx-4060-ti-16gb", name: "GeForce RTX 4060 Ti 16GB", bench_score: 4500, url: "https://fpshq.com/gpu/rtx-4060-ti-16gb/" },
        { type: "gpu", slug: "kfa2-ex-geforce-rtx-4060", name: "KFA2 EX GeForce RTX 4060", bench_score: 4250, url: "https://fpshq.com/gpu/kfa2-ex-geforce-rtx-4060/" },
        { type: "gpu", slug: "pny-xlr8-geforce-rtx-4060", name: "PNY XLR8 GeForce RTX 4060", bench_score: 4221, url: "https://fpshq.com/gpu/pny-xlr8-geforce-rtx-4060/" },
        { type: "gpu", slug: "asus-dual-geforce-rtx-4060", name: "ASUS Dual GeForce RTX 4060", bench_score: 4221, url: "https://fpshq.com/gpu/asus-dual-geforce-rtx-4060/" },
        { type: "gpu", slug: "pny-verto-geforce-rtx-4060", name: "PNY Verto GeForce RTX 4060", bench_score: 4200, url: "https://fpshq.com/gpu/pny-verto-geforce-rtx-4060/" },
        { type: "gpu", slug: "kfa2-ex-geforce-rtx-4060-ti", name: "KFA2 EX GeForce RTX 4060 Ti", bench_score: 4554, url: "https://fpshq.com/gpu/kfa2-ex-geforce-rtx-4060-ti/" },
        { type: "gpu", slug: "pny-xlr8-geforce-rtx-4060-ti", name: "PNY XLR8 GeForce RTX 4060 Ti", bench_score: 4522, url: "https://fpshq.com/gpu/pny-xlr8-geforce-rtx-4060-ti/" },
      ],
    },
  },
  // A sugestão `NVIDIA GeForce GTX 1060` do app não tem equivalente único: o
  // FPSHQ divide a placa por memória de vídeo (3GB e 6GB rendem números
  // diferentes) e o app não coleta esse dado. Continua sendo descartada.
  'gpu:GeForce GTX 1060': {
    status: 200,
    corpo: {
      ok: true,
      query: "GeForce GTX 1060",
      count: 10,
      results: [
        { type: "gpu", slug: "gtx-1060-6gb", name: "GeForce GTX 1060 6GB", bench_score: 1500, url: "https://fpshq.com/gpu/gtx-1060-6gb/" },
        { type: "gpu", slug: "geforce-gtx-1060-3gb", name: "GeForce GTX 1060 3GB", bench_score: 1250, url: "https://fpshq.com/gpu/geforce-gtx-1060-3gb/" },
        { type: "gpu", slug: "geforce-gtx-1060-laptop", name: "GeForce GTX 1060 Laptop", bench_score: 1200, url: "https://fpshq.com/gpu/geforce-gtx-1060-laptop/" },
        { type: "gpu", slug: "kfa2-ex-geforce-gtx-1060-6gb", name: "KFA2 EX GeForce GTX 1060 6GB", bench_score: 1416, url: "https://fpshq.com/gpu/kfa2-ex-geforce-gtx-1060-6gb/" },
        { type: "gpu", slug: "kfa2-ex-geforce-gtx-1060-3gb", name: "KFA2 EX GeForce GTX 1060 3GB", bench_score: 1265, url: "https://fpshq.com/gpu/kfa2-ex-geforce-gtx-1060-3gb/" },
        { type: "gpu", slug: "pny-xlr8-geforce-gtx-1060-6gb", name: "PNY XLR8 GeForce GTX 1060 6GB", bench_score: 1406, url: "https://fpshq.com/gpu/pny-xlr8-geforce-gtx-1060-6gb/" },
        { type: "gpu", slug: "pny-xlr8-geforce-gtx-1060-3gb", name: "PNY XLR8 GeForce GTX 1060 3GB", bench_score: 1256, url: "https://fpshq.com/gpu/pny-xlr8-geforce-gtx-1060-3gb/" },
        { type: "gpu", slug: "asus-dual-geforce-gtx-1060-6gb", name: "ASUS Dual GeForce GTX 1060 6GB", bench_score: 1406, url: "https://fpshq.com/gpu/asus-dual-geforce-gtx-1060-6gb/" },
        { type: "gpu", slug: "pny-verto-geforce-gtx-1060-6gb", name: "PNY Verto GeForce GTX 1060 6GB", bench_score: 1400, url: "https://fpshq.com/gpu/pny-verto-geforce-gtx-1060-6gb/" },
        { type: "gpu", slug: "asus-dual-geforce-gtx-1060-3gb", name: "ASUS Dual GeForce GTX 1060 3GB", bench_score: 1256, url: "https://fpshq.com/gpu/asus-dual-geforce-gtx-1060-3gb/" },
      ],
    },
  },
  'gpu:Radeon RX 6600': {
    status: 200,
    corpo: {
      ok: true,
      query: 'Radeon RX 6600',
      count: 10,
      results: [
        { type: 'gpu', slug: 'radeon-rx-6600', name: 'Radeon RX 6600', bench_score: 2700, url: 'https://fpshq.com/gpu/radeon-rx-6600/' },
        { type: 'gpu', slug: 'radeon-rx-6600m', name: 'Radeon RX 6600M', bench_score: 2600, url: 'https://fpshq.com/gpu/radeon-rx-6600m/' },
        { type: 'gpu', slug: 'rx-6600-xt', name: 'Radeon RX 6600 XT', bench_score: 3300, url: 'https://fpshq.com/gpu/rx-6600-xt/' },
        { type: 'gpu', slug: 'asrock-taichi-radeon-rx-6600', name: 'ASRock Taichi Radeon RX 6600', bench_score: 2775, url: 'https://fpshq.com/gpu/asrock-taichi-radeon-rx-6600/' },
        { type: 'gpu', slug: 'asus-rog-strix-radeon-rx-6600', name: 'ASUS ROG Strix Radeon RX 6600', bench_score: 2781, url: 'https://fpshq.com/gpu/asus-rog-strix-radeon-rx-6600/' },
        { type: 'gpu', slug: 'sapphire-pulse-radeon-rx-6600', name: 'Sapphire Pulse Radeon RX 6600', bench_score: 2700, url: 'https://fpshq.com/gpu/sapphire-pulse-radeon-rx-6600/' },
        { type: 'gpu', slug: 'sapphire-nitro-radeon-rx-6600', name: 'Sapphire Nitro+ Radeon RX 6600', bench_score: 2781, url: 'https://fpshq.com/gpu/sapphire-nitro-radeon-rx-6600/' },
        { type: 'gpu', slug: 'msi-gaming-trio-radeon-rx-6600', name: 'MSI Gaming Trio Radeon RX 6600', bench_score: 2759, url: 'https://fpshq.com/gpu/msi-gaming-trio-radeon-rx-6600/' },
        { type: 'gpu', slug: 'asus-tuf-gaming-radeon-rx-6600', name: 'ASUS TUF Gaming Radeon RX 6600', bench_score: 2754, url: 'https://fpshq.com/gpu/asus-tuf-gaming-radeon-rx-6600/' },
        { type: 'gpu', slug: 'asrock-taichi-radeon-rx-6600-xt', name: 'ASRock Taichi Radeon RX 6600 XT', bench_score: 2981, url: 'https://fpshq.com/gpu/asrock-taichi-radeon-rx-6600-xt/' },
      ],
    },
  },
  'cpu:Ryzen 5 5600': {
    status: 200,
    corpo: {
      ok: true,
      query: "Ryzen 5 5600",
      count: 10,
      results: [
        { type: "cpu", slug: "ryzen-5-5600", name: "Ryzen 5 5600", bench_score: 4000, url: "https://fpshq.com/cpu/ryzen-5-5600/" },
        { type: "cpu", slug: "ryzen-5-5600x", name: "Ryzen 5 5600X", bench_score: 4200, url: "https://fpshq.com/cpu/ryzen-5-5600x/" },
        { type: "cpu", slug: "ryzen-5-5600g", name: "Ryzen 5 5600G", bench_score: 3520, url: "https://fpshq.com/cpu/ryzen-5-5600g/" },
        { type: "cpu", slug: "ryzen-5-5600h", name: "Ryzen 5 5600H", bench_score: 2800, url: "https://fpshq.com/cpu/ryzen-5-5600h/" },
        { type: "cpu", slug: "ryzen-5-5600xt", name: "Ryzen 5 5600XT", bench_score: 4160, url: "https://fpshq.com/cpu/ryzen-5-5600xt/" },
        { type: "cpu", slug: "ryzen-5-5600xg", name: "Ryzen 5 5600XG", bench_score: 3696, url: "https://fpshq.com/cpu/ryzen-5-5600xg/" },
        { type: "cpu", slug: "ryzen-5-5600ge", name: "Ryzen 5 5600GE", bench_score: 3120, url: "https://fpshq.com/cpu/ryzen-5-5600ge/" },
        { type: "cpu", slug: "ryzen-5-5600xxt", name: "Ryzen 5 5600XXT", bench_score: 4368, url: "https://fpshq.com/cpu/ryzen-5-5600xxt/" },
        { type: "cpu", slug: "ryzen-5-5600xge", name: "Ryzen 5 5600XGE", bench_score: 3276, url: "https://fpshq.com/cpu/ryzen-5-5600xge/" },
        { type: "cpu", slug: "ryzen-5-5600-box", name: "Ryzen 5 5600 Box", bench_score: 4000, url: "https://fpshq.com/cpu/ryzen-5-5600-box/" },
      ],
    },
  },
  'cpu:Core i5-12400F': {
    status: 200,
    corpo: {
      ok: true,
      query: "Core i5-12400F",
      count: 10,
      results: [
        { type: "cpu", slug: "core-i5-12400f", name: "Core i5-12400F", bench_score: 3800, url: "https://fpshq.com/cpu/core-i5-12400f/" },
        { type: "cpu", slug: "core-i5-12400ft", name: "Core i5-12400FT", bench_score: 3116, url: "https://fpshq.com/cpu/core-i5-12400ft/" },
        { type: "cpu", slug: "core-i5-12400fte", name: "Core i5-12400FTE", bench_score: 3040, url: "https://fpshq.com/cpu/core-i5-12400fte/" },
        { type: "cpu", slug: "core-i5-12400f-box", name: "Core i5-12400F Box", bench_score: 3800, url: "https://fpshq.com/cpu/core-i5-12400f-box/" },
        { type: "cpu", slug: "core-i5-12400f-tray", name: "Core i5-12400F Tray", bench_score: 3800, url: "https://fpshq.com/cpu/core-i5-12400f-tray/" },
        { type: "cpu", slug: "core-i5-12400ft-box", name: "Core i5-12400FT Box", bench_score: 3116, url: "https://fpshq.com/cpu/core-i5-12400ft-box/" },
        { type: "cpu", slug: "core-i5-12400f-rev-2", name: "Core i5-12400F Rev.2", bench_score: 3838, url: "https://fpshq.com/cpu/core-i5-12400f-rev-2/" },
        { type: "cpu", slug: "core-i5-12400f-oem", name: "Core i5-12400F (OEM)", bench_score: 3762, url: "https://fpshq.com/cpu/core-i5-12400f-oem/" },
        { type: "cpu", slug: "core-i5-12400ft-tray", name: "Core i5-12400FT Tray", bench_score: 3116, url: "https://fpshq.com/cpu/core-i5-12400ft-tray/" },
        { type: "cpu", slug: "core-i5-12400fte-box", name: "Core i5-12400FTE Box", bench_score: 3040, url: "https://fpshq.com/cpu/core-i5-12400fte-box/" },
      ],
    },
  },
};

/**
 * Termos com fabricante no começo: a API devolve `results: []` porque casa o
 * termo como substring do `name`, e nenhum `name` do catálogo traz o fabricante.
 * O provedor remove o fabricante antes de montar o `q`, então estas entradas
 * ficam como guarda: se a remoção voltar a escapar do termo de busca, a busca
 * volta vazia e o cenário que dependia dela falha.
 *
 * Os cinco Ryzen são de outra natureza — o termo já vai sem fabricante e mesmo
 * assim volta vazio, porque o processador não está no catálogo do FPSHQ. São as
 * cinco sugestões do app que a normalização não alcança, e o que mantém a
 * correspondência `parcial` viva. Conferidos em 2026-09-07: `count: 0` nos cinco.
 */
const BUSCAS_SEM_RESULTADO: readonly string[] = [
  'gpu:NVIDIA GeForce RTX 4060',
  'gpu:NVIDIA RTX 4060',
  'gpu:AMD Radeon RX 6600',
  'cpu:AMD Ryzen 5 5600',
  'cpu:Intel Core i5-12400F',
  'cpu:Intel Core i5 12400F',
  'cpu:Ryzen 3 4100',
  'cpu:Ryzen 5 4500',
  'cpu:Ryzen 5 8600G',
  'cpu:Ryzen 7 5700G',
  'cpu:Ryzen 7 8700G',
];

const JOGO_ELDEN = { slug: 'elden-ring', name: 'Elden Ring' };
const JOGO_CS2 = { slug: 'cs2', name: 'Counter-Strike 2' };
const JOGO_VA11 = {
  slug: 'va-11-hall-a-cyberpunk-bartender-action',
  name: 'VA-11 Hall-A: Cyberpunk Bartender Action',
};
const JOGO_GOW = { slug: 'god-of-war-2018', name: 'God of War' };
const JOGO_WITCHER = { slug: 'the-witcher-3-wild-hunt', name: 'The Witcher 3: Wild Hunt' };
const JOGO_CYBERPUNK = { slug: 'cyberpunk-2077', name: 'Cyberpunk 2077: Phantom Liberty' };
const GPU_4060 = { slug: 'rtx-4060', name: 'GeForce RTX 4060' };
const GPU_6600 = { slug: 'radeon-rx-6600', name: 'Radeon RX 6600' };
const CPU_5600 = { slug: 'ryzen-5-5600', name: 'Ryzen 5 5600' };
const CPU_12400F = { slug: 'core-i5-12400f', name: 'Core i5-12400F' };

/** `/fps`, chaveado por `game|gpu|cpu|res|preset` (cpu vazio quando não enviado). */
const MEDICOES: Record<string, RespostaGravada> = {};

function gravarMedicao(chave: string, corpo: Record<string, unknown>): void {
  MEDICOES[chave] = { status: 200, corpo };
}

// Cenário A — Elden Ring @ 1080p, benchmark, correspondência completa.
// medium/high/ultra repetem a mesma medição; só `low` bate a meta de 60 fps mínimos.
([
  ['low', 143, 112, 169, 'excellent'],
  ['medium', 60, 47, 71, 'good'],
  ['high', 60, 47, 71, 'good'],
  ['ultra', 60, 47, 71, 'good'],
] as const).forEach(([preset, fps, fpsMinimo, fpsMaximo, verdict]) => {
  gravarMedicao(`elden-ring|rtx-4060|ryzen-5-5600|1080p|${preset}`, {
    ok: true,
    game: JOGO_ELDEN,
    gpu: GPU_4060,
    cpu: CPU_5600,
    resolution: '1080p',
    preset,
    fps,
    fps_min: fpsMinimo,
    fps_max: fpsMaximo,
    verdict,
    source: 'benchmark',
    bottleneck: { limited_by: 'GPU', pct: 12, gpu_load_pct: 100 },
    url: 'https://fpshq.com/games/elden-ring/',
  });
});

// Cenário B — CS2 @ 1440p, benchmark, completa. Curva não monotônica:
// `high` e `ultra` rendem mais que `low`/`medium`, e `ultra` bate a meta.
([
  ['low', 119, 93, 140, 'good'],
  ['medium', 93, 73, 110, 'good'],
  ['high', 184, 144, 217, 'excellent'],
  ['ultra', 156, 122, 184, 'excellent'],
] as const).forEach(([preset, fps, fpsMinimo, fpsMaximo, verdict]) => {
  gravarMedicao(`cs2|radeon-rx-6600|core-i5-12400f|1440p|${preset}`, {
    ok: true,
    game: JOGO_CS2,
    gpu: GPU_6600,
    cpu: CPU_12400F,
    resolution: '1440p',
    preset,
    fps,
    fps_min: fpsMinimo,
    fps_max: fpsMaximo,
    verdict,
    source: 'benchmark',
    bottleneck: { limited_by: 'GPU', pct: 40, gpu_load_pct: 100 },
    url: 'https://fpshq.com/games/cs2/',
  });
});

// Cenário C — Elden Ring @ 4K sem cpu: nenhum preset chega aos 60 fps mínimos.
// A resposta omite `cpu` por completo quando o parâmetro não é enviado.
([
  ['low', 51, 40, 60],
  ['medium', 40, 31, 47],
  ['high', 35, 27, 41],
  ['ultra', 30, 23, 35],
] as const).forEach(([preset, fps, fpsMinimo, fpsMaximo]) => {
  gravarMedicao(`elden-ring|rtx-4060||4K|${preset}`, {
    ok: true,
    game: JOGO_ELDEN,
    gpu: GPU_4060,
    resolution: '4K',
    preset,
    fps,
    fps_min: fpsMinimo,
    fps_max: fpsMaximo,
    verdict: 'playable',
    source: 'benchmark',
    url: 'https://fpshq.com/games/elden-ring/',
  });
});

// Cenário D — jogo sem benchmark medido: `source: "prediction"` e o mesmo número
// em todos os presets. Sem cpu na consulta, vira correspondência parcial.
(['low', 'medium', 'high', 'ultra'] as const).forEach((preset) => {
  gravarMedicao(`va-11-hall-a-cyberpunk-bartender-action|radeon-rx-6600||1080p|${preset}`, {
    ok: true,
    game: JOGO_VA11,
    gpu: GPU_6600,
    resolution: '1080p',
    preset,
    fps: 77,
    fps_min: 60,
    fps_max: 91,
    verdict: 'good',
    source: 'prediction',
    url: 'https://fpshq.com/games/va-11-hall-a-cyberpunk-bartender-action/',
  });
});

// Cenário E — The Witcher 3 @ 1080p: todos os presets batem a meta, então a
// escolha é `ultra`. Serve à correspondência por título expandido.
([
  ['low', 139, 108, 164, 'excellent'],
  ['medium', 108, 84, 127, 'good'],
  ['high', 94, 73, 111, 'good'],
  ['ultra', 82, 64, 97, 'good'],
] as const).forEach(([preset, fps, fpsMinimo, fpsMaximo, verdict]) => {
  gravarMedicao(`the-witcher-3-wild-hunt|rtx-4060|ryzen-5-5600|1080p|${preset}`, {
    ok: true,
    game: JOGO_WITCHER,
    gpu: GPU_4060,
    cpu: CPU_5600,
    resolution: '1080p',
    preset,
    fps,
    fps_min: fpsMinimo,
    fps_max: fpsMaximo,
    verdict,
    source: 'benchmark',
    bottleneck: { limited_by: 'GPU', pct: 12, gpu_load_pct: 100 },
    url: 'https://fpshq.com/games/the-witcher-3-wild-hunt/',
  });
});

// Cenário F — Cyberpunk 2077 @ 1080p: `medium` é o maior preset na meta.
// Serve à correspondência por slug, já que o `name` canônico traz a expansão.
([
  ['low', 104, 81, 123],
  ['medium', 81, 63, 96],
  ['high', 70, 55, 83],
  ['ultra', 61, 48, 72],
] as const).forEach(([preset, fps, fpsMinimo, fpsMaximo]) => {
  gravarMedicao(`cyberpunk-2077|rtx-4060|ryzen-5-5600|1080p|${preset}`, {
    ok: true,
    game: JOGO_CYBERPUNK,
    gpu: GPU_4060,
    cpu: CPU_5600,
    resolution: '1080p',
    preset,
    fps,
    fps_min: fpsMinimo,
    fps_max: fpsMaximo,
    verdict: 'good',
    source: 'benchmark',
    bottleneck: { limited_by: 'GPU', pct: 12, gpu_load_pct: 100 },
    url: 'https://fpshq.com/games/cyberpunk-2077/',
  });
});

// Cenário G — God of War @ 1080p. Só existe para provar que a evidência sai pelo
// slug do jogo informado, e nunca pelo da sequência (`god-of-war-ragnarok`).
([
  ['low', 158, 123, 186, 'excellent'],
  ['medium', 138, 108, 163, 'excellent'],
  ['high', 116, 90, 137, 'good'],
  ['ultra', 98, 76, 116, 'good'],
] as const).forEach(([preset, fps, fpsMinimo, fpsMaximo, verdict]) => {
  gravarMedicao(`god-of-war-2018|rtx-4060|ryzen-5-5600|1080p|${preset}`, {
    ok: true,
    game: JOGO_GOW,
    gpu: GPU_4060,
    cpu: CPU_5600,
    resolution: '1080p',
    preset,
    fps,
    fps_min: fpsMinimo,
    fps_max: fpsMaximo,
    verdict,
    source: 'benchmark',
    bottleneck: { limited_by: 'GPU', pct: 12, gpu_load_pct: 100 },
    url: 'https://fpshq.com/games/god-of-war-2018/',
  });
});

const BUSCA_VAZIA: RespostaGravada = {
  status: 200,
  corpo: { ok: true, query: '', count: 0, results: [] },
};

/** `/fps` com slug fora do catálogo: 404 com `ok: false`. */
const SLUG_DESCONHECIDO: RespostaGravada = {
  status: 404,
  corpo: { ok: false, error: 'Game not found. Use /search?q=&type=game to find slugs.' },
};

function responder({ status, corpo }: RespostaGravada): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface TransporteFpsHqGravado {
  transporte: TransporteHttp;
  /** URLs pedidas, na ordem, para conferir a montagem da chamada. */
  urls: URL[];
}

/**
 * Transporte que replica a API do FPSHQ a partir da massa gravada. Termo de busca
 * ou combinação de slugs fora da massa recebem a mesma resposta que o serviço real
 * dá: busca vazia (200) ou 404 em `/fps`.
 */
export function criarTransporteFpsHqGravado(): TransporteFpsHqGravado {
  const urls: URL[] = [];

  const transporte: TransporteHttp = async (entrada, init) => {
    const url = new URL(String(entrada));
    urls.push(url);
    init?.signal?.throwIfAborted();

    if (url.pathname.endsWith('/search')) {
      const chave = `${url.searchParams.get('type')}:${url.searchParams.get('q')}`;
      if (BUSCAS_SEM_RESULTADO.includes(chave)) return responder(BUSCA_VAZIA);

      return responder(BUSCAS[chave] ?? BUSCA_VAZIA);
    }

    const chave = [
      url.searchParams.get('game') ?? '',
      url.searchParams.get('gpu') ?? '',
      url.searchParams.get('cpu') ?? '',
      url.searchParams.get('res') ?? '',
      url.searchParams.get('preset') ?? '',
    ].join('|');

    return responder(MEDICOES[chave] ?? SLUG_DESCONHECIDO);
  };

  return { transporte, urls };
}
