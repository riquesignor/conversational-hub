import { randomUUID } from "node:crypto";
import { streamText, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { getModel } from "@/lib/llm/provider";
import { checkRateLimit } from "@/lib/rate-limit";
import { getTools } from "@/lib/skills";
import { getStore } from "@/lib/db";
import { getPersona } from "@/lib/personas";
import { getSessionUser } from "@/lib/auth/session";
import { truncate } from "@/lib/format";

export const runtime = "nodejs";
export const maxDuration = 30;

// Instruções que valem pra qualquer persona (ferramentas disponíveis,
// idioma) — o tom de voz em si vive em `lib/personas.ts` e é concatenado
// em `buildSystemPrompt` abaixo. Separado assim pra trocar de persona
// nunca arriscar quebrar a parte que ensina o modelo a usar as tools.
const BASE_INSTRUCTIONS =
  "Você é um assistente de portfólio. " +
  "Responda em português por padrão, a menos que o usuário escreva em outro idioma. " +
  "Você tem ferramentas (tools) disponíveis — use-as sempre que fizerem sentido em " +
  "vez de tentar adivinhar: data/hora atual, contas matemáticas, busca de Pokémon " +
  'na PokéAPI e consulta de endereço por CEP. Se o usuário perguntar o que você ' +
  'sabe fazer, use a tool "list_skills" em vez de responder de memória, porque a ' +
  "lista pode mudar.";

function buildSystemPrompt(personaId: string | undefined): string {
  const persona = getPersona(personaId);
  return `${BASE_INSTRUCTIONS}\n\n${persona.tone}`;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return "";
  return last.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

export async function POST(req: Request) {
  // Login é obrigatório pra usar o chat (ver middleware.ts) — mas o
  // middleware só checa se o cookie EXISTE, não se ele é válido (Edge
  // runtime não roda o Admin SDK). A verificação de verdade é aqui: sem uid
  // confirmado pelo Admin SDK, a rota nem chega a chamar o modelo.
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Não autenticado. Faça login pra conversar." }, { status: 401 });
  }

  const ip = getClientIp(req);
  const { allowed } = checkRateLimit(ip);

  if (!allowed) {
    return Response.json(
      { error: "Muitas mensagens em pouco tempo. Aguarde um minuto e tente de novo." },
      { status: 429 },
    );
  }

  // `id` vem automaticamente no corpo da requisição — é o `id` do `useChat`
  // no cliente (app/page.tsx), o id da CONVERSA (thread) ativa na sidebar.
  // Quem decide DE QUEM é essa thread é sempre `user.uid` (do cookie
  // verificado acima), nunca um campo vindo do corpo — o client não tem
  // como escrever na área de outro uid nem manipulando a requisição.
  const {
    messages,
    personaId,
    id: threadId,
  }: { messages: UIMessage[]; personaId?: string; id?: string } = await req.json();

  const effectiveThreadId = threadId || randomUUID();
  const store = getStore();

  // Persistência é best-effort: nunca deve derrubar a resposta do chat.
  const userText = lastUserText(messages);
  if (userText) {
    store
      .appendMessage(user.uid, effectiveThreadId, {
        id: randomUUID(),
        role: "user",
        text: userText,
        createdAt: Date.now(),
      })
      .catch((err) => console.error("[api/chat] falha ao salvar mensagem do usuário:", err));

    // title só "pega" na criação da thread (primeira mensagem) — ver o
    // contrato do método em lib/db/types.ts. Em turnos seguintes isto só
    // atualiza personaId/lastMessagePreview/updatedAt.
    store
      .touchThread(user.uid, effectiveThreadId, {
        title: truncate(userText, 40),
        personaId,
        lastMessagePreview: truncate(userText, 48),
      })
      .catch((err) => console.error("[api/chat] falha ao atualizar metadados da thread:", err));
  }

  const result = streamText({
    model: getModel(),
    system: buildSystemPrompt(personaId),
    messages: await convertToModelMessages(messages),
    tools: getTools(),
    // Permite até 5 "passos": o modelo pode chamar uma tool, ler o
    // resultado e responder (ou encadear outra tool) antes de finalizar.
    // Sem isso, a AI SDK para no primeiro tool call e nunca gera a
    // resposta em texto que usa o resultado da tool.
    stopWhen: stepCountIs(5),
    onFinish: ({ text }) => {
      if (!text) return;
      store
        .appendMessage(user.uid, effectiveThreadId, {
          id: randomUUID(),
          role: "assistant",
          text,
          createdAt: Date.now(),
        })
        .catch((err) => console.error("[api/chat] falha ao salvar resposta do bot:", err));

      store
        .touchThread(user.uid, effectiveThreadId, { lastMessagePreview: truncate(text, 48) })
        .catch((err) => console.error("[api/chat] falha ao atualizar prévia da thread:", err));
    },
    // Sem isso, um erro do provider (chave inválida, quota, modelo errado
    // etc.) vira só "An error occurred" pro cliente e some sem deixar
    // rastro nenhum no log da Vercel. Loga o erro real aqui.
    onError: ({ error }) => {
      console.error("[api/chat] streamText error:", error);
    },
  });

  return result.toUIMessageStreamResponse({
    // Mesma lógica: a AI SDK mascara erros de servidor por padrão pra não
    // vazar detalhes sensíveis pro cliente. Logamos o erro real aqui
    // também (fica no Runtime Log da Vercel) e devolvemos uma mensagem
    // só um pouco mais específica pro usuário final.
    onError: (error) => {
      console.error("[api/chat] stream response error:", error);
      return "Erro ao gerar resposta. Verifique a chave de API e o provider configurados.";
    },
  });
}
