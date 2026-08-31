import { ErroFonteConfiguracao, ErroFonteLimite, type Consulta, type Fonte } from './fonte';
import type { Resultado } from './schema';

export type ConsultaResultado =
  | { ok: true; resultado: Resultado }
  | { ok: false; erro: string };

const MENSAGEM_ERRO = 'Não foi possível gerar as configurações. Tente novamente.';

export async function resolverConsulta(
  consulta: Consulta,
  fontes: readonly Fonte[],
): Promise<ConsultaResultado> {
  let erroLimite: ErroFonteLimite | null = null;

  for (const fonte of fontes) {
    try {
      const resultado = await fonte.buscar(consulta);
      if (resultado) return { ok: true, resultado };
    } catch (erro) {
      if (erro instanceof ErroFonteConfiguracao) {
        console.error(`[resolverConsulta] ${erro.message}`);
        return { ok: false, erro: MENSAGEM_ERRO };
      }
      if (erro instanceof ErroFonteLimite) {
        console.error(`[resolverConsulta] ${erro.message}`);
        erroLimite = erro;
        continue;
      }
      console.error(`[resolverConsulta] Falha inesperada na fonte ${fonte.nome}:`, erro);
    }
  }
  if (erroLimite) {
    return { ok: false, erro: 'Limite de requisições atingido. Tente novamente em alguns segundos.' };
  }
  return { ok: false, erro: MENSAGEM_ERRO };
}
