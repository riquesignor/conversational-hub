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
  });

  return result.toUIMessageStreamResponse();
}
