import type { ConfiancaFps, PresetReferencia } from './schema';

const ROTULOS_PRESET: Record<PresetReferencia, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  ultra: 'Ultra',
};

const ROTULOS_CONFIANCA: Record<ConfiancaFps, string> = {
  media: 'média',
  baixa: 'baixa',
};

export function formatarPresetFpsHq(preset: PresetReferencia): string {
  return ROTULOS_PRESET[preset];
}

export function formatarConfiancaFps(confianca: ConfiancaFps): string {
  return ROTULOS_CONFIANCA[confianca];
}
