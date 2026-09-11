"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_PERSONA_ID, PERSONAS } from "@/lib/personas";
import { truncate } from "@/lib/format";
import { useAuth } from "@/lib/auth/use-auth";
import { logout } from "@/lib/auth/client-actions";
// Só os TIPOS — importar de lib/db/types.ts (não de lib/db, que reexporta
// FirebaseConversationStore) garante que nada server-only (firebase-admin)
// arrisca entrar no bundle do cliente. `import type` já é apagado no
// compile de qualquer forma, isto é só reforço.
import type { ThreadMeta, StoredMessage } from "@/lib/db/types";
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

function threadMetaToSummary(meta: ThreadMeta): ThreadSummary {
  return { id: meta.id, title: meta.title, snippet: meta.lastMessagePreview ?? "" };
}

function storedToUIMessages(stored: StoredMessage[]): UIMessage[] {
  return stored.map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: "text", text: m.text }],
  }));
}

export default function ChatPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // useId() é estável entre a renderização no servidor e a hidratação no
  // cliente (ao contrário de crypto.randomUUID(), que geraria um valor
  // diferente em cada lado e um mismatch de hidratação) — usado só como
  // ponto de partida pra usuário novo, sem thread nenhuma salva ainda (ver
  // efeito de carregamento abaixo, que troca isto pela lista real assim
  // que /api/threads responde). Toda thread criada depois de montado (novo
  // clique em "Nova conversa") usa crypto.randomUUID(), sem risco, porque
  // aí já é 100% client-side.
  const initialThreadId = useId();
  const [activeThreadId, setActiveThreadId] = useState(initialThreadId);
  const [threads, setThreads] = useState<ThreadSummary[]>([
    { id: initialThreadId, title: "Nova conversa", snippet: "" },
  ]);
  const [threadsLoaded, setThreadsLoaded] = useState(false);
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null);

  // Cache de mensagens por thread — troca de conversa na sidebar troca o
  // `id` do useChat, que descarta e recria o Chat interno da AI SDK (ver
  // comentário abaixo) já inicializado com o que estiver aqui.
  const threadMessagesRef = useRef<Record<string, UIMessage[]>>({});

  const [input, setInput] = useState("");
  const [personaId, setPersonaId] = useState(DEFAULT_PERSONA_ID);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const persona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0];

  // Defesa em profundidade: middleware.ts já redireciona quem navega pra
  // "/" sem cookie de sessão, mas isto cobre quem já está com a aba aberta
  // no momento em que a sessão expira/é revogada (o SDK client detecta e
  // dispara onAuthStateChanged com user=null sem precisar de reload).
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  // Carrega as conversas salvas do Firestore assim que o usuário é
  // conhecido — sem isto, a sidebar reiniciava vazia a cada reload mesmo
  // com tudo persistido no backend (ver README, "Conversas (threads)").
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/threads");
        if (!res.ok) return;
        const data: { threads: ThreadMeta[] } = await res.json();
        if (cancelled || data.threads.length === 0) return;

        setThreads(data.threads.map(threadMetaToSummary));
        const mostRecent = data.threads[0]!;
        setLoadingThreadId(mostRecent.id);
        const msgRes = await fetch(`/api/threads/${mostRecent.id}/messages`);
        if (!cancelled && msgRes.ok) {
          const msgData: { messages: StoredMessage[] } = await msgRes.json();
          threadMessagesRef.current[mostRecent.id] = storedToUIMessages(msgData.messages);
        }
        if (!cancelled) {
          setActiveThreadId(mostRecent.id);
          setLoadingThreadId(null);
        }
      } catch (err) {
        console.error("[page] falha ao carregar conversas salvas:", err);
      } finally {
        if (!cancelled) setThreadsLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // A AI SDK recria o Chat interno sempre que `id` muda (mesmo mecanismo já
  // usado pro `body` refletir sempre o personaId mais recente — ver
  // README, seção Personas): trocar de thread na sidebar troca esse `id`,
  // o hook descarta o Chat anterior e monta um novo já inicializado com
  // `messages` (o cache local dessa thread — populado ao carregar do
  // servidor ou ao trocar de conversa, ver handleSelectThread). O `id`
  // também viaja automaticamente no corpo de cada requisição — é o que
  // app/api/chat/route.ts lê pra saber em qual conversa persistir cada
  // mensagem (sempre sob o uid da sessão, nunca um valor solto do cliente).
  const { messages, sendMessage, status, error, regenerate, setMessages } = useChat({
    id: activeThreadId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { personaId },
    }),
  });

  // Semeia o Chat recém-(re)criado pela AI SDK (toda vez que `activeThreadId`
  // muda — ver comentário acima) com o cache local da thread, via
  // setMessages() em vez de ler threadMessagesRef.current direto no corpo do
  // render: ler ref durante o render é proibido pela regra react-hooks/refs
  // (o valor pode ficar dessincronizado sob concurrent rendering). Em
  // useLayoutEffect, não useEffect, pra rodar ANTES do navegador pintar —
  // sem isso haveria um flash visível de "conversa vazia" a cada troca de
  // thread, entre o Chat novo nascer vazio e este efeito repopular.
  //
  // setMessages é estável (identidade fixa por chat, ver @ai-sdk/react); só
  // queremos rodar isto quando activeThreadId muda, não a cada render.
  useLayoutEffect(() => {
    setMessages(threadMessagesRef.current[activeThreadId] ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  const isLoading = status === "submitted" || status === "streaming";
  const isEmpty = messages.length === 0;

  // Espelha as mensagens da thread ativa no cache a cada mudança (inclusive
  // durante o streaming, token a token) — só a escrita no ref, que efeito
  // pode fazer sem problema (ao contrário de LER ref durante o render, como
  // useLayoutEffect acima evita).
  useEffect(() => {
    threadMessagesRef.current[activeThreadId] = messages;
  }, [messages, activeThreadId]);

  // Título/preview da conversa ATIVA na sidebar, derivados ao vivo do
  // conteúdo real das mensagens (inclusive durante streaming) — puro cálculo
  // de render, não setState dentro de efeito (era assim antes; violava
  // react-hooks/set-state-in-effect sem necessidade, já que isto é uma
  // derivação, não um efeito colateral de verdade).
  const liveActiveSummary = useMemo(() => {
    const { first, last } = firstAndLastText(messages);
    if (!first) return null;
    return { title: truncate(first, 40), snippet: truncate(last ?? first, 48) };
  }, [messages]);

  const displayThreads = useMemo(
    () =>
      liveActiveSummary
        ? threads.map((t) => (t.id === activeThreadId ? { ...t, ...liveActiveSummary } : t))
        : threads,
    [threads, activeThreadId, liveActiveSummary],
  );

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

  const handleSelectThread = useCallback(
    async (id: string) => {
      if (id === activeThreadId || isLoading || loadingThreadId) return;
      setSettingsOpen(false);

      // Já em cache (thread mais recente carregada no mount, ou já visitada
      // nesta sessão) — troca imediata, sem round-trip.
      if (threadMessagesRef.current[id] !== undefined) {
        setActiveThreadId(id);
        return;
      }

      setLoadingThreadId(id);
      try {
        const res = await fetch(`/api/threads/${id}/messages`);
        if (res.ok) {
          const data: { messages: StoredMessage[] } = await res.json();
          threadMessagesRef.current[id] = storedToUIMessages(data.messages);
        }
      } catch (err) {
        console.error("[page] falha ao carregar mensagens da conversa:", err);
      } finally {
        setActiveThreadId(id);
        setLoadingThreadId(null);
      }
    },
    [activeThreadId, isLoading, loadingThreadId],
  );

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  // Evita piscar a tela de chat vazia antes do redirect pro /login (efeito
  // acima) resolver, e antes do primeiro carregamento de /api/threads.
  if (authLoading || !user) {
    return <main className="flex h-dvh items-center justify-center bg-bg text-sm text-muted">Carregando…</main>;
  }

  return (
    <main className="flex h-dvh bg-bg text-text">
      <Sidebar
        botName={BOT_NAME}
        threads={displayThreads}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onNewThread={handleNewThread}
        onOpenSettings={() => setSettingsOpen(true)}
        onLogout={handleLogout}
        userLabel={user.displayName || user.email || "Minha conta"}
        userPhotoURL={user.photoURL}
        disabled={isLoading || !!loadingThreadId}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {settingsOpen ? (
          <SettingsPanel botName={BOT_NAME} persona={persona} onBack={() => setSettingsOpen(false)} />
        ) : (
          <>
            <ChatHeader botName={BOT_NAME} isLoading={isLoading} />
            <div className="flex flex-1 flex-col overflow-y-auto">
              {!threadsLoaded ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted">
                  Carregando conversas…
                </div>
              ) : isEmpty ? (
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
