import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/**
 * Abstração de provider de LLM.
 *
 * Default: Google Gemini (free tier real, sem cartão de crédito).
 * OpenAI também está implementada, mas desde maio/2026 a OpenAI exige
 * cartão cadastrado mesmo para o crédito de teste — use-a só se você
 * decidir pagar.
 *
 * Para adicionar outro provider mais tarde (ex.: Groq):
 *   1. npm install @ai-sdk/groq
 *   2. importe o factory no topo deste arquivo
 *   3. adicione um `case` no switch abaixo
 *   4. mude LLM_PROVIDER no .env.local
 *
 * Todo provider da AI SDK implementa a mesma interface `LanguageModel`,
 * então nenhum outro arquivo do projeto (rota, UI) precisa saber qual
 * provider está ativo.
 */
export function getModel(): LanguageModel {
  const provider = process.env.LLM_PROVIDER ?? "google";

  switch (provider) {
    case "google":
      // Chave lida automaticamente de GOOGLE_GENERATIVE_AI_API_KEY.
      return google(process.env.GOOGLE_MODEL ?? "gemini-3.5-flash");

    case "openai":
      return openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini");

    default:
      throw new Error(
        `LLM_PROVIDER="${provider}" não implementado em lib/llm/provider.ts`,
      );
  }
}
