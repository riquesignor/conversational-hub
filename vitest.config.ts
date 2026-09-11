import { defineConfig } from "vitest/config";

/**
 * Testes de unidade só — nada de DOM (sem componente React sendo testado
 * aqui ainda, por isso environment "node" em vez de "jsdom"; se um dia
 * surgir teste de componente, trocar pra "jsdom" e instalar a dependência).
 * resolve.tsconfigPaths resolve o alias "@/..." (definido em tsconfig.json)
 * do mesmo jeito que o Next resolve em runtime — suporte nativo do Vite 7+,
 * sem precisar da dependência extra vite-tsconfig-paths.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
  },
});
