import { tool } from "ai";
import { z } from "zod";
import Parser from "rss-parser";

// Feeds RSS públicos, sem chave/cadastro — mesma filosofia de lookup-cep.ts
// e lookup-pokemon.ts ("zero custo, zero cadastro"). Motorsport.com expõe um
// feed por categoria (mesmo padrão de URL pras 3 categorias de automobilismo);
// G1 expõe um feed por editoria via o padrão "dynamo/<editoria>/rss2.xml".
// Todas as 4 URLs foram confirmadas manualmente (curl) antes de entrar aqui.
const FEEDS = {
  politica: "https://g1.globo.com/dynamo/politica/rss2.xml",
  f1: "https://www.motorsport.com/rss/f1/news/",
  f2: "https://www.motorsport.com/rss/f2/news/",
  wec: "https://www.motorsport.com/rss/wec/news/",
} as const;

type NewsCategory = keyof typeof FEEDS;

const parser = new Parser();

export const getNewsTool = tool({
  description:
    "Busca as manchetes mais recentes de uma categoria de notícia (política brasileira, " +
    "Fórmula 1, Fórmula 2 ou WEC) a partir de feeds RSS oficiais. Use quando o usuário " +
    "pedir notícias recentes dessas categorias.",
  inputSchema: z.object({
    category: z
      .enum(["politica", "f1", "f2", "wec"])
      .describe("Categoria de notícia a buscar."),
  }),
  execute: async ({ category }: { category: NewsCategory }) => {
    const url = FEEDS[category];

    try {
      // Busca o XML manualmente (em vez de parser.parseURL) pra reaproveitar
      // o mesmo padrão de timeout via AbortSignal usado no resto de
      // lib/skills/ — fetch nativo do Node já decodifica gzip sozinho
      // (diferente do curl, que precisa de --compressed explícito).
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        return { error: `Feed de notícias respondeu com status ${res.status}.` };
      }

      const xml = await res.text();
      const feed = await parser.parseString(xml);
      const items = (feed.items ?? []).slice(0, 8).map((item) => ({
        title: item.title,
        link: item.link,
        publishedAt: item.pubDate,
        summary: item.contentSnippet?.slice(0, 280),
      }));

      if (!items.length) {
        return { error: `Nenhuma notícia encontrada no feed de "${category}".` };
      }

      return { category, items };
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      return {
        error: timedOut
          ? "Feed de notícias demorou demais para responder."
          : "Falha ao buscar notícias.",
      };
    }
  },
});
