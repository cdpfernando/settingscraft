import { ErroFonteConfiguracao, type Consulta, type Fonte } from './fonte';
import type { Resultado } from './schema';

export type ConsultaResultado =
  | { ok: true; resultado: Resultado }
  | { ok: false; erro: string };

const MENSAGEM_ERRO = 'Não foi possível gerar as configurações. Tente novamente.';

/** Percorre a cadeia na ordem recebida e retorna o primeiro resultado válido. */
export async function resolverConsulta(
  consulta: Consulta,
  fontes: readonly Fonte[],
): Promise<ConsultaResultado> {
  for (const fonte of fontes) {
    try {
      const resultado = await fonte.buscar(consulta);
      if (resultado) return { ok: true, resultado };
    } catch (erro) {
      if (erro instanceof ErroFonteConfiguracao) {
        console.error(`[resolverConsulta] ${erro.message}`);
        return { ok: false, erro: MENSAGEM_ERRO };
      }
      console.error(`[resolverConsulta] Falha inesperada na fonte ${fonte.nome}:`, erro);
    }
  }
  return { ok: false, erro: MENSAGEM_ERRO };
}
