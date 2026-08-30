# 04 — Contrato tipado: Zod canônico, Gemini em JSON e Resultado completo

**What to build:** O jogador faz uma consulta e vê as configurações renderizadas a partir de dado estruturado e validado, não de texto interpretado. Quando o modelo responde algo malformado, isso falha alto e vira erro visível — não uma tela silenciosamente vazia.

O parser artesanal por dois-pontos e travessão é apagado. Zod passa a ser a declaração única do contrato, e o JSON Schema enviado ao Gemini é derivado do Zod em tempo de execução — nunca escrito à mão em paralelo, porque duas declarações do mesmo contrato divergem e a divergência só aparece quando o fallback dispara. O Gemini continua em `fetch` direto contra a REST API, agora com o schema derivado na configuração de geração.

`Resultado` nasce completo desde já, mesmo enquanto só o Gemini o preenche, para que a interface seja desenhada contra a forma final do dado:

```ts
interface Resultado {
  configuracoes: { nome: string; valor: string; justificativa: string }[];
  fpsEstimado: string;
  fonte: string;
  geradoEm: string;
  versaoContrato: number;
}
```

Inclui um resultado de exemplo embutido atrás de flag, para ajustar layout sem gastar quota nem esperar cinco segundos por iteração.

**Blocked by:** 02 — Design system: tokens, primitivos e tema escuro.

**Status:** done

- [x] Schema Zod é a única declaração do contrato; nenhum JSON Schema escrito à mão
- [x] O JSON Schema enviado ao Gemini é derivado do Zod em runtime
- [x] Gemini responde JSON estruturado, validado antes de chegar à tela
- [x] O parser por travessão e o formato de texto do system prompt são removidos
- [x] `Resultado` completo, com `fonte`, `geradoEm` e `versaoContrato` preenchidos
- [x] Resposta que não valida vira erro visível ao usuário, não tela vazia
- [x] Resultado de exemplo disponível atrás de flag, sem chamada de rede
- [x] Lint e verificação de tipos limpos

## Comments

Implementado: `service/ai/schema.ts` declara `RespostaIaSchema` (Zod) como fonte única; `service/ai/generator.ts` deriva o JSON Schema do Gemini via `z.toJSONSchema` + `paraSchemaGemini` (filtra `$schema`/`additionalProperties`, que o subconjunto OpenAPI 3.0 do Gemini não aceita). `createOptmizedSetting()` passa a retornar `ConsultaResultado` (`{ ok: true, resultado } | { ok: false, erro }`) em vez de string — contrato documentado em `AGENTS.md`. Flag `EXPO_PUBLIC_USAR_RESULTADO_EXEMPLO=true` retorna um `Resultado` fixo sem rede.
