"use client";

import type { UIMessage } from "ai";
import { isToolUIPart, getToolName } from "ai";
// Import DIRETO de catalog.ts, não do barrel @/lib/skills: esse barrel
// também importa (pra montar getTools()) cada tool de verdade — e cada uma
// delas importa `zod` pro inputSchema. Como MessageBubble é client component,
// importar do barrel puxava as 5 tools (e o zod inteiro, ~250KB no bundle
// medido com `npm run analyze`) pro cliente só pra ler um array estático de
// {id,title,description}. catalog.ts não depende de zod nem de nada
// server-only — só o barrel misturava as duas coisas.
import { SKILLS_CATALOG } from "@/lib/skills/catalog";
import { renderToolSummary } from "@/lib/skills/render-tool-output";
import { parseMessageContent } from "@/lib/parse-message-content";
import { CodeBlock } from "./CodeBlock";
import { RedoIcon, EditIcon, CopyIcon, PdfIcon, FileIcon } from "./icons";

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

/** Exportado pro MessageList usar como heurística de altura estimada por
 * linha na virtualização (ver components/chat/MessageList.tsx) — evita
 * duplicar a lógica de "extrair o texto plano de um UIMessage". */
export function messageText(message: UIMessage): string {
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
                    className={`whitespace-pre-wrap rounded-[var(--radius-md)] px-3.5 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? "bg-user-bubble-bg text-user-bubble-text rounded-br-[6px]"
                        : "border border-divider bg-surface text-text rounded-bl-[6px]"
                    }`}
                  >
                    {seg.text}
                  </div>
                ) : null,
              )}
            </div>
          );
        }

        if (part.type === "file") {
          const isImage = part.mediaType.startsWith("image/");
          return (
            <div key={i} className={`flex max-w-[82%] ${isUser ? "justify-end" : "justify-start"}`}>
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- a URL tanto pode ser uma data URL otimista (mensagem ainda não persistida) quanto o proxy autenticado (StoredAttachment.url) — nenhuma das duas é um asset estático que o next/image saiba otimizar.
                <img
                  src={part.url}
                  alt={part.filename ?? "Imagem enviada"}
                  className="block max-h-64 max-w-full rounded-[var(--radius-md)] border border-divider object-contain"
                />
              ) : (
                <a
                  href={part.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border border-divider bg-surface-2 px-3 py-2 text-xs font-semibold text-text hover:bg-surface"
                >
                  {part.mediaType === "application/pdf" ? <PdfIcon size={14} /> : <FileIcon size={14} />}
                  <span className="max-w-[200px] truncate">{part.filename ?? "Arquivo"}</span>
                </a>
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
              className="my-0.5 max-w-[82%] rounded-md border border-dashed border-divider bg-surface-2 px-2.5 py-1.5 text-xs"
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
