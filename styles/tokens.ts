export const Cores = {
  fundoBase: '#0f0f1a',
  fundoCard: '#1a1a2e',
  fundoLinha: '#16213e',
  fundoBorda: '#2a2a4a',

  acento: '#00d4aa',
  acentoSombra: 'rgba(0, 212, 170, 0.15)',

  textoPrimario: '#f0f0f5',
  textoSecundario: '#a0a0b8',
  textoTerciario: '#606080',
  textoInverso: '#0f0f1a',

  erro: '#ff5c72',
  erroSombra: 'rgba(255, 92, 114, 0.15)',

  transparente: 'transparent',
} as const;

export const Espaco = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const Raio = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const Fonte = {
  tamanhoXs: 11,
  tamanhoSm: 13,
  tamanhoMd: 14,
  tamanhoLg: 16,
  tamanhoXl: 20,
  tamanhoDisplay: 28,

  pesoNormal: '400' as const,
  pesoMedio: '500' as const,
  pesoSemibold: '600' as const,
  pesoBold: '700' as const,

  alturaLinhaNormal: 20,
  alturaLinhaLarga: 24,
} as const;
