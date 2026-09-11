import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests de ponta a ponta — cobrem só o que dá pra verificar SEM um
 * projeto Firebase real conectado (nada de login de verdade aqui, ver
 * e2e/smoke.spec.ts pro porquê): redirecionamento do proxy.ts pra /login,
 * renderização da tela de login, e validação client-side do formulário.
 * Sobe o servidor de dev automaticamente (webServer abaixo) — não precisa
 * já estar rodando.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      // Valores fake com formato válido — NÃO são segredo, não apontam pra
      // nenhum projeto Firebase real. Servem só pra initializeApp()/getAuth()
      // no cliente não lançar "auth/invalid-api-key" e travar toda a árvore
      // de componentes (ver lib/auth/use-auth.tsx: sem isso, o AuthProvider
      // cai na tela de diagnóstico de config e o e2e não alcança /login
      // nenhum). O SDK só valida formato/presença na inicialização — a
      // validação de verdade (a chave é real?) só rola numa chamada de rede,
      // que estes testes nunca disparam (ver e2e/smoke.spec.ts).
      NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyFAKE1234567890FAKE1234567890FAKEE",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "test-project.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "test-project",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "test-project.firebasestorage.app",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789012",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789012:web:abcdef1234567890abcdef",
    },
  },
});
