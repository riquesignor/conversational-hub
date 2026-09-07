import { tool } from "ai";
import { z } from "zod";

/**
 * Habilidade sem I/O externo nenhum — serve de exemplo mínimo de tool e
 * também é genuinamente útil, já que o modelo não tem noção real de "agora".
 */
export const getDateTimeTool = tool({
  description:
    "Retorna a data e a hora atuais no fuso de São Paulo (America/Sao_Paulo). " +
    "Use sempre que o usuário perguntar que dia/hora é, ou precisar de uma " +
    "referência temporal real (o modelo não sabe a hora atual sozinho).",
  inputSchema: z.object({}),
  execute: async () => {
    const now = new Date();
    return {
      iso: now.toISOString(),
      formatted: new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(now),
    };
  },
});
