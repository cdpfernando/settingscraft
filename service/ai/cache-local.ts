import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import type { Consulta, Fonte } from './fonte';
import { CONTRATO_VERSAO, ResultadoSchema, type Resultado } from './schema';

const PREFIXO_CHAVE = '@settingscraft/resultados';

export interface ArmazenamentoChaveValor {
  getItem(chave: string): Promise<string | null>;
  setItem(chave: string, valor: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
  multiGet(chaves: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
}

/** Cada registro guarda a consulta original junto do resultado, para o histórico não depender de nova busca. */
const ConsultaSchema = z.object({
  jogo: z.string(),
  placaVideo: z.string(),
  processador: z.string(),
  memoria: z.string(),
  resolucao: z.string(),
});

const RegistroCacheSchema = z.object({
  consulta: ConsultaSchema,
  resultado: ResultadoSchema,
});

export interface ItemHistorico {
  consulta: Consulta;
  resultado: Resultado;
}

export interface RepositorioCacheLocal {
  buscar(consulta: Consulta): Promise<Resultado | null>;
  salvar(consulta: Consulta, resultado: Resultado): Promise<void>;
  listar(): Promise<ItemHistorico[]>;
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
        const registro = RegistroCacheSchema.safeParse(JSON.parse(armazenado));
        if (!registro.success) {
          console.error('[cacheLocal] Registro armazenado não corresponde ao contrato:', registro.error.issues);
          return null;
        }
        return registro.data.resultado;
      } catch (erro) {
        console.error('[cacheLocal] Não foi possível ler o registro armazenado:', erro);
        return null;
      }
    },
    salvar(consulta, resultado) {
      const registro: ItemHistorico = { consulta, resultado };
      return armazenamento.setItem(criarChaveCache(consulta), JSON.stringify(registro));
    },
    async listar() {
      const todasChaves = await armazenamento.getAllKeys();
      const chavesCache = todasChaves.filter((chave) => chave.startsWith(PREFIXO_CHAVE));
      if (chavesCache.length === 0) return [];

      const pares = await armazenamento.multiGet(chavesCache);
      const itens: ItemHistorico[] = [];

      for (const [, valor] of pares) {
        if (!valor) continue;

        try {
          const registro = RegistroCacheSchema.safeParse(JSON.parse(valor));
          if (registro.success) {
            itens.push(registro.data);
          } else {
            console.error('[cacheLocal] Registro de histórico não corresponde ao contrato:', registro.error.issues);
          }
        } catch (erro) {
          console.error('[cacheLocal] Não foi possível ler um registro do histórico:', erro);
        }
      }

      return itens.sort((a, b) => b.resultado.geradoEm.localeCompare(a.resultado.geradoEm));
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
