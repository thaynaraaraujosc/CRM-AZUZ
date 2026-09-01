import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Testes das regras puras — as decisões que mudam o comportamento do CRM sem depender de rede:
 * se uma automação dispara, o que uma falha da Meta significa.
 *
 * Deliberadamente sem ambiente de navegador nem banco: teste que precisa dos dois é lento, quebra
 * por motivo alheio ao que se quer verificar, e acaba desligado. O que a rede faz é verificado
 * contra a API de verdade, em produção, com o diagnóstico do Instagram.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
