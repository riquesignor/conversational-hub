"use client";

import Image from "next/image";
import { PlusIcon, ThreadIcon, GearIcon, LogoutIcon } from "./icons";

export interface ThreadSummary {
  id: string;
  title: string;
  snippet: string;
}

interface SidebarProps {
  botName: string;
  threads: ThreadSummary[];
  activeThreadId: string;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  /** Nome de exibição ou e-mail do usuário logado (sempre existe — login é
   * obrigatório pra chegar até aqui, ver proxy.ts). */
  userLabel: string;
  userPhotoURL?: string | null;
  disabled: boolean;
  /** Há mais conversas além das já listadas (ver app/api/threads/route.ts —
   * paginado, pra sidebar não crescer sem limite num histórico grande). */
  hasMoreThreads: boolean;
  loadingMoreThreads: boolean;
  onLoadMoreThreads: () => void;
}

export function Sidebar({
  botName,
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onOpenSettings,
  onLogout,
  userLabel,
  userPhotoURL,
  disabled,
  hasMoreThreads,
  loadingMoreThreads,
  onLoadMoreThreads,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-[264px] flex-none flex-col gap-2 overflow-hidden border-r-2 border-divider bg-surface px-3 py-4">
      <div className="flex items-center gap-2.5 px-1 pb-3">
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent-strong text-sm font-extrabold text-on-accent">
          {botName.charAt(0).toUpperCase()}
        </div>
        <span className="text-base font-extrabold">{botName}</span>
      </div>

      <button
        onClick={onNewThread}
        disabled={disabled}
        className="flex items-center gap-2 justify-start rounded-md bg-accent px-3 py-2.5 text-left text-[13px] font-extrabold text-bg disabled:opacity-50"
      >
        <PlusIcon />
        Nova conversa
      </button>

      <span className="px-1 pb-0.5 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted">
        Conversas
      </span>
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {threads.map((t) => {
          const active = t.id === activeThreadId;
          return (
            <button
              key={t.id}
              onClick={() => onSelectThread(t.id)}
              disabled={disabled}
              className={`flex items-start gap-2 rounded-md border-l-2 px-2 py-2 text-left disabled:opacity-50 ${
                active ? "border-accent bg-accent-tint" : "border-transparent hover:bg-surface-2"
              }`}
            >
              <ThreadIcon className="mt-0.5 flex-none text-muted" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[12.5px] font-semibold">{t.title}</span>
                <span className="truncate text-[11px] text-muted">
                  {t.snippet || "Sem mensagens ainda"}
                </span>
              </span>
            </button>
          );
        })}
        {hasMoreThreads && (
          <button
            onClick={onLoadMoreThreads}
            disabled={disabled || loadingMoreThreads}
            className="mt-1 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold text-accent-text disabled:opacity-50"
          >
            {loadingMoreThreads ? "Carregando…" : "Carregar mais conversas"}
          </button>
        )}
      </div>

      <button
        onClick={onOpenSettings}
        className="flex items-center gap-2 justify-start rounded-md border-t-2 border-divider px-2 pb-0 pt-3 text-left text-[13px] font-semibold text-text"
      >
        <GearIcon />
        Configurações
      </button>

      <div className="flex items-center gap-2 border-t-2 border-divider px-1 pt-3">
        {userPhotoURL ? (
          // Único provedor com foto hoje é o login por Google (ver
          // lib/auth/client-actions.ts) — a foto sempre vem de
          // *.googleusercontent.com, daí o remotePattern único em
          // next.config.ts. next/image aqui dá otimização automática
          // (redimensiona pro tamanho real exibido, serve WebP/AVIF quando o
          // navegador suporta, lazy loading) em vez de baixar o asset no
          // tamanho original que a Google serve.
          <Image
            src={userPhotoURL}
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 flex-none rounded-full border border-divider object-cover"
          />
        ) : (
          <div className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-muted">
            {userLabel.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text">{userLabel}</span>
        <button onClick={onLogout} title="Sair" className="flex-none text-muted hover:text-accent-text">
          <LogoutIcon />
        </button>
      </div>
    </aside>
  );
}
