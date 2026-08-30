# 09 — Cache local persistente como primeira fonte

**What to build:** O jogador que já consultou aquele mesmo jogo com aquele mesmo hardware recebe o resultado instantaneamente, sem esperar nem gastar quota — e o selo de origem mostra que veio do que estava salvo. Fechar e reabrir o app não perde nada.

O cache entra como primeiro elo da cadeia. A chave são os campos da consulta normalizados (minúsculas, espaços colapsados) mais o número da versão do contrato — incrementar essa versão ao mudar prompt ou schema invalida todo o cache antigo sem migração. Sem TTL: hardware e jogo não mudam sozinhos.

Persistência em armazenamento chave-valor (AsyncStorage), atrás de um repositório encapsulado — o volume não justifica SQL, e a troca por SQLite depois fica contida num módulo.

**Blocked by:** 08 — Porta Fonte, resolvedor e composição na borda.

**Status:** ready-for-agent

- [ ] Consulta repetida devolve resultado sem chamada de rede
- [ ] O resultado da IA é gravado ao voltar da cadeia
- [ ] Selo de origem distingue resultado salvo de resultado gerado
- [ ] Chave normaliza os campos e inclui a versão do contrato
- [ ] Duas consultas escritas de forma diferente (caixa, espaços) acertam o mesmo registro
- [ ] Incrementar a versão do contrato deixa de acertar registros antigos, sem migração
- [ ] Acesso ao armazenamento isolado atrás de um repositório; nenhuma tela conhece AsyncStorage
- [ ] Resultado sobrevive ao fechamento do app
