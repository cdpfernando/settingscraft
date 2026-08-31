# 13 — API FastAPI de cache compartilhado

**What to build:** Um serviço próprio, em pasta separada no mesmo repositório, que guarda recomendações já geradas para que um jogador aproveite o que outro já consultou. Papel é cache compartilhado, não proxy: quem chama a IA continua sendo o app, que depois publica o resultado aqui.

FastAPI com SQLite e SQLModel; mesmo repositório porque app e API compartilham contrato, e a documentação interativa gerada é a forma mais barata de demonstrar a API.

Leitura envia os campos crus e o servidor calcula a chave — assim a normalização que governa a base existe num lugar só, e uma divergência do lado do cliente custa no máximo um miss local, nunca duas linhas para o mesmo hardware. Miss é 404 com corpo vazio, sem interpretação especulativa. Escrita exige token compartilhado em cabeçalho conferido contra variável de ambiente; se a variável não estiver definida no servidor, a escrita fica aberta para desenvolvimento local. Conflito de chave existente é ignorado por padrão, com sobrescrita explícita via parâmetro. O servidor revalida o payload antes de gravar — cache que aceita qualquer coisa corrompe em silêncio e só se manifesta no aparelho de outra pessoa. O registro guarda a contagem de reaproveitamentos, prova numérica de que o cache trabalha.

**Blocked by:** 04 — Contrato tipado.

**Status:** done

- [x] Serviço FastAPI em pasta própria, com SQLite e SQLModel, e instruções de execução
- [x] Leitura recebe os campos crus da consulta; a chave é calculada no servidor
- [x] Miss responde 404 com corpo vazio
- [x] Hit responde o resultado completo e incrementa a contagem de reaproveitamentos
- [x] Escrita exige token em cabeçalho quando a variável de ambiente está definida
- [x] Variável ausente no servidor deixa a escrita aberta para desenvolvimento local
- [x] Payload revalidado no servidor contra o contrato antes de gravar
- [x] Conflito de chave existente ignorado por padrão; sobrescrita apenas com parâmetro explícito
- [x] Documentação interativa acessível e suficiente para exercitar os dois endpoints

## Comments

Implementado em `api/` (FastAPI + SQLModel + SQLite, gerenciado com `uv`, independente do projeto npm na raiz):

- `app/main.py`: `GET /recomendacoes` (campos crus como query params, chave calculada no servidor, 404 de corpo vazio no miss, incrementa `reaproveitamentos` no hit) e `POST /recomendacoes` (token opcional via header `X-Cache-Token` contra `CACHE_WRITE_TOKEN`, 401 se configurado e ausente/errado, aberto se a variável não existir no servidor; `sobrescrever=false` por padrão ignora conflito de chave, `sobrescrever=true` sobrescreve preservando o contador de reaproveitamentos).
- `app/models.py`: schemas Pydantic espelhando `Resultado`/`Consulta` de `service/ai/schema.ts` e `service/ai/fonte.ts` (aliases camelCase no wire, snake_case internamente) — revalidação automática do payload (422 em malformado) satisfaz "servidor revalida antes de gravar".
- `app/cache.py`: normalização (trim/lower/collapse-whitespace) + chave própria do servidor — independente da chave do AsyncStorage local, não precisa bater bit a bit.
- Documentação interativa em `/docs` (Swagger UI, com botão Authorize para o token) — testado manualmente: miss 404 vazio, hit 200 com incremento, chaves normalizadas diferentes colidem na mesma linha, no-op em conflito sem `sobrescrever`, sobrescrita explícita, 401 sem/errado token, 201 com token correto, 422 em payload incompleto.
- `api/README.md` documenta pré-requisitos, `uv sync`, variáveis de ambiente e exemplos de `curl` para os dois endpoints. Root `README.md` atualizado com a pasta `api/` na árvore de estrutura.
- Fora de escopo (fica para a 14): o elo HTTP do lado do app (`service/ai/`) que chama esta API.
