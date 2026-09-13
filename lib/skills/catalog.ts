export interface SkillMeta {
  /** Precisa bater com a chave usada em `lib/skills/index.ts` e com o nome
   * da tool passado pro `streamText` — é assim que a UI (app/page.tsx)
   * casa um tool call em andamento com o título/ícone certo. */
  id: string;
  title: string;
  description: string;
}

/**
 * Catálogo de "habilidades" do bot — fonte única de verdade para:
 *  - a tool `list_skills` (o próprio modelo consulta isso quando alguém
 *    pergunta "o que você sabe fazer?");
 *  - a UI, que usa o título/descrição pra mostrar o que está rodando
 *    enquanto uma tool está em execução.
 *
 * Pra adicionar uma habilidade nova:
 *  1. Crie `lib/skills/minha-skill.ts` exportando uma `tool({ ... })` da AI SDK.
 *  2. Registre um item aqui com o mesmo `id` da chave que você vai usar em
 *     `getTools()` (index.ts).
 *  3. Importe e adicione a tool em `getTools()` (index.ts).
 * Não precisa mexer em mais nada — nem no route.ts, nem na UI.
 */
export const SKILLS_CATALOG: SkillMeta[] = [
  {
    id: "get_datetime",
    title: "Data e hora",
    description: "Diz a data e a hora atuais (fuso de São Paulo).",
  },
  {
    id: "calculate",
    title: "Calculadora",
    description:
      "Resolve expressões matemáticas (+, -, *, /, %, parênteses) com precisão exata.",
  },
  {
    id: "lookup_pokemon",
    title: "Pokédex",
    description:
      "Busca um Pokémon na PokéAPI: tipo, altura, peso e habilidades.",
  },
  {
    id: "lookup_cep",
    title: "CEP",
    description:
      "Busca endereço (rua, bairro, cidade, UF, DDD) a partir de um CEP brasileiro.",
  },
  {
    id: "list_skills",
    title: "Lista de habilidades",
    description: "Lista tudo que o bot sabe fazer hoje.",
  },
  {
    // Única entrada aqui que NÃO é uma tool implementada em lib/skills/ —
    // é a busca nativa do Gemini (ver getWebSearchTools() em
    // lib/llm/provider.ts), só listada de propósito pra o `list_skills`
    // avisar o modelo que ela existe e pra MessageBubble.tsx mostrar um
    // título legível em vez do nome cru da tool ("google_search") enquanto
    // ela roda. Só aparece de fato quando LLM_PROVIDER=google (default).
    id: "google_search",
    title: "Busca no Google",
    description: "Pesquisa na web em tempo real (Google Search) quando a informação pode ter mudado ou não é de conhecimento geral.",
  },
];
