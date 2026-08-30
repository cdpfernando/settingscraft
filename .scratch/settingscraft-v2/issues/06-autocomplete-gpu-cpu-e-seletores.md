# 06 — Autocomplete de GPU/CPU e seletores de RAM e resolução

**What to build:** O jogador descreve o hardware sem digitar modelos longos no teclado do celular. Placa de vídeo e processador vêm de um dataset local estático (sem chamada extra) com autocomplete; quando o componente não está na lista, o campo livre continua aceito para não bloquear hardware incomum. RAM e resolução viram seletores de opções conhecidas, para não errar formato e para comparar cenários com rapidez.

Além da usabilidade, é isto que elimina a maior parte da variação de digitação que destruiria a taxa de acerto do cache mais adiante.

**Blocked by:** 05 — Estados do formulário.

**Status:** done

- [x] Dataset local de GPUs e CPUs versionado no repositório, sem chamada de rede
- [x] Autocomplete filtra enquanto o jogador digita, em placa de vídeo e processador
- [x] Valor digitado fora da lista é aceito e enviado
- [x] RAM e resolução são seletores de opções conhecidas
- [x] A validação do ticket 05 continua valendo para todos os campos
- [x] Componentes construídos sobre os primitivos do design system

## Comments

Implementação validada pelo usuário.
