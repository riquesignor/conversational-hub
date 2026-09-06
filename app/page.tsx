"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";

// Nome e tagline do bot centralizados aqui — troque à vontade.
const BOT_NAME = "Zezinho";
const TAGLINE =
  "Pesquiso coisa, destrincho erro chato ou só bato um papo. Manda a boa.";

const SUGGESTED_CHIPS = [
  "Pesquisa algo rápido pra mim",
  "Me ajuda a entender esse erro",
  "Explica um conceito complicado",
  "Só bora trocar uma ideia",
];

// Largura de leitura confortável para o conteúdo (mensagens/input) em telas
// grandes — o header e a barra de input ocupam a largura toda, só o miolo
// fica centralizado, igual ChatGPT/Claude no desktop.
const CONTENT_WIDTH = "w-full max-w-2xl mx-auto";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "submitted" || status === "streaming";
  const isEmpty = messages.length === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput("");
  }

  function handleChipClick(label: string) {
    if (isLoading) return;
    sendMessage({ text: label });
  }

  return (
    <main className="flex h-dvh flex-col bg-bg text-text">
      {/* Header — largura total, miolo alinhado à esquerda (Modernist nunca centraliza) */}
      <header className="flex flex-none items-center gap-3 border-b-2 border-divider bg-surface px-4 py-3 sm:px-6">
        <div className="relative flex-none">
          <div className="flex h-9 w-9 items-center justify-center bg-accent-strong text-base font-extrabold text-on-accent">
            {BOT_NAME.charAt(0).toUpperCase()}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 animate-presence-pulse border-2 border-surface bg-accent" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-extrabold">{BOT_NAME}</span>
          <span className="text-xs text-muted">
            {isLoading ? "digitando…" : "online agora"}
          </span>
        </div>
      </header>

      {/* Corpo */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {isEmpty ? (
          <div className={`flex flex-1 flex-col items-start justify-center gap-3 px-6 py-10 ${CONTENT_WIDTH}`}>
            <div className="mb-1 flex h-[52px] w-[52px] items-center justify-center bg-accent-strong text-2xl font-extrabold text-on-accent">
              {BOT_NAME.charAt(0).toUpperCase()}
            </div>
            <h2 className="m-0 text-2xl font-extrabold">{BOT_NAME}</h2>
            <p className="m-0 max-w-md text-sm leading-relaxed text-muted">
              {TAGLINE}
            </p>
            <div className="mt-2 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTED_CHIPS.map((label, i) => (
                <button
                  key={label}
                  onClick={() => handleChipClick(label)}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className="animate-chip-in border border-divider border-l-2 border-l-accent bg-surface px-3 py-2.5 text-left text-sm font-semibold text-text transition-colors hover:bg-surface-2"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={`flex flex-1 flex-col gap-3.5 px-4 py-5 sm:px-6 ${CONTENT_WIDTH}`}>
            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={`flex animate-fade-in-up flex-col ${
                    isUser ? "items-end" : "items-start"
                  }`}
                >
                  {!isUser && (
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-accent-text">
                      {BOT_NAME}
                    </span>
                  )}
                  <div
                    className={`max-w-[82%] whitespace-pre-wrap px-3 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? "border-r-2 border-divider bg-surface-2"
                        : "border-l-2 border-accent bg-surface"
                    }`}
                  >
                    {message.parts.map((part, i) =>
                      part.type === "text" ? (
                        <span key={i}>{part.text}</span>
                      ) : null,
                    )}
                  </div>
                </div>
              );
            })}

            {status === "submitted" && (
              <div className="flex animate-fade-in-up flex-col items-start">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-accent-text">
                  {BOT_NAME}
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
                  onClick={() => regenerate()}
                  className="flex-none border border-divider px-2.5 py-1.5 text-xs font-semibold text-accent-text transition-colors hover:bg-surface-2"
                >
                  Tentar de novo
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Barra de input — largura total, miolo alinhado com o resto do conteúdo */}
      <form
        onSubmit={handleSubmit}
        className="flex-none border-t-2 border-divider bg-surface px-4 py-3 sm:px-6"
      >
        <div className={`flex gap-2 ${CONTENT_WIDTH}`}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Escreve pra ${BOT_NAME}...`}
            disabled={isLoading}
            className="min-w-0 flex-1 border border-divider bg-input-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex-none bg-accent-strong px-4 py-2.5 text-sm font-extrabold text-on-accent transition-[transform,background-color] active:scale-95 active:bg-accent disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </form>
    </main>
  );
}
