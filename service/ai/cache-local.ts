import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Consulta, Fonte } from './fonte';
import { CONTRATO_VERSAO, ResultadoSchema, type Resultado } from './schema';

const PREFIXO_CHAVE = '@settingscraft/resultados';

export interface ArmazenamentoChaveValor {
  getItem(chave: string): Promise<string | null>;
  setItem(chave: string, valor: string): Promise<void>;
}

export interface RepositorioCacheLocal {
  buscar(consulta: Consulta): Promise<Resultado | null>;
  salvar(consulta: Consulta, resultado: Resultado): Promise<void>;
}

/** Remove variações de caixa e espaçamento para uma mesma consulta reaproveitar o cache. */
export function normalizarCampoCache(valor: string): string {
  return valor.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

/** A versão do contrato integra a chave para invalidar registros antigos automaticamente. */
export function criarChaveCache(consulta: Consulta, versaoContrato = CONTRATO_VERSAO): string {
  const campos = [
    consulta.jogo,
    consulta.placaVideo,
    consulta.processador,
    consulta.memoria,
    consulta.resolucao,
  ].map(normalizarCampoCache);

  return `${PREFIXO_CHAVE}:v${versaoContrato}:${JSON.stringify(campos)}`;
}

export function criarRepositorioCacheLocal(
  armazenamento: ArmazenamentoChaveValor = AsyncStorage,
): RepositorioCacheLocal {
  return {
    async buscar(consulta) {
      const armazenado = await armazenamento.getItem(criarChaveCache(consulta));
      if (!armazenado) return null;

      try {
        const resultado = ResultadoSchema.safeParse(JSON.parse(armazenado));
        if (!resultado.success) {
          console.error('[cacheLocal] Registro armazenado não corresponde ao contrato:', resultado.error.issues);
          return null;
        }
        return resultado.data;
      } catch (erro) {
        console.error('[cacheLocal] Não foi possível ler o registro armazenado:', erro);
        return null;
      }
    },
    salvar(consulta, resultado) {
      return armazenamento.setItem(criarChaveCache(consulta), JSON.stringify(resultado));
    },
  };
}

/** Adapta o repositório persistente à porta comum de fontes da cadeia. */
export function criarFonteCacheLocal(repositorio: RepositorioCacheLocal): Fonte {
  return {
    nome: 'cache-local',
    async buscar(consulta) {
      const resultado = await repositorio.buscar(consulta);
      return resultado ? { ...resultado, fonte: 'salvo' } : null;
    },
  };
}
