/**
 * Contrato tipado das recomendações de configuração gráfica.
 *
 * Zod é a fonte única de verdade: o schema declarado aqui também é usado para
 * derivar, em runtime, o JSON Schema enviado ao Gemini — nunca duas
 * declarações do mesmo contrato, que divergem e só se manifestam quando o
 * fallback dispara.
 */
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

/**
 * Nasce completo desde já — `fonte`, `geradoEm` e `versaoContrato` são
 * preenchidos pela fonte que respondeu, não pelo schema da IA, para que a
 * interface seja desenhada contra a forma final do dado mesmo enquanto só o
 * Gemini existe.
 */
export interface Resultado extends RespostaIa {
  fonte: string;
  geradoEm: string;
  versaoContrato: number;
}

/** Schema do dado completo salvo no cache. Derivado do contrato canônico da IA. */
export const ResultadoSchema = RespostaIaSchema.extend({
  fonte: z.string(),
  geradoEm: z.string(),
  versaoContrato: z.literal(CONTRATO_VERSAO),
});
