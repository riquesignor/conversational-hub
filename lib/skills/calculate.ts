import { tool } from "ai";
import { z } from "zod";

/**
 * Parser recursivo descendente pra +,-,*,/,%,() e números decimais.
 *
 * Deliberadamente NÃO usa `eval`/`new Function` sobre a string do usuário:
 * mesmo com sanitização por regex, avaliar código arbitrário a partir de
 * input de um LLM (que por sua vez ecoa input de usuário anônimo na
 * internet) é a categoria de bug que vira CVE. Um parser dedicado só
 * reconhece a gramática abaixo — não há caminho pra executar nada além de
 * aritmética.
 */
class CalcError extends Error {}

function tokenize(expr: string): string[] {
  const tokens = expr.match(/\d+\.?\d*|\.\d+|[+\-*/%()]/g);
  if (!tokens || tokens.join("") !== expr.replace(/\s+/g, "")) {
    throw new CalcError("Expressão contém caracteres não suportados.");
  }
  return tokens;
}

function parseExpression(tokens: string[], pos: { i: number }): number {
  let value = parseTerm(tokens, pos);
  while (tokens[pos.i] === "+" || tokens[pos.i] === "-") {
    const op = tokens[pos.i++];
    const rhs = parseTerm(tokens, pos);
    value = op === "+" ? value + rhs : value - rhs;
  }
  return value;
}

function parseTerm(tokens: string[], pos: { i: number }): number {
  let value = parseUnary(tokens, pos);
  while (
    tokens[pos.i] === "*" ||
    tokens[pos.i] === "/" ||
    tokens[pos.i] === "%"
  ) {
    const op = tokens[pos.i++];
    const rhs = parseUnary(tokens, pos);
    if ((op === "/" || op === "%") && rhs === 0) {
      throw new CalcError("Divisão por zero.");
    }
    value = op === "*" ? value * rhs : op === "/" ? value / rhs : value % rhs;
  }
  return value;
}

function parseUnary(tokens: string[], pos: { i: number }): number {
  if (tokens[pos.i] === "-") {
    pos.i++;
    return -parseUnary(tokens, pos);
  }
  if (tokens[pos.i] === "+") {
    pos.i++;
    return parseUnary(tokens, pos);
  }
  return parsePrimary(tokens, pos);
}

function parsePrimary(tokens: string[], pos: { i: number }): number {
  const token = tokens[pos.i];
  if (token === undefined) throw new CalcError("Expressão incompleta.");

  if (token === "(") {
    pos.i++;
    const value = parseExpression(tokens, pos);
    if (tokens[pos.i] !== ")") throw new CalcError("Parêntese não fechado.");
    pos.i++;
    return value;
  }

  if (/^\d/.test(token) || token.startsWith(".")) {
    pos.i++;
    return Number(token);
  }

  throw new CalcError(`Token inesperado: "${token}"`);
}

export function evaluateExpression(expr: string): number {
  const tokens = tokenize(expr);
  const pos = { i: 0 };
  const result = parseExpression(tokens, pos);
  if (pos.i !== tokens.length) {
    throw new CalcError(`Token inesperado após a expressão: "${tokens[pos.i]}"`);
  }
  if (!Number.isFinite(result)) {
    throw new CalcError("Resultado não é um número finito.");
  }
  return result;
}

export const calculateTool = tool({
  description:
    "Resolve uma expressão matemática (+, -, *, /, %, parênteses, decimais). " +
    "Use isso em vez de calcular de cabeça sempre que o usuário pedir uma " +
    "conta — garante precisão exata em vez de aproximação do modelo.",
  inputSchema: z.object({
    expression: z
      .string()
      .describe('Expressão matemática, ex: "(12.5 + 7) * 3 % 4"'),
  }),
  execute: async ({ expression }) => {
    try {
      return { result: evaluateExpression(expression) };
    } catch (err) {
      return {
        error: err instanceof CalcError ? err.message : "Expressão inválida.",
      };
    }
  },
});
