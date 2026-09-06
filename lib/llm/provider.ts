import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Abstração de provider de LLM.
 *
 * Hoje só a OpenAI está instalada e implementada. Para adicionar outro
 * provider mais tarde (Groq, Google Gemini, etc.):
 *
 *   1. npm install @ai-sdk/groq   (ou @ai-sdk/google)
 *   2. importe o factory no topo deste arquivo
 *   3. adicione um `case` no switch abaixo
 *   4. mude LLM_PROVIDER no .env.local
 *
 * Todo provider da AI SDK implementa a mesma interface `LanguageModel`,
 * então nenhum outro arquivo do projeto (rota, UI) precisa saber qual
 * provider está ativo.
 */
export function getModel(): LanguageModel {
  const provider = process.env.LLM_PROVIDER ?? "openai";

  switch (provider) {
    case "openai":
      return openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini");

    default:
      throw new Error(
        `LLM_PROVIDER="${provider}" não implementado em lib/llm/provider.ts`,
      );
  }
}
