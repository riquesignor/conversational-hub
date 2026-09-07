export type MessageSegment =
  | { type: "text"; text: string }
  | { type: "code"; language: string; code: string };

/**
 * Parser bem simples de blocos de código cercados por ``` dentro do texto de
 * uma mensagem — não é um parser de markdown completo (sem negrito/itálico/
 * links, só o suficiente pra separar texto normal de código). Sem isso, uma
 * resposta com um comando/trecho de código aparecia como texto cru na UI,
 * com os ``` literais visíveis.
 */
export function parseMessageContent(text: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const fenceRegex = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }
    const [, language, code] = match;
    segments.push({
      type: "code",
      language: language || "texto",
      code: code.replace(/\n$/, ""),
    });
    lastIndex = fenceRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", text: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ type: "text", text });
  }

  return segments;
}
