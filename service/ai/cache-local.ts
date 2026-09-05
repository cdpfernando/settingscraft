import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import type { ArmazenamentoChaveValor } from '../armazenamento';
import type { Consulta } from './fonte';
import { CONTRATO_VERSAO, ResultadoSchema, type Resultado } from './schema';

export type { ArmazenamentoChaveValor } from '../armazenamento';

const PREFIXO_CHAVE = '@settingscraft/resultados';

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

export function normalizarCampoCache(valor: string): string {
  return valor.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

function prefixoChave(versaoContrato = CONTRATO_VERSAO): string {
  return `${PREFIXO_CHAVE}:v${versaoContrato}:`;
}

// A versão na chave invalida cache antigo sem migração.
export function criarChaveCache(consulta: Consulta, versaoContrato = CONTRATO_VERSAO): string {
  const campos = [
    consulta.jogo,
    consulta.placaVideo,
    consulta.processador,
    consulta.memoria,
    consulta.resolucao,
  ].map(normalizarCampoCache);

  return `${prefixoChave(versaoContrato)}${JSON.stringify(campos)}`;
}

async function lerRegistro(
  armazenamento: ArmazenamentoChaveValor,
  chave: string,
  valor: string,
): Promise<ItemHistorico | null> {
  try {
    const registro = RegistroCacheSchema.safeParse(JSON.parse(valor));
    if (registro.success) return registro.data;
  } catch {
    
  }

  await armazenamento.removeItem(chave);
  return null;
}

export function criarRepositorioCacheLocal(
  armazenamento: ArmazenamentoChaveValor = AsyncStorage,
): RepositorioCacheLocal {
  return {
    async buscar(consulta) {
      const chave = criarChaveCache(consulta);
      const armazenado = await armazenamento.getItem(chave);
      if (!armazenado) return null;

      const registro = await lerRegistro(armazenamento, chave, armazenado);
      return registro?.resultado ?? null;
    },
    salvar(consulta, resultado) {
      const registro = RegistroCacheSchema.parse({ consulta, resultado });
      return armazenamento.setItem(criarChaveCache(consulta), JSON.stringify(registro));
    },
    async listar() {
      const todasChaves = await armazenamento.getAllKeys();
      const chavesCache = todasChaves.filter((chave) => chave.startsWith(prefixoChave()));
      if (chavesCache.length === 0) return [];

      const pares = await armazenamento.multiGet(chavesCache);
      const itens: ItemHistorico[] = [];

      for (const [chave, valor] of pares) {
        if (!valor) continue;
        const registro = await lerRegistro(armazenamento, chave, valor);
        if (registro) {
          itens.push({
            ...registro,
            resultado: { ...registro.resultado, fonte: 'salvo' },
          });
        }
      }

      return itens.sort((a, b) => b.resultado.geradoEm.localeCompare(a.resultado.geradoEm));
    },
  };
}
