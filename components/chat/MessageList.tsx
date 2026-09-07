"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: UIMessage[];
  botName: string;
  isSubmitted: boolean;
  isLoading: boolean;
  error: Error | undefined;
  onEdit: (text: string) => void;
  onRedo: () => void;
  onRetry: () => void;
}

export function MessageList({
  messages,
  botName,
  isSubmitted,
  isLoading,
  error,
  onEdit,
  onRedo,
  onRetry,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSubmitted]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3.5 px-4 py-5 sm:px-8">
      {messages.map((message, i) => (
        <MessageBubble
          key={message.id}
          message={message}
          botName={botName}
          showRedo={!isLoading && message.role === "assistant" && i === messages.length - 1}
          onEdit={onEdit}
          onRedo={onRedo}
        />
      ))}

      {isSubmitted && (
        <div className="flex animate-fade-in-up flex-col items-start">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-accent-text">
            {botName}
          </span>
          <div className="flex items-center gap-1.5 border-l-2 border-accent bg-surface px-3.5 py-3">
            <span className="h-1.5 w-1.5 animate-dot-pulse bg-accent-text" />
            <span
              className="h-1.5 w-1.5 animate-dot-pulse bg-accent-text"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="h-1.5 w-1.5 animate-dot-pulse bg-accent-text"
              style={{ animationDelay: "300ms" }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2.5 border-l-2 border-accent-strong bg-surface px-3 py-2.5">
          <p className="m-0 text-sm">Algo travou aqui. Tenta de novo?</p>
          <button
            onClick={onRetry}
            className="flex-none border border-divider px-2.5 py-1.5 text-xs font-semibold text-accent-text transition-colors hover:bg-surface-2"
          >
            Tentar de novo
          </button>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
