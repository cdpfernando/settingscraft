import { z } from 'zod';

export const CONTRATO_VERSAO = 1;

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

export interface Resultado extends RespostaIa {
  fonte: string;
  geradoEm: string;
  versaoContrato: number;
}

export const ResultadoSchema = RespostaIaSchema.extend({
  fonte: z.string(),
  geradoEm: z.string(),
  versaoContrato: z.literal(CONTRATO_VERSAO),
});
