import { tool } from "ai";
import { z } from "zod";

// Tavily (https://tavily.com) — free tier de 1000 buscas/mês, sem cartão de
// crédito. Diferente de raspar um motor de busca genérico, a API já foi
// desenhada pra consumo por agentes de LLM: devolve resultados resumidos
// (title/url/content) prontos pra colar no contexto do modelo, em vez de
// HTML cru que precisaria de parsing. Complementa getWebSearchTools() em
// lib/llm/provider.ts (Google Search grounding nativo do Gemini) — esta
// tool funciona com QUALQUER provider ativo (nvidia/openai/google), já que
// não depende de nenhuma feature nativa do modelo.
const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

interface TavilyResponse {
  answer?: string;
  results: TavilyResult[];
}

export const webSearchTool = tool({
  description:
    "Busca informações atuais na web (notícias, preços, versões de software, eventos " +
    "recentes, qualquer coisa que possa ter mudado depois do treinamento do modelo). " +
    "Use sempre que a pergunta depender de informação recente ou específica que você " +
    "não tem certeza de saber de memória.",
  inputSchema: z.object({
    query: z.string().describe("Termos de busca, em linguagem natural."),
  }),
  execute: async ({ query }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return { error: "Busca na web não configurada (TAVILY_API_KEY ausente)." };
    }

    try {
      const res = await fetch(TAVILY_SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          max_results: 5,
          search_depth: "basic",
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        return { error: `Tavily respondeu com status ${res.status}.` };
      }

      const data = (await res.json()) as TavilyResponse;
      if (!data.results?.length) {
        return { error: `Nenhum resultado encontrado para "${query}".` };
      }

      return {
        answer: data.answer,
        results: data.results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
        })),
      };
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      return {
        error: timedOut ? "Busca na web demorou demais para responder." : "Falha ao buscar na web.",
      };
    }
  },
});
