import { z } from 'zod';

export const CONTRATO_VERSAO = 2;

export const ConfiguracaoSchema = z.object({
  nome: z.string(),
  valor: z.string(),
  justificativa: z.string(),
});

export const RespostaIaSchema = z.object({
  configuracoes: z.array(ConfiguracaoSchema),
  fpsEstimado: z.string(),
});

export type RespostaIa = z.infer<typeof RespostaIaSchema>;

const ReferenciaFpsHqSchema = z.object({
  slug: z.string().min(1),
  nome: z.string().min(1),
});

export const UrlAtribuicaoFpsHqSchema = z.url().refine((valor) => {
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' && (url.hostname === 'fpshq.com' || url.hostname.endsWith('.fpshq.com'));
  } catch {
    return false;
  }
}, 'A URL de atribuição precisa pertencer ao FPSHQ.');

export const PresetReferenciaSchema = z.enum(['low', 'medium', 'high', 'ultra']);
export type PresetReferencia = z.infer<typeof PresetReferenciaSchema>;

export const EvidenciaDesempenhoSchema = z.object({
  fonte: z.literal('fpshq'),
  tipo: z.enum(['benchmark', 'predicao']),
  correspondencia: z.enum(['completa', 'parcial']),
  urlAtribuicao: UrlAtribuicaoFpsHqSchema,
  consultadoEm: z.iso.datetime(),
  jogo: ReferenciaFpsHqSchema,
  placaVideo: ReferenciaFpsHqSchema,
  processador: ReferenciaFpsHqSchema.nullable(),
  resolucao: z.enum(['1080p', '1440p', '4K']),
  presetReferencia: PresetReferenciaSchema,
  fpsMedio: z.number().nonnegative(),
  fpsMinimo: z.number().nonnegative(),
  fpsMaximo: z.number().nonnegative(),
}).superRefine((evidencia, contexto) => {
  if (evidencia.correspondencia === 'completa' && evidencia.processador === null) {
    contexto.addIssue({
      code: 'custom',
      path: ['processador'],
      message: 'Correspondência completa exige processador.',
    });
  }

  if (evidencia.correspondencia === 'parcial' && evidencia.processador !== null) {
    contexto.addIssue({
      code: 'custom',
      path: ['processador'],
      message: 'Correspondência parcial exige processador ausente.',
    });
  }
});

export type EvidenciaDesempenho = z.infer<typeof EvidenciaDesempenhoSchema>;

export const GeradoPorSchema = z.enum(['gemini', 'groq', 'exemplo']);
export type GeradoPor = z.infer<typeof GeradoPorSchema>;

export const ConfiancaFpsSchema = z.enum(['media', 'baixa']);
export type ConfiancaFps = z.infer<typeof ConfiancaFpsSchema>;

export const FonteEntregaSchema = z.enum([
  'salvo',
  'compartilhado',
  'gemini',
  'groq',
  'exemplo',
]);
export type FonteEntrega = z.infer<typeof FonteEntregaSchema>;

export const ResultadoSchema = RespostaIaSchema.extend({
  fonte: FonteEntregaSchema,
  geradoEm: z.iso.datetime(),
  versaoContrato: z.literal(CONTRATO_VERSAO),
  geradoPor: GeradoPorSchema,
  confiancaFps: ConfiancaFpsSchema,
  evidenciaDesempenho: EvidenciaDesempenhoSchema.nullable(),
}).superRefine((resultado, contexto) => {
  const evidenciaMediaValida = resultado.evidenciaDesempenho?.tipo === 'benchmark'
    && resultado.evidenciaDesempenho.correspondencia === 'completa'
    && resultado.evidenciaDesempenho.processador !== null;

  if (resultado.confiancaFps === 'media' && !evidenciaMediaValida) {
    contexto.addIssue({
      code: 'custom',
      path: ['confiancaFps'],
      message: 'Confiança média exige benchmark com correspondência completa e processador.',
    });
  }
});

export type Resultado = z.infer<typeof ResultadoSchema>;

export function criarResultadoGerado(
  resposta: RespostaIa,
  geradoPor: GeradoPor,
  evidencia?: EvidenciaDesempenho,
): Resultado {
  const resultado: Resultado = {
    ...resposta,
    fonte: geradoPor,
    geradoPor,
    geradoEm: new Date().toISOString(),
    versaoContrato: CONTRATO_VERSAO,
    confiancaFps:
      evidencia?.tipo === 'benchmark' && evidencia.correspondencia === 'completa'
        ? 'media'
        : 'baixa',
    evidenciaDesempenho: evidencia ?? null,
  };

  ResultadoSchema.parse(resultado);
  return resultado;
}
