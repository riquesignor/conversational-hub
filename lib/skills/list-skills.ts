import { tool } from "ai";
import { z } from "zod";
import { SKILLS_CATALOG } from "./catalog";

/**
 * Meta-habilidade: deixa o próprio modelo responder "o que você sabe fazer?"
 * com uma lista sempre em dia, em vez de depender do system prompt listar
 * (e desatualizar) cada tool manualmente.
 */
export const listSkillsTool = tool({
  description:
    "Lista as habilidades/ferramentas que o bot tem disponíveis hoje. Use " +
    'quando o usuário perguntar "o que você sabe fazer", "quais suas ' +
    'habilidades/features" ou algo parecido.',
  inputSchema: z.object({}),
  execute: async () => ({ skills: SKILLS_CATALOG }),
});
