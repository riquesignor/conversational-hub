import { describe, expect, it } from "vitest";
import {
  classifyMediaType,
  guessMediaTypeFromFilename,
  validateAttachment,
  ATTACHMENT_KINDS,
} from "./constraints";

describe("classifyMediaType", () => {
  it("reconhece os tipos suportados de cada categoria", () => {
    expect(classifyMediaType("image/png")).toBe("image");
    expect(classifyMediaType("application/pdf")).toBe("pdf");
    expect(classifyMediaType("text/csv")).toBe("text");
  });

  it("devolve null pra tipo fora da lista (ex.: svg, por causa de XSS)", () => {
    expect(classifyMediaType("image/svg+xml")).toBeNull();
    expect(classifyMediaType("application/zip")).toBeNull();
  });
});

describe("guessMediaTypeFromFilename", () => {
  it("infere pela extensão quando File.type vem vazio", () => {
    expect(guessMediaTypeFromFilename("notas.md")).toBe("text/markdown");
    expect(guessMediaTypeFromFilename("dados.CSV")).toBe("text/csv");
    expect(guessMediaTypeFromFilename("relatorio.pdf")).toBe("application/pdf");
  });

  it("devolve null pra extensão desconhecida", () => {
    expect(guessMediaTypeFromFilename("arquivo.zip")).toBeNull();
    expect(guessMediaTypeFromFilename("sem-extensao")).toBeNull();
  });
});

describe("validateAttachment", () => {
  it("aceita dentro do teto de cada categoria", () => {
    expect(validateAttachment("image/png", ATTACHMENT_KINDS.image.maxBytes)).toEqual({ ok: true });
  });

  it("rejeita acima do teto da categoria", () => {
    const result = validateAttachment("application/pdf", ATTACHMENT_KINDS.pdf.maxBytes + 1);
    expect(result.ok).toBe(false);
  });

  it("rejeita mediaType não suportado", () => {
    const result = validateAttachment("application/zip", 100);
    expect(result.ok).toBe(false);
  });
});
