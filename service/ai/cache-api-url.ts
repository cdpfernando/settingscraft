const CACHE_API_URL_HOSPEDADA = 'https://api-production-3ad69.up.railway.app';

export function resolverCacheApiUrl(envUrl: string | undefined): string {
  return envUrl && envUrl.trim() !== '' ? envUrl : CACHE_API_URL_HOSPEDADA;
}
