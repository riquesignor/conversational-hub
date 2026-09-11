import { expect, test } from "@playwright/test";

/**
 * Só cobre o que dá pra verificar sem um projeto Firebase de verdade
 * conectado (sem NEXT_PUBLIC_FIREBASE_* válidas neste ambiente de CI/local
 * de teste) — ou seja, nada de login de verdade rola aqui. O que É coberto:
 *
 *  1. proxy.ts redireciona visitante sem cookie de sessão pra /login.
 *  2. A tela de login renderiza os elementos esperados.
 *  3. A validação de senha-não-confere roda 100% client-side, ANTES de
 *     qualquer chamada ao Firebase (ver app/login/page.tsx:
 *     handleEmailSubmit) — então é determinística mesmo sem credenciais.
 *
 * Um teste de login de verdade (signup/signin reais) precisaria do Firebase
 * Auth Emulator configurado — não vale o custo de setup ainda pra este
 * projeto; ver README "Próximos passos sugeridos".
 */

test("visitante sem sessão é redirecionado pra /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("tela de login mostra os elementos principais", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: /Entrar no/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar com Google" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
});

test("cadastro com senhas diferentes mostra erro sem chamar o Firebase", async ({ page }) => {
  await page.goto("/login");

  // Alterna pro modo de cadastro (link no rodapé, ainda em modo "signin").
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();

  await expect(page.getByLabel("Confirmar senha", { exact: true })).toBeVisible();

  await page.getByLabel("E-mail").fill("teste@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("senha123");
  await page.getByLabel("Confirmar senha", { exact: true }).fill("outrasenha456");

  await page.getByRole("button", { name: "Criar conta", exact: true }).click();

  await expect(page.getByText("As senhas não coincidem.")).toBeVisible();
});

test("alternar entre entrar/cadastrar troca os campos do formulário", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByLabel("Confirmar senha", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByLabel("Confirmar senha", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByLabel("Confirmar senha", { exact: true })).toHaveCount(0);
});
