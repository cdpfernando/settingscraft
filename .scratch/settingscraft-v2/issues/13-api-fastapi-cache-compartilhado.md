# 13 — API FastAPI de cache compartilhado

**What to build:** Um serviço próprio, em pasta separada no mesmo repositório, que guarda recomendações já geradas para que um jogador aproveite o que outro já consultou. Papel é cache compartilhado, não proxy: quem chama a IA continua sendo o app, que depois publica o resultado aqui.

FastAPI com SQLite e SQLModel; mesmo repositório porque app e API compartilham contrato, e a documentação interativa gerada é a forma mais barata de demonstrar a API.

Leitura envia os campos crus e o servidor calcula a chave — assim a normalização que governa a base existe num lugar só, e uma divergência do lado do cliente custa no máximo um miss local, nunca duas linhas para o mesmo hardware. Miss é 404 com corpo vazio, sem interpretação especulativa. Escrita exige token compartilhado em cabeçalho conferido contra variável de ambiente; se a variável não estiver definida no servidor, a escrita fica aberta para desenvolvimento local. Conflito de chave existente é ignorado por padrão, com sobrescrita explícita via parâmetro. O servidor revalida o payload antes de gravar — cache que aceita qualquer coisa corrompe em silêncio e só se manifesta no aparelho de outra pessoa. O registro guarda a contagem de reaproveitamentos, prova numérica de que o cache trabalha.

**Blocked by:** 04 — Contrato tipado.

**Status:** ready-for-agent

- [ ] Serviço FastAPI em pasta própria, com SQLite e SQLModel, e instruções de execução
- [ ] Leitura recebe os campos crus da consulta; a chave é calculada no servidor
- [ ] Miss responde 404 com corpo vazio
- [ ] Hit responde o resultado completo e incrementa a contagem de reaproveitamentos
- [ ] Escrita exige token em cabeçalho quando a variável de ambiente está definida
- [ ] Variável ausente no servidor deixa a escrita aberta para desenvolvimento local
- [ ] Payload revalidado no servidor contra o contrato antes de gravar
- [ ] Conflito de chave existente ignorado por padrão; sobrescrita apenas com parâmetro explícito
- [ ] Documentação interativa acessível e suficiente para exercitar os dois endpoints
