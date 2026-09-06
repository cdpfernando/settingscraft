import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import type { ArmazenamentoChaveValor } from './armazenamento';
import {
  OPCOES_MEMORIA,
  RESOLUCOES,
  type Memoria,
  type Resolucao,
} from './consulta-configuracoes';

export const CHAVE_HARDWARE_LEMBRADO = '@settingscraft/hardware-lembrado';

const TextoLivreNaoVazioSchema = z.string().refine((valor) => valor.trim().length > 0);

export interface HardwareLembrado {
  readonly placaVideo: string;
  readonly processador: string;
  readonly memoria: Memoria;
  readonly resolucao: Resolucao;
}

const HardwareLembradoSchema: z.ZodType<HardwareLembrado> = z.object({
  placaVideo: TextoLivreNaoVazioSchema,
  processador: TextoLivreNaoVazioSchema,
  memoria: z.enum(OPCOES_MEMORIA),
  resolucao: z.enum(RESOLUCOES),
});

export interface RepositorioHardwareLembrado {
  ler(): Promise<HardwareLembrado | null>;
  salvar(hardware: HardwareLembrado): Promise<void>;
  apagar(): Promise<void>;
}

export function criarRepositorioHardwareLembrado(
  armazenamento: ArmazenamentoChaveValor = AsyncStorage,
): RepositorioHardwareLembrado {
  const removerRegistroInvalido = async (): Promise<void> => {
    try {
      await armazenamento.removeItem(CHAVE_HARDWARE_LEMBRADO);
    } catch (erro) {
      console.error(
        '[hardwareLembrado] Não foi possível remover o registro inválido:',
        erro,
      );
    }
  };

  return {
    async ler() {
      const armazenado = await armazenamento.getItem(CHAVE_HARDWARE_LEMBRADO);
      if (armazenado === null) return null;

      try {
        const registro = HardwareLembradoSchema.safeParse(JSON.parse(armazenado));
        if (!registro.success) {
          console.error(
            '[hardwareLembrado] Registro armazenado não corresponde ao contrato:',
            registro.error.issues,
          );
          await removerRegistroInvalido();
          return null;
        }
        return registro.data;
      } catch (erro) {
        console.error('[hardwareLembrado] Não foi possível ler o registro armazenado:', erro);
        await removerRegistroInvalido();
        return null;
      }
    },
    salvar(hardware) {
      const registro = HardwareLembradoSchema.safeParse(hardware);
      if (!registro.success) {
        console.error(
          '[hardwareLembrado] Hardware inválido, nada foi gravado:',
          registro.error.issues,
        );
        return Promise.resolve();
      }
      return armazenamento.setItem(CHAVE_HARDWARE_LEMBRADO, JSON.stringify(registro.data));
    },
    apagar() {
      return armazenamento.removeItem(CHAVE_HARDWARE_LEMBRADO);
    },
  };
}
