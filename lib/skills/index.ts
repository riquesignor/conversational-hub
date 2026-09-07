import type { ToolSet } from "ai";
import { getDateTimeTool } from "./get-datetime";
import { calculateTool } from "./calculate";
import { lookupPokemonTool } from "./lookup-pokemon";
import { lookupCepTool } from "./lookup-cep";
import { listSkillsTool } from "./list-skills";

export { SKILLS_CATALOG, type SkillMeta } from "./catalog";

/**
 * Registro central das "habilidades" (tools) do bot — mesma ideia de
 * `lib/llm/provider.ts` pra provider de LLM: um único ponto de composição
 * pra não espalhar tool-por-tool pelo route.ts.
 *
 * As chaves aqui viram o nome da tool que o modelo enxerga (e o que chega
 * na UI como `tool-<chave>`), então precisam bater com os `id`s em
 * `catalog.ts`.
 */
export function getTools(): ToolSet {
  return {
    get_datetime: getDateTimeTool,
    calculate: calculateTool,
    lookup_pokemon: lookupPokemonTool,
    lookup_cep: lookupCepTool,
    list_skills: listSkillsTool,
  };
}
