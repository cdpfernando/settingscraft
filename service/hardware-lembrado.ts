import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import type { ArmazenamentoChaveValor } from './armazenamento';

export const CHAVE_HARDWARE_LEMBRADO = '@settingscraft/hardware-lembrado';

const HardwareLembradoSchema = z.object({
  placaVideo: z.string().min(1),
  processador: z.string().min(1),
  memoria: z.string().min(1),
  resolucao: z.string().min(1),
});

export type HardwareLembrado = z.infer<typeof HardwareLembradoSchema>;

export interface RepositorioHardwareLembrado {
  ler(): Promise<HardwareLembrado | null>;
  salvar(hardware: HardwareLembrado): Promise<void>;
  apagar(): Promise<void>;
}

export function criarRepositorioHardwareLembrado(
  armazenamento: ArmazenamentoChaveValor = AsyncStorage,
): RepositorioHardwareLembrado {
  return {
    async ler() {
      const armazenado = await armazenamento.getItem(CHAVE_HARDWARE_LEMBRADO);
      if (!armazenado) return null;

      try {
        const registro = HardwareLembradoSchema.safeParse(JSON.parse(armazenado));
        if (!registro.success) {
          console.error(
            '[hardwareLembrado] Registro armazenado não corresponde ao contrato:',
            registro.error.issues,
          );
          return null;
        }
        return registro.data;
      } catch (erro) {
        console.error('[hardwareLembrado] Não foi possível ler o registro armazenado:', erro);
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
