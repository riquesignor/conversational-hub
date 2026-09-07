"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useEffect, useId, useRef, useState } from "react";
import { DEFAULT_PERSONA_ID, PERSONAS } from "@/lib/personas";
import { Sidebar, type ThreadSummary } from "@/components/chat/Sidebar";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { EmptyState } from "@/components/chat/EmptyState";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { SettingsPanel } from "@/components/chat/SettingsPanel";

const BOT_NAME = "Zezinho";

const SUGGESTED_CHIPS = [
  "Pesquisa algo rápido pra mim",
  "Me ajuda a entender esse erro",
  "Explica um conceito complicado",
  "Só bora trocar uma ideia",
];

function truncate(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function firstAndLastText(messages: UIMessage[]): { first?: string; last?: string } {
  let first: string | undefined;
  let last: string | undefined;
  for (const m of messages) {
    const text = m.parts.find(
      (p): p is Extract<typeof p, { type: "text" }> => p.type === "text",
    )?.text;
    if (!text) continue;
    if (m.role === "user" && first === undefined) first = text;
    last = text;
  }
  return { first, last };
}

export default function ChatPage() {
  // useId() é estável entre a renderização no servidor e a hidratação no
  // cliente (ao contrário de crypto.randomUUID(), que geraria um valor
  // diferente em cada lado e um mismatch de hidratação) — por isso é só a
  // PRIMEIRA thread que usa isso; toda thread nova criada depois (dentro de
  // handleNewThread, só chamado a partir de um clique) usa
  // crypto.randomUUID() sem problema, porque aí já é 100% client-side.
  const initialThreadId = useId();
  const [activeThreadId, setActiveThreadId] = useState(initialThreadId);
  const [threads, setThreads] = useState<ThreadSummary[]>([
    { id: initialThreadId, title: "Nova conversa", snippet: "" },
  ]);
  // Cache de mensagens por thread — sobrevive à troca de conversa na
  // sidebar, que troca o `id` do useChat e por isso descarta e recria o
  // Chat interno da AI SDK (ver comentário abaixo). Não sobrevive a um
  // reload da página (mesma limitação de sempre — ver README).
  const threadMessagesRef = useRef<Record<string, UIMessage[]>>({});

  const [input, setInput] = useState("");
  const [personaId, setPersonaId] = useState(DEFAULT_PERSONA_ID);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const persona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0];

  // A AI SDK recria o Chat interno sempre que `id` muda (mesmo mecanismo já
  // usado pro `body` refletir sempre o personaId mais recente — ver
  // README, seção Personas): trocar de thread na sidebar troca esse `id`,
  // o hook descarta o Chat anterior e monta um novo já inicializado com
  // `messages` (o cache local dessa thread, ou [] se for uma conversa
  // nova). O `id` também viaja automaticamente no corpo de cada requisição
  // — é o que app/api/chat/route.ts lê como `threadId` pra saber em qual
  // conversa persistir cada mensagem.
  const { messages, sendMessage, status, error, regenerate } = useChat({
    id: activeThreadId,
    messages: threadMessagesRef.current[activeThreadId] ?? [],
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { personaId },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";
  const isEmpty = messages.length === 0;

  // Espelha as mensagens da thread ativa no cache a cada mudança (inclusive
  // durante o streaming, token a token) e atualiza título/preview da
  // conversa na sidebar a partir do conteúdo real — nunca dado inventado,
  // ao contrário do mock original (que tinha 5 conversas fixas fake).
  useEffect(() => {
    threadMessagesRef.current[activeThreadId] = messages;
    const { first, last } = firstAndLastText(messages);
    if (first) {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === activeThreadId
            ? { ...t, title: truncate(first, 40), snippet: truncate(last ?? first, 48) }
            : t,
        ),
      );
    }
  }, [messages, activeThreadId]);

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput("");
  }

  function handleChipClick(label: string) {
    if (isLoading) return;
    sendMessage({ text: label });
  }

  function handleNewThread() {
    if (isLoading) return;
    const id = crypto.randomUUID();
    threadMessagesRef.current[id] = [];
    setThreads((prev) => [{ id, title: "Nova conversa", snippet: "" }, ...prev]);
    setActiveThreadId(id);
    setInput("");
    setSettingsOpen(false);
  }

  function handleSelectThread(id: string) {
    if (id === activeThreadId || isLoading) return;
    setActiveThreadId(id);
    setSettingsOpen(false);
  }

  return (
    <main className="flex h-dvh bg-bg text-text">
      <Sidebar
        botName={BOT_NAME}
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onNewThread={handleNewThread}
        onOpenSettings={() => setSettingsOpen(true)}
        disabled={isLoading}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {settingsOpen ? (
          <SettingsPanel botName={BOT_NAME} persona={persona} onBack={() => setSettingsOpen(false)} />
        ) : (
          <>
            <ChatHeader botName={BOT_NAME} isLoading={isLoading} />
            <div className="flex flex-1 flex-col overflow-y-auto">
              {isEmpty ? (
                <EmptyState
                  botName={BOT_NAME}
                  tagline={persona.tagline}
                  chips={SUGGESTED_CHIPS}
                  onChipClick={handleChipClick}
                />
              ) : (
                <MessageList
                  messages={messages}
                  botName={BOT_NAME}
                  isSubmitted={status === "submitted"}
                  isLoading={isLoading}
                  error={error}
                  onEdit={setInput}
                  onRedo={() => regenerate()}
                  onRetry={() => regenerate()}
                />
              )}
            </div>
            <Composer
              botName={BOT_NAME}
              input={input}
              onInputChange={setInput}
              onSubmit={handleSend}
              isLoading={isLoading}
              personaId={personaId}
              onPersonaChange={setPersonaId}
            />
          </>
        )}
      </div>
    </main>
  );
}
