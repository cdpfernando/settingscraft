# 04 — App usa a API hospedada por padrão

**What to build:** O app passa a consultar o cache compartilhado hospedado no Railway assim que roda, sem exigir nenhuma variável de ambiente configurada. Quem quiser apontar para uma instância própria (local ou auto-hospedada) continua podendo, sobrescrevendo `EXPO_PUBLIC_CACHE_API_URL` no `.env.local`. Hoje é o oposto: sem essa variável definida, o elo do cache compartilhado simplesmente não entra na cadeia.

**Blocked by:** 03 — Publicar no Railway. (Precisa da URL pública real para virar a constante padrão embutida no app.)

**Status:** ready-for-agent

- [ ] Nova constante no `service/ai/` com a URL pública do serviço no Railway — único lugar onde essa URL fica hardcoded
- [ ] Nova função pura que resolve a URL do cache compartilhado: usa `EXPO_PUBLIC_CACHE_API_URL` quando definida, cai para a constante hospedada caso contrário
- [ ] `montarFontes()` usa essa função para decidir a URL — o elo do cache compartilhado deixa de ser omitido por padrão; ele sempre entra na cadeia
- [ ] `EXPO_PUBLIC_CACHE_API_TOKEN` continua opcional, sem valor padrão — só é enviado quando configurado, para instâncias próprias que exijam token
- [ ] Comportamento de timeout, falha silenciosa e publicação de volta (`publicarNoCacheCompartilhado`) não muda
- [ ] Root `README.md` atualizado: a variável `EXPO_PUBLIC_CACHE_API_URL` passa de "obrigatória para ativar o elo" para "override opcional para apontar para uma instância própria"
- [ ] `npx tsc --noEmit` e `npm run lint` limpos
- [ ] Verificado manualmente: app sem nenhuma variável de cache configurada consulta a instância pública (visível pelo `fonte: 'compartilhado'` na tela/histórico em um hit); com `EXPO_PUBLIC_CACHE_API_URL` apontando para uma instância local, confirma que a chamada vai para lá, não para o Railway; documentar o roteiro nos comentários desta issue
