# 05 — Estados do formulário: validação, botão desabilitado, carregamento

**What to build:** O jogador não consegue mais disparar uma consulta inútil nem duas por acidente. Deixar um campo obrigatório vazio produz um aviso claro naquele campo e não chama a IA. Durante a chamada o botão fica desabilitado e há um indicador de carregamento evidente, para o app parecer trabalhando em vez de travado.

**Blocked by:** 04 — Contrato tipado.

**Status:** ready-for-agent

- [ ] Campo obrigatório vazio é sinalizado na interface e bloqueia o envio
- [ ] Nenhuma chamada à IA acontece com formulário inválido
- [ ] Botão desabilitado enquanto a consulta está em andamento
- [ ] Indicador de carregamento visível durante a chamada
- [ ] Toques repetidos no botão não geram chamadas duplicadas
- [ ] Estados usam os tokens e primitivos do design system
