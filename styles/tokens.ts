import { Platform } from 'react-native';

export const Cores = {
  fundoBase: '#141412',
  fundoCard: '#1c1c18',
  fundoLinha: '#242420',
  fundoBorda: '#33332c',

  acento: '#d4922a',
  acentoSuave: '#2a2414',

  textoPrimario: '#f3f1ea',
  textoSecundario: '#9c9a90',
  textoTerciario: '#6e6c64',
  textoInverso: '#141412',

  erro: '#d4534a',
  erroFundo: '#2a1614',

  transparente: 'transparent',
} as const;

export const Espaco = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Raio = {
  sm: 8,
  md: 8,
  lg: 24,
  pill: 999,
} as const;

export const Fonte = {
  tamanhoXs: 12,
  tamanhoSm: 13,
  tamanhoMd: 15,
  tamanhoLg: 17,
  tamanhoXl: 20,

  pesoNormal: '400' as const,
  pesoMedio: '500' as const,
  pesoSemibold: '600' as const,
  pesoBold: '700' as const,

  alturaLinhaNormal: 20,
  alturaLinhaLarga: 22,

  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  }) ?? 'monospace',
} as const;

export const Controle = {
  altura: 48,
  toqueMinimo: 44,
} as const;
