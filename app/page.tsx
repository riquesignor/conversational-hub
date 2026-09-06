"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "submitted" || status === "streaming";

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

  return (
    <main className="flex h-dvh flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Chatbot — [Seu Nome]
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Projeto de portfólio · Next.js + Vercel AI SDK + OpenAI
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {messages.length === 0 && (
          <p className="mt-12 text-center text-sm text-neutral-400">
            Envie uma mensagem para começar a conversa.
          </p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                message.role === "user"
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
              }`}
            >
              {message.parts.map((part, i) =>
                part.type === "text" ? <span key={i}>{part.text}</span> : null,
              )}
            </div>
          </div>
        ))}

        {status === "submitted" && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-2xl bg-neutral-200 px-4 py-2 text-sm text-neutral-400 dark:bg-neutral-800">
              digitando…
            </div>
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-red-500">
            Algo deu errado: {error.message}
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua mensagem..."
          disabled={isLoading}
          className="flex-1 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-400 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
        >
          Enviar
        </button>
      </form>
    </main>
  );
}
