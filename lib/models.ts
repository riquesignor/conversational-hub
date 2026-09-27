export interface NimModel {
  /** Chave estável enviada pelo cliente (`app/page.tsx`) pro backend
   * (`app/api/chat/route.ts`) via `body.modelId`. Só existe/faz sentido
   * quando LLM_PROVIDER=nvidia — ver `lib/llm/provider.ts`. */
  id: string;
  /** Label curto exibido no seletor de modelo da UI. */
  label: string;
  /** Descrição curta de pra que esse modelo é melhor — mostrada no
   * dropdown do Composer e na tela de Configurações. */
  description: string;
  /** String exata esperada pelo campo "model" da API da NVIDIA NIM
   * (https://integrate.api.nvidia.com/v1) — copiada da página de cada
   * modelo em build.nvidia.com. Se a NVIDIA renomear/aposentar um modelo,
   * é só atualizar aqui. */
  modelString: string;
  /** `max_tokens` a mandar pro provider (`streamText({ maxOutputTokens })`).
   * SEM isso, cada modelo cai no default do próprio endpoint da NVIDIA, que
   * varia muito e pode truncar a resposta antes de gerar texto nenhum —
   * principalmente em modelo "reasoning" (ver `nemotron-lightning` abaixo),
   * que gasta parte do orçamento de tokens "pensando" antes de responder.
   * Valores aqui espelham o exemplo oficial de cada modelo em
   * build.nvidia.com (aba "Build" → código de exemplo). */
  maxOutputTokens: number;
  /** Só true pro modelo que a NVIDIA lista com "Input Modalities: Image"
   * (ver build.nvidia.com). Mandar imagem pra um modelo texto-only não dá
   * erro claro — o request "funciona" mas o modelo não sabe o que fazer
   * com o conteúdo, e o resultado é uma resposta vazia (ver route.ts, que
   * bloqueia isso antes de chamar o provider). */
  supportsImages: boolean;
}

/**
 * Modelos disponíveis pro seletor na UI quando LLM_PROVIDER=nvidia.
 * Curadoria pequena de propósito (catálogo completo tem 100+ modelos em
 * build.nvidia.com) — só modelos com function-calling confirmado, já que
 * as tools do bot (lib/skills/) dependem disso.
 *
 * Pra adicionar um modelo novo: só acrescente um item aqui (confirme o
 * `modelString` exato na página do modelo em build.nvidia.com). Nenhum
 * outro arquivo precisa mudar — `route.ts` lê pelo `id` recebido no corpo
 * da requisição, e `page.tsx`/`Composer.tsx` renderizam o seletor a partir
 * desta lista.
 */
export const NIM_MODELS: NimModel[] = [
  {
    id: "nemotron-super",
    label: "Nemotron Super",
    description:
      "Melhor equilíbrio geral: raciocínio agentic, contexto de 1M tokens, ótimo em " +
      "planejamento e uso de ferramentas. Bom default pra maioria das conversas.",
    modelString: "nvidia/nemotron-3-super-120b-a12b",
    maxOutputTokens: 4096,
    supportsImages: false,
  },
  {
    id: "nemotron-lightning",
    label: "Nemotron Lightning",
    description:
      "Versão mais rápida e leve da família Nemotron — respostas mais ágeis, custo " +
      "menor. Boa escolha quando velocidade importa mais que profundidade.",
    modelString: "nvidia/nemotron-3.5-lightning-30b-a3b",
    // É um modelo "reasoning": por padrão gasta parte do orçamento de
    // tokens "pensando" antes do texto final (ver comentário do campo
    // acima) — o exemplo oficial da NVIDIA usa max_tokens=16384 por causa
    // disso. Não dá pra desligar esse modo de raciocínio por aqui (a AI SDK
    // não expõe o `extra_body.chat_template_kwargs` específico da NVIDIA
    // pra isso) — se ainda travar/vier vazio com esse orçamento, é sinal de
    // que precisa de mais tokens ainda ou de um cliente HTTP raw.
    maxOutputTokens: 16384,
    supportsImages: false,
  },
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4.1 Flash",
    description:
      "Forte em código, documentos longos e entendimento de imagem. Confirmado " +
      "instável com imagem no endpoint grátis da NVIDIA (às vezes trava sem " +
      "responder) — se isso acontecer, clique em \"Parar\" e tente o Kimi K3.",
    modelString: "deepseek-ai/deepseek-v4.1-flash",
    maxOutputTokens: 8192,
    supportsImages: true,
  },
  {
    id: "mistral-nemotron",
    label: "Mistral Nemotron",
    description:
      "Feito pra seguir instruções à risca e workflows com várias ferramentas em " +
      "sequência. Boa opção pra tarefas passo a passo bem definidas.",
    modelString: "mistralai/mistral-nemotron",
    maxOutputTokens: 4096,
    supportsImages: false,
  },
  {
    id: "kimi-k3",
    label: "Kimi K3",
    description:
      "Modelo grande e versátil (Moonshot AI) — raciocínio forte, function calling e " +
      "entendimento de imagem. Alternativa ao DeepSeek pra anexos visuais quando " +
      "precisar de mais poder de raciocínio.",
    modelString: "moonshotai/kimi-k3",
    // Também é "reasoning" (mesmo caso do Nemotron Lightning acima) — com
    // pouco orçamento de tokens o raciocínio consome tudo e a resposta final
    // sai vazia/degenerada. Confirmado funcionando bem com 4096.
    maxOutputTokens: 16384,
    supportsImages: true,
  },
];

export const DEFAULT_MODEL_ID = NIM_MODELS[0]!.id;

/** Resolve um `modelId` (possivelmente inválido/ausente, já que vem do
 * corpo de uma requisição HTTP) pra um `NimModel` concreto, caindo pra
 * default em vez de derrubar a rota com um `undefined`. */
export function getNimModel(id: string | undefined): NimModel {
  return NIM_MODELS.find((m) => m.id === id) ?? NIM_MODELS[0]!;
}
