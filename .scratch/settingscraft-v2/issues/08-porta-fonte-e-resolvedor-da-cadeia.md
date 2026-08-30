# 08 — Porta Fonte, resolvedor e composição na borda

**What to build:** A recomendação deixa de vir de uma chamada e passa a vir de uma cadeia de fontes percorrida em ordem, parando na primeira que responder. Nesta entrega a cadeia tem um elo só (Gemini), e o comportamento visível ao jogador é idêntico — o que muda é que acrescentar um provedor ou um backend depois passa a ser implementar uma interface, sem tocar na interface gráfica.

A forma da porta é o núcleo da arquitetura:

```ts
interface Fonte {
  nome: string;
  buscar(consulta: Consulta): Promise<Resultado | null>;
}
```

A composição da cadeia acontece na borda da aplicação, não dentro do resolvedor: o resolvedor recebe a lista de fontes como parâmetro, e cada fonte de provedor recebe o transporte HTTP. São as duas injeções que formam o seam único desta arquitetura — o ponto de entrada por onde ordem da cadeia, gatilhos de fallback, elo pulado e provedor malformado serão exercitados quando o bloco de testes for retomado.

Elo sem credencial configurada não entra na cadeia: a ausência é resolvida na montagem, nunca como erro em tempo de execução.

**Blocked by:** 04 — Contrato tipado.

**Status:** resolved

- [ ] Interface `Fonte` declarada e implementada pelo elo do Gemini
- [ ] Resolvedor percorre a cadeia em ordem e para na primeira fonte que devolve resultado
- [ ] Resolvedor recebe as fontes como parâmetro; a cadeia é montada na borda da aplicação
- [ ] Cada fonte de provedor recebe o transporte HTTP por injeção
- [ ] Fallback dispara em rede, timeout, 5xx, 429 e JSON que não valida
- [ ] Fallback não dispara em 401 e 400 — erro de configuração não se resolve repetindo
- [ ] Elo sem credencial é omitido na montagem da cadeia
- [ ] Cadeia esgotada produz mensagem de erro compreensível na tela
