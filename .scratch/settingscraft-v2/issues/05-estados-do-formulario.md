# 05 — Estados do formulário: validação, botão desabilitado, carregamento

**What to build:** O jogador não consegue mais disparar uma consulta inútil nem duas por acidente. Deixar um campo obrigatório vazio produz um aviso claro naquele campo e não chama a IA. Durante a chamada o botão fica desabilitado e há um indicador de carregamento evidente, para o app parecer trabalhando em vez de travado.

**Blocked by:** 04 — Contrato tipado.

**Status:** done

- [x] Campo obrigatório vazio é sinalizado na interface e bloqueia o envio
- [x] Nenhuma chamada à IA acontece com formulário inválido
- [x] Botão desabilitado enquanto a consulta está em andamento
- [x] Indicador de carregamento visível durante a chamada
- [x] Toques repetidos no botão não geram chamadas duplicadas
- [x] Estados usam os tokens e primitivos do design system

## Comments

Implementado em `app/index.tsx`: `validarFormulario()` marca `erros` por campo (jogo, placa de vídeo, processador, memória) e impede a chamada; `editarCampo()` limpa o erro daquele campo ao digitar. `gerarConfiguracoes()` tem guarda `if (isLoading) return` além do botão desabilitado. `ActivityIndicator` + texto "Gerando..." dentro do botão via `layoutStyles.row`. Novos primitivos: `inputStyles.container/campoErro/mensagemErro` e `alertaStyles.erro/textoErro` (consome novo token `Cores.erroSombra`).
