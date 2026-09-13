import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { LanguageModel, ToolSet } from "ai";

// "||" em vez de "??" de propósito: uma env var criada com valor em branco
// (comum em painéis como o da Vercel) chega como string vazia, não como
// undefined — "??" não pega esse caso e derruba o switch no default. "||"
// trata "" como "não definido" também.
function activeProvider(): string {
  return process.env.LLM_PROVIDER || "google";
}

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
  const provider = activeProvider();

  switch (provider) {
    case "google":
      // Chave lida automaticamente de GOOGLE_GENERATIVE_AI_API_KEY.
      return google(process.env.GOOGLE_MODEL || "gemini-3.5-flash");

    case "openai":
      return openai(process.env.OPENAI_MODEL || "gpt-4o-mini");

    default:
      throw new Error(
        `LLM_PROVIDER="${provider}" não implementado em lib/llm/provider.ts`,
      );
  }
}

/**
 * Tool(s) de busca na web NATIVAS do provider ativo — não uma tool nossa
 * (compare com lib/skills/, que são todas implementadas neste projeto). O
 * Gemini expõe "Google Search grounding" como uma tool de primeira classe do
 * próprio modelo: zero chave nova, zero custo além do que já está
 * configurado (mesma chave GOOGLE_GENERATIVE_AI_API_KEY do getModel() acima).
 *
 * Só existe pro provider "google" hoje — a OpenAI não expõe um equivalente
 * gratuito/nativo pelo @ai-sdk/openai, e este projeto não assume nenhuma
 * chave paga de busca (Tavily/Brave/Serper) que o dono do fork não pediu.
 * Se um dia trocar pra "openai" e quiser busca na web, o lugar certo pra
 * adicionar uma tool própria é aqui, num novo `case` do switch abaixo — o
 * resto do projeto (route.ts) já não sabe/não precisa saber qual provider
 * está ativo, só chama getWebSearchTools() e espalha o resultado nas tools.
 */
export function getWebSearchTools(): ToolSet {
  switch (activeProvider()) {
    case "google":
      return { google_search: google.tools.googleSearch({}) };
    default:
      return {};
  }
}
