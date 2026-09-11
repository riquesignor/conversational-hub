import { describe, expect, it } from "vitest";
import { translateAuthError } from "./errors";

/**
 * Cobre o switch inteiro — é código que já mudou de forma via cópia/cola
 * mais de uma vez neste projeto (ver histórico), e um `case` faltando ou
 * com o `code` errado aqui vira silenciosamente a mensagem genérica de
 * fallback pro usuário, sem nenhum erro de tipo acusando.
 */
describe("translateAuthError", () => {
  const cases: Array<[string, string]> = [
    ["auth/email-already-in-use", "Já existe uma conta com esse e-mail. Tenta entrar em vez de criar conta."],
    ["auth/invalid-email", "E-mail inválido."],
    ["auth/weak-password", "Senha fraca — use pelo menos 6 caracteres."],
    ["auth/invalid-credential", "E-mail ou senha incorretos."],
    ["auth/wrong-password", "E-mail ou senha incorretos."],
    ["auth/user-not-found", "E-mail ou senha incorretos."],
    ["auth/too-many-requests", "Muitas tentativas seguidas. Aguarda um pouco e tenta de novo."],
    ["auth/popup-closed-by-user", "Login cancelado."],
    ["auth/cancelled-popup-request", "Login cancelado."],
    ["auth/network-request-failed", "Falha de conexão. Verifica sua internet e tenta de novo."],
  ];

  it.each(cases)("traduz %s corretamente", (code, expected) => {
    expect(translateAuthError({ code })).toBe(expected);
  });

  it("código desconhecido cai no fallback genérico", () => {
    expect(translateAuthError({ code: "auth/isso-nao-existe" })).toBe(
      "Não deu pra completar o login. Tenta de novo em instantes.",
    );
  });

  it("erro sem propriedade code cai no fallback (não lança)", () => {
    expect(translateAuthError(new Error("algo genérico"))).toBe(
      "Não deu pra completar o login. Tenta de novo em instantes.",
    );
  });

  it("valores totalmente inesperados (null, string, number) não lançam", () => {
    expect(translateAuthError(null)).toBe("Não deu pra completar o login. Tenta de novo em instantes.");
    expect(translateAuthError("string qualquer")).toBe(
      "Não deu pra completar o login. Tenta de novo em instantes.",
    );
    expect(translateAuthError(42)).toBe("Não deu pra completar o login. Tenta de novo em instantes.");
    expect(translateAuthError(undefined)).toBe(
      "Não deu pra completar o login. Tenta de novo em instantes.",
    );
  });
});
