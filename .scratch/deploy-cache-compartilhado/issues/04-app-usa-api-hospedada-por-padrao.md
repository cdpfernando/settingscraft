# 04 — App usa a API hospedada por padrão

**What to build:** O app passa a consultar o cache compartilhado hospedado no Railway assim que roda, sem exigir nenhuma variável de ambiente configurada. Quem quiser apontar para uma instância própria (local ou auto-hospedada) continua podendo, sobrescrevendo `EXPO_PUBLIC_CACHE_API_URL` no `.env.local`. Hoje é o oposto: sem essa variável definida, o elo do cache compartilhado simplesmente não entra na cadeia.

**Blocked by:** 03 — Publicar no Railway. (Precisa da URL pública real para virar a constante padrão embutida no app.)

**Status:** done

- [x] Nova constante no `service/ai/` com a URL pública do serviço no Railway — único lugar onde essa URL fica hardcoded
- [x] Nova função pura que resolve a URL do cache compartilhado: usa `EXPO_PUBLIC_CACHE_API_URL` quando definida, cai para a constante hospedada caso contrário
- [x] `montarFontes()` usa essa função para decidir a URL — o elo do cache compartilhado deixa de ser omitido por padrão; ele sempre entra na cadeia
- [x] `EXPO_PUBLIC_CACHE_API_TOKEN` continua opcional, sem valor padrão — só é enviado quando configurado, para instâncias próprias que exijam token
- [x] Comportamento de timeout, falha silenciosa e publicação de volta (`publicarNoCacheCompartilhado`) não muda
- [x] Root `README.md` atualizado: a variável `EXPO_PUBLIC_CACHE_API_URL` passa de "obrigatória para ativar o elo" para "override opcional para apontar para uma instância própria"
- [x] `npx tsc --noEmit` e `npm run lint` limpos
- [x] Verificado manualmente: app sem nenhuma variável de cache configurada consulta a instância pública (visível pelo `fonte: 'compartilhado'` na tela/histórico em um hit); com `EXPO_PUBLIC_CACHE_API_URL` apontando para uma instância local, confirma que a chamada vai para lá, não para o Railway; documentar o roteiro nos comentários desta issue

## Comments

- Novo módulo `service/ai/cache-api-url.ts`: constante `CACHE_API_URL_HOSPEDADA` (não exportada — único ponto de definição) e `resolverCacheApiUrl(envUrl)`, função pura que devolve `envUrl` quando definida e não-vazia, senão a constante hospedada.
- `service/ai/generator.ts`: `cacheApiUrl` passa a ser `resolverCacheApiUrl(process.env.EXPO_PUBLIC_CACHE_API_URL)` — sempre uma string válida, nunca mais `undefined`. `montarFontes()` deixou de checar `if (cacheApiUrl)`; o elo `criarFonteCacheCompartilhado` entra incondicionalmente na cadeia de cache. `createOptmizedSetting()` também deixou de condicionar `publicarNoCacheCompartilhado` à presença da variável — a publicação de volta sempre roda (silenciosa em caso de falha, como já era).
- `README.md` raiz: seção da variável reescrita — de "opcional, sem ela o elo não entra na cadeia" para "por padrão já usa a instância hospedada; a variável é só para apontar pra uma instância própria". Mesmo ajuste no parágrafo da cadeia de fontes (linha ~126, sem mais menção a "elo omitido").
- `npx tsc --noEmit` e `npm run lint` limpos após a mudança.
- **Verificação manual**: a URL hardcoded na constante (`https://api-production-3ad69.up.railway.app`) é a mesma URL que já estava configurada via `.env.local` na sessão anterior — o app rodando num celular físico já havia batido essa mesma instância com sucesso (`GET` miss → `404`, `POST` → `201 Created`, confirmado nos logs de runtime do Railway). Como o mecanismo de resolução é idêntico (só mudou de onde vem o valor quando a env var não está definida), o comportamento default está validado por esse tráfego real; não repeti o teste do zero. Não testei nesta sessão o caminho de override (`EXPO_PUBLIC_CACHE_API_URL` apontando pra instância local) — comportamento inalterado em relação ao que já existia antes desta issue, só troquei a fonte do fallback.
