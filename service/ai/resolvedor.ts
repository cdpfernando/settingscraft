import {
  ErroFonteConfiguracao,
  ErroFonteLimite,
  type Consulta,
  type Fonte,
  type Gerador,
  type ProvedorEvidencia,
} from './fonte';
import type { Resultado } from './schema';

export type ConsultaResultado =
  | { ok: true; resultado: Resultado }
  | { ok: false; erro: string };

const MENSAGEM_ERRO = 'Não foi possível gerar as configurações. Tente novamente.';

export interface EtapasConsulta<TEvidencia = unknown> {
  caches: readonly Fonte[];
  provedorEvidencia?: ProvedorEvidencia<TEvidencia>;
  geradores: readonly Gerador<TEvidencia>[];
}

export async function resolverConsulta<TEvidencia = unknown>(
  consulta: Consulta,
  etapas: EtapasConsulta<TEvidencia>,
): Promise<ConsultaResultado> {
  let erroLimite: ErroFonteLimite | null = null;

  for (const fonte of etapas.caches) {
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

  let evidencia: TEvidencia | undefined;
  if (etapas.provedorEvidencia) {
    try {
      evidencia = (await etapas.provedorEvidencia.buscar(consulta)) ?? undefined;
    } catch (erro) {
      console.error(
        `[resolverConsulta] Falha inesperada no provedor de evidência ${etapas.provedorEvidencia.nome}:`,
        erro,
      );
    }
  }

  for (const gerador of etapas.geradores) {
    try {
      const resultado = await gerador.gerar({ consulta, evidencia });
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
      console.error(`[resolverConsulta] Falha inesperada no gerador ${gerador.nome}:`, erro);
    }
  }

  if (erroLimite) {
    return { ok: false, erro: 'Limite de requisições atingido. Tente novamente em alguns segundos.' };
  }
  return { ok: false, erro: MENSAGEM_ERRO };
}
