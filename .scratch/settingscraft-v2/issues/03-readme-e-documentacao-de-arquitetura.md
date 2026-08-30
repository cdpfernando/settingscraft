# 03 — README e documentação de arquitetura

**What to build:** O avaliador clona o repositório, lê o README, configura a própria variável de ambiente e roda o app — sem perguntar nada a ninguém. Hoje o README é o boilerplate do `create-expo-app` e não descreve nem o produto nem as decisões.

O texto cobre: o que o app faz, como rodar (incluindo a chave do Gemini em `.env.local`, não versionada), a arquitetura alvo desta spec — cadeia de fontes, contrato tipado, cache — e as decisões com suas razões, inclusive os riscos aceitos de olhos abertos (chave exposta no bundle, ausência de testes automatizados com o seam preparado).

Escrito agora contra a arquitetura que a spec define; revisitado ao final das fases seguintes se a realidade divergir do descrito.

**Blocked by:** 02 — Design system: tokens, primitivos e tema escuro.

**Status:** done

- [x] README descreve o produto e o passo a passo de execução em máquina limpa
- [x] Instruções de variável de ambiente presentes; nenhuma chave versionada
- [x] Arquitetura alvo explicada: cadeia de fontes, contrato tipado com Zod, cache
- [x] Decisões e riscos aceitos registrados com a razão de cada um
- [x] Nenhum resto do boilerplate do `create-expo-app`
