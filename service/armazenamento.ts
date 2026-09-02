export interface ArmazenamentoChaveValor {
  getItem(chave: string): Promise<string | null>;
  setItem(chave: string, valor: string): Promise<void>;
  removeItem(chave: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
  multiGet(chaves: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
}
