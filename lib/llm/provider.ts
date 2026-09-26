import { openai, createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { LanguageModel, ToolSet } from "ai";

// "||" em vez de "??" de propósito: uma env var criada com valor em branco
// (comum em painéis como o da Vercel) chega como string vazia, não como
// undefined — "??" não pega esse caso e derruba o switch no default. "||"
// trata "" como "não definido" também.
function activeProvider(): string {
  return process.env.LLM_PROVIDER || "nvidia";
}

// NVIDIA NIM (https://build.nvidia.com) expõe uma API compatível com a da
// OpenAI (mesmo formato de request/response em /v1/chat/completions) — por
// isso reaproveitamos o `@ai-sdk/openai` em vez de instalar um pacote novo,
// só trocando a `baseURL` e a chave. Chave lida de NVIDIA_API_KEY (formato
// "nvapi-...", gerada em build.nvidia.com).
const nvidia = createOpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY,
  name: "nvidia",
});

/**
 * Abstração de provider de LLM.
 *
 * Default: NVIDIA NIM (catálogo grátis de dezenas de modelos — Llama,
 * Nemotron etc. — via build.nvidia.com, sem cartão de crédito).
 * Google Gemini e OpenAI continuam implementados como alternativas; troque
 * via LLM_PROVIDER no .env.local. OpenAI, desde maio/2026, exige cartão
 * cadastrado mesmo para o crédito de teste — use-a só se decidir pagar.
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
 *
 * `nvidiaModelOverride` — string exata de modelo NIM (ex.:
 * "nvidia/nemotron-3-super-120b-a12b"), resolvida em route.ts a partir do
 * `modelId` escolhido na UI (ver lib/models.ts). Só tem efeito quando o
 * provider ativo é "nvidia" — pra google/openai o modelo continua fixo por
 * env var, já que não têm seletor na UI.
 */
export function getModel(nvidiaModelOverride?: string): LanguageModel {
  const provider = activeProvider();

  switch (provider) {
    case "nvidia":
      return nvidia(
        nvidiaModelOverride || process.env.NVIDIA_MODEL || "nvidia/nemotron-3-super-120b-a12b",
      );

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
