export interface Persona {
  /** Chave estável enviada pelo cliente (`app/page.tsx`) pro backend
   * (`app/api/chat/route.ts`) via `body.personaId`. Não muda o nome/avatar
   * do bot — só o tom das respostas (ver `buildSystemPrompt` em route.ts). */
  id: string;
  /** Label curto exibido no seletor de persona da UI. */
  label: string;
  /** Texto mostrado na tela vazia do chat, embaixo do nome do bot. */
  tagline: string;
  /** Instrução de tom, concatenada às instruções-base do system prompt
   * (ferramentas disponíveis, idioma etc. — essas não mudam por persona). */
  tone: string;
}

/**
 * Personas disponíveis pro seletor na UI. Trocar de persona não troca o
 * modelo, as tools nem o histórico — só o tom das respostas dali em diante
 * (mesmo padrão de "instruções customizadas" de outros chatbots).
 *
 * Pra adicionar uma persona nova: só acrescente um item aqui. Nenhum outro
 * arquivo precisa mudar — `route.ts` lê pelo `id` recebido no corpo da
 * requisição, e `page.tsx` renderiza o `<select>` a partir desta lista.
 */
export const PERSONAS: Persona[] = [
  {
    id: "kado",
    label: "Kado",
    tagline: "Pesquiso coisa, destrincho erro chato ou só bato um papo. Manda a boa.",
    tone:
      "Tom: descontraído e direto, como um amigo que manja de tecnologia batendo " +
      "papo por mensagem. Pode usar linguagem informal e gírias leves, sem exagerar.",
  },
  {
    id: "consultor",
    label: "Consultor",
    tagline: "Respostas objetivas e formais para consultas técnicas.",
    tone:
      "Tom: formal, profissional e conciso, como um consultor técnico se dirigindo " +
      "a um cliente corporativo. Evite gírias e emojis; vá direto ao ponto.",
  },
  {
    id: "professor",
    label: "Professor",
    tagline: "Explico passo a passo, com paciência e exemplos.",
    tone:
      "Tom: didático e paciente, como um professor explicando pra um aluno. Divida " +
      "explicações em passos, use analogias simples e confirme o entendimento.",
  },
];

export const DEFAULT_PERSONA_ID = PERSONAS[0].id;

/** Resolve um `personaId` (possivelmente inválido/ausente, já que vem do
 * corpo de uma requisição HTTP) pra uma `Persona` concreta, caindo pra
 * default em vez de derrubar a rota com um `undefined`. */
export function getPersona(id: string | undefined): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}
