import { describe, expect, it } from "vitest";
import { truncate } from "./format";

describe("truncate", () => {
  it("devolve o texto original quando já cabe no limite", () => {
    expect(truncate("oi", 10)).toBe("oi");
  });

  it("corta e adiciona reticência quando passa do limite", () => {
    // "abcdefghij" tem 10 chars, max=5 -> 4 chars + "…"
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
  });

  it("colapsa espaços internos múltiplos em um só", () => {
    expect(truncate("oi   tudo    bem", 100)).toBe("oi tudo bem");
  });

  it("tira espaço nas pontas antes de medir o limite", () => {
    expect(truncate("   oi   ", 10)).toBe("oi");
  });

  it("string vazia (ou só espaço) devolve vazia, não quebra", () => {
    expect(truncate("   ", 10)).toBe("");
    expect(truncate("", 10)).toBe("");
  });

  it("edge case: texto exatamente do tamanho do limite não trunca", () => {
    expect(truncate("abcde", 5)).toBe("abcde");
  });

  it("edge case: um char a mais do que o limite ainda trunca certo", () => {
    expect(truncate("abcdef", 5)).toBe("abcd…");
  });
});
