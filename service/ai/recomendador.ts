import type { ConsultaConfiguracoes } from '../consulta-configuracoes';
import { ErroFonteConfiguracao, ErroFonteLimite, type Gerador, type ProvedorEvidencia } from './fonte';
import {
  CONTRATO_VERSAO,
  ResultadoSchema,
  type EvidenciaDesempenho,
  type GeradoPor,
  type RespostaIa,
  type Resultado,
} from './schema';

export type ConsultaResultado =
  | { ok: true; resultado: Resultado }
  | { ok: false; erro: string };

export interface OpcoesConsulta {
  forcarNovaRecomendacao?: boolean;
}

export interface CacheRecomendacao {
  buscar(consulta: ConsultaConfiguracoes): Promise<Resultado | null>;
  salvar(consulta: ConsultaConfiguracoes, resultado: Resultado): Promise<void>;
}

export interface AdaptadoresRecomendador {
  cacheLocal: CacheRecomendacao;
  fpsHq?: ProvedorEvidencia;
  exemplo?: Gerador;
  gemini?: Gerador;
  groq?: Gerador;
}

export interface Recomendador {
  consultarConfiguracoes(
    consulta: ConsultaConfiguracoes,
    opcoes?: OpcoesConsulta,
  ): Promise<ConsultaResultado>;
}

const MENSAGEM_ERRO = 'Não foi possível gerar as configurações. Tente novamente.';
const MENSAGEM_LIMITE = 'Limite de requisições atingido. Tente novamente em alguns segundos.';

function finalizarRecomendacao(
  resposta: RespostaIa,
  geradoPor: GeradoPor,
  evidencia?: EvidenciaDesempenho,
): Resultado | null {
  const resultado = ResultadoSchema.safeParse({
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
  });

  if (!resultado.success) {
    console.error('[recomendador] Conteúdo gerado não forma uma recomendação válida:', resultado.error.issues);
    return null;
  }

  return resultado.data;
}

function prepararResultadoSalvo(resultado: Resultado): Resultado | null {
  const validado = ResultadoSchema.safeParse({ ...resultado, fonte: 'salvo' });
  if (!validado.success) {
    console.error('[recomendador] Resultado do cache não corresponde ao contrato:', validado.error.issues);
    return null;
  }
  return validado.data;
}

export function criarRecomendador(adaptadores: AdaptadoresRecomendador): Recomendador {
  const modoExemplo = adaptadores.exemplo !== undefined;
  const geradores = (modoExemplo
    ? [adaptadores.exemplo]
    : [adaptadores.gemini, adaptadores.groq]
  ).filter((gerador): gerador is Gerador => gerador !== undefined);

  return {
    async consultarConfiguracoes(consulta, opcoes = {}) {
      let erroLimite: ErroFonteLimite | null = null;

      // A cadeia começa no cache. A intenção de uma recomendação nova só pula esta leitura.
      if (!opcoes.forcarNovaRecomendacao) {
        try {
          const resultadoCache = await adaptadores.cacheLocal.buscar(consulta);
          if (resultadoCache) {
            const resultadoSalvo = prepararResultadoSalvo(resultadoCache);
            if (resultadoSalvo) return { ok: true, resultado: resultadoSalvo };
          }
        } catch (erro) {
          if (erro instanceof ErroFonteConfiguracao) {
            console.error(`[recomendador] ${erro.message}`);
            return { ok: false, erro: MENSAGEM_ERRO };
          }
          if (erro instanceof ErroFonteLimite) {
            console.error(`[recomendador] ${erro.message}`);
            erroLimite = erro;
          } else {
            console.error('[recomendador] Falha inesperada no cache local:', erro);
          }
        }
      }

      let evidencia: EvidenciaDesempenho | undefined;
      if (!modoExemplo && adaptadores.fpsHq) {
        try {
          evidencia = (await adaptadores.fpsHq.buscar(consulta)) ?? undefined;
        } catch (erro) {
          console.error(`[recomendador] Falha inesperada no provedor de evidência ${adaptadores.fpsHq.nome}:`, erro);
        }
      }

      // A ordem é uma política deste módulo: Gemini, depois Groq.
      for (const gerador of geradores) {
        try {
          const resposta = await gerador.gerar({ consulta, evidencia });
          if (!resposta) continue;

          const resultado = finalizarRecomendacao(resposta, gerador.nome, evidencia);
          if (!resultado) continue;

          try {
            await adaptadores.cacheLocal.salvar(consulta, resultado);
          } catch (erro) {
            console.error('[recomendador] Não foi possível salvar o resultado:', erro);
          }
          return { ok: true, resultado };
        } catch (erro) {
          if (erro instanceof ErroFonteConfiguracao) {
            console.error(`[recomendador] ${erro.message}`);
            return { ok: false, erro: MENSAGEM_ERRO };
          }
          if (erro instanceof ErroFonteLimite) {
            console.error(`[recomendador] ${erro.message}`);
            erroLimite = erro;
            continue;
          }
          console.error(`[recomendador] Falha inesperada no gerador ${gerador.nome}:`, erro);
        }
      }

      return erroLimite
        ? { ok: false, erro: MENSAGEM_LIMITE }
        : { ok: false, erro: MENSAGEM_ERRO };
    },
  };
}
