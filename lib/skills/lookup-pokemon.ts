import { tool } from "ai";
import { z } from "zod";

// Endpoint público, sem chave — mesma categoria de API livre usada no resto
// do projeto (mantém "zero custo, zero cadastro").
const POKEAPI_BASE = "https://pokeapi.co/api/v2/pokemon";

interface PokeApiResponse {
  name: string;
  height: number; // decímetros
  weight: number; // hectogramas
  types: { type: { name: string } }[];
  abilities: { ability: { name: string } }[];
}

export const lookupPokemonTool = tool({
  description:
    "Busca dados de um Pokémon (tipo, altura, peso, habilidades) na PokéAPI " +
    "pública. Use quando o usuário perguntar sobre um Pokémon específico " +
    "pelo nome ou número da Pokédex.",
  inputSchema: z.object({
    name: z
      .string()
      .describe('Nome ou número do Pokémon, ex: "pikachu" ou "25"'),
  }),
  execute: async ({ name }) => {
    const query = name.trim().toLowerCase();
    if (!query) return { error: "Nome ou número do Pokémon não pode ser vazio." };

    try {
      const res = await fetch(`${POKEAPI_BASE}/${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(8_000),
      });

      if (res.status === 404) {
        return { error: `Nenhum Pokémon encontrado para "${name}".` };
      }
      if (!res.ok) {
        return { error: `PokéAPI respondeu com status ${res.status}.` };
      }

      const data = (await res.json()) as PokeApiResponse;
      return {
        name: data.name,
        heightMeters: data.height / 10,
        weightKg: data.weight / 10,
        types: data.types.map((t) => t.type.name),
        abilities: data.abilities.map((a) => a.ability.name),
      };
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      return {
        error: timedOut
          ? "PokéAPI demorou demais para responder."
          : "Falha ao consultar a PokéAPI.",
      };
    }
  },
});
