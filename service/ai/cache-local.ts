import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ArmazenamentoChaveValor } from '../armazenamento';
import {
  criarConsultaConfiguracoes,
  identificarConsultaConfiguracoes,
  type ConsultaConfiguracoes,
} from '../consulta-configuracoes';
import {
  CONTRATO_VERSAO,
  ResultadoSchema,
  type Resultado,
  type ResultadoSalvo,
} from './schema';

export type { ArmazenamentoChaveValor } from '../armazenamento';

const PREFIXO_CHAVE = '@settingscraft/resultados';

export interface ItemHistorico {
  consulta: ConsultaConfiguracoes;
  resultado: ResultadoSalvo;
}

export interface RepositorioCacheLocal {
  buscar(consulta: ConsultaConfiguracoes): Promise<ResultadoSalvo | null>;
  salvar(consulta: ConsultaConfiguracoes, resultado: Resultado): Promise<void>;
  listar(): Promise<ItemHistorico[]>;
}

function prefixoChave(): string {
  return `${PREFIXO_CHAVE}:v${CONTRATO_VERSAO}:`;
}

// A versão na chave invalida cache antigo sem migração.
function criarChaveCache(consulta: ConsultaConfiguracoes): string {
  return `${prefixoChave()}${identificarConsultaConfiguracoes(consulta)}`;
}

async function lerRegistro(
  armazenamento: ArmazenamentoChaveValor,
  chave: string,
  valor: string,
): Promise<ItemHistorico | null> {
  try {
    const bruto: unknown = JSON.parse(valor);
    if (typeof bruto === 'object' && bruto !== null && !Array.isArray(bruto)) {
      const registro = bruto as Record<string, unknown>;
      const consulta = criarConsultaConfiguracoes(registro.consulta);
      const resultado = ResultadoSchema.safeParse(registro.resultado);

      if (consulta.ok && resultado.success) {
        return {
          consulta: consulta.consulta,
          resultado: { ...resultado.data, fonte: 'salvo' },
        };
      }
    }
  } catch {
    // O registro ilegível segue pelo mesmo descarte dos demais dados inválidos.
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
      if (armazenado === null) return null;

      const registro = await lerRegistro(armazenamento, chave, armazenado);
      return registro?.resultado ?? null;
    },
    salvar(consulta, resultado) {
      const registro = { consulta, resultado: ResultadoSchema.parse(resultado) };
      return armazenamento.setItem(criarChaveCache(consulta), JSON.stringify(registro));
    },
    async listar() {
      const todasChaves = await armazenamento.getAllKeys();
      const chavesCache = todasChaves.filter((chave) => chave.startsWith(prefixoChave()));
      if (chavesCache.length === 0) return [];

      const pares = await armazenamento.multiGet(chavesCache);
      const itens: ItemHistorico[] = [];

      for (const [chave, valor] of pares) {
        if (valor === null) continue;
        const registro = await lerRegistro(armazenamento, chave, valor);
        if (registro) {
          itens.push(registro);
        }
      }

      return itens.sort((a, b) => b.resultado.geradoEm.localeCompare(a.resultado.geradoEm));
    },
  };
}
