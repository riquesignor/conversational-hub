import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { getModel } from "@/lib/llm/provider";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM_PROMPT =
  "Você é um assistente de portfólio: simpático, direto e objetivo. " +
  "Responda em português por padrão, a menos que o usuário escreva em outro idioma.";

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const { allowed } = checkRateLimit(ip);

  if (!allowed) {
    return Response.json(
      { error: "Muitas mensagens em pouco tempo. Aguarde um minuto e tente de novo." },
      { status: 429 },
    );
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
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
