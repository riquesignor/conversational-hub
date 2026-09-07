"use client";

import type { UIMessage } from "ai";
import { isToolUIPart, getToolName } from "ai";
import { SKILLS_CATALOG } from "@/lib/skills";
import { renderToolSummary } from "@/lib/skills/render-tool-output";
import { parseMessageContent } from "@/lib/parse-message-content";
import { CodeBlock } from "./CodeBlock";
import { RedoIcon, EditIcon, CopyIcon } from "./icons";

interface MessageBubbleProps {
  message: UIMessage;
  botName: string;
  /** Só a última mensagem do assistente ganha o botão "Refazer" — regenerate()
   * da AI SDK sempre regenera a resposta mais recente, então o botão em
   * mensagens antigas não corresponderia ao que de fato aconteceria. */
  showRedo: boolean;
  onEdit: (text: string) => void;
  onRedo: () => void;
}

function messageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

export function MessageBubble({ message, botName, showRedo, onEdit, onRedo }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const text = messageText(message);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Sem clipboard disponível não trava o chat — só não copia.
    }
  }

  return (
    <div className={`flex animate-fade-in-up flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      {!isUser && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-text">
          {botName}
        </span>
      )}

      {message.parts.map((part, i) => {
        if (part.type === "text") {
          const segments = parseMessageContent(part.text);
          return (
            <div
              key={i}
              className={`flex max-w-[82%] flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}
            >
              {segments.map((seg, j) =>
                seg.type === "code" ? (
                  <CodeBlock key={j} language={seg.language} code={seg.code} />
                ) : seg.text.trim() ? (
                  <div
                    key={j}
                    className={`whitespace-pre-wrap px-3 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? "bg-user-bubble-bg text-user-bubble-text"
                        : "border-l-2 border-accent bg-surface text-text"
                    }`}
                  >
                    {seg.text}
                  </div>
                ) : null,
              )}
            </div>
          );
        }

        if (isToolUIPart(part)) {
          const toolName = getToolName(part);
          const title = SKILLS_CATALOG.find((s) => s.id === toolName)?.title ?? toolName;
          return (
            <div
              key={i}
              className="my-0.5 max-w-[82%] border border-dashed border-divider bg-surface-2 px-2.5 py-1.5 text-xs"
            >
              <span className="font-semibold uppercase tracking-wider text-accent-text">
                {title}
              </span>
              <span className="ml-1.5 text-muted">
                {part.state === "output-available"
                  ? renderToolSummary(toolName, part.output)
                  : part.state === "output-error"
                    ? part.errorText
                    : "usando…"}
              </span>
            </div>
          );
        }

        return null;
      })}

      {text.trim() && (
        <div className={`flex gap-1 ${isUser ? "justify-end" : "justify-start"}`}>
          {showRedo && (
            <button
              onClick={onRedo}
              title="Refazer"
              className="flex h-6 w-6 items-center justify-center text-muted hover:text-text"
            >
              <RedoIcon />
            </button>
          )}
          <button
            onClick={() => onEdit(text)}
            title="Editar"
            className="flex h-6 w-6 items-center justify-center text-muted hover:text-text"
          >
            <EditIcon />
          </button>
          <button
            onClick={handleCopy}
            title="Copiar"
            className="flex h-6 w-6 items-center justify-center text-muted hover:text-text"
          >
            <CopyIcon />
          </button>
        </div>
      )}
    </div>
  );
}
