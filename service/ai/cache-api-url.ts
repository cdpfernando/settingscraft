/** Único lugar onde a URL da instância hospedada do cache compartilhado fica hardcoded. */
const CACHE_API_URL_HOSPEDADA = 'https://api-production-3ad69.up.railway.app';

/** `envUrl` sobrescreve quando definida (instância própria); caso contrário cai para a hospedada. */
export function resolverCacheApiUrl(envUrl: string | undefined): string {
  return envUrl && envUrl.trim() !== '' ? envUrl : CACHE_API_URL_HOSPEDADA;
}
