"use client";

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
   * obrigatório pra chegar até aqui, ver middleware.ts). */
  userLabel: string;
  userPhotoURL?: string | null;
  disabled: boolean;
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
}: SidebarProps) {
  return (
    <aside className="flex h-full w-[264px] flex-none flex-col gap-2 overflow-hidden border-r-2 border-divider bg-surface px-3 py-4">
      <div className="flex items-center gap-2.5 px-1 pb-3">
        <div className="flex h-8 w-8 flex-none items-center justify-center bg-accent-strong text-sm font-extrabold text-on-accent">
          {botName.charAt(0).toUpperCase()}
        </div>
        <span className="text-base font-extrabold">{botName}</span>
      </div>

      <button
        onClick={onNewThread}
        disabled={disabled}
        className="flex items-center gap-2 justify-start bg-accent px-3 py-2.5 text-left text-[13px] font-extrabold text-bg disabled:opacity-50"
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
              className={`flex items-start gap-2 border-l-2 px-2 py-2 text-left disabled:opacity-50 ${
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
      </div>

      <button
        onClick={onOpenSettings}
        className="flex items-center gap-2 justify-start border-t-2 border-divider px-2 pb-0 pt-3 text-left text-[13px] font-semibold text-text"
      >
        <GearIcon />
        Configurações
      </button>

      <div className="flex items-center gap-2 border-t-2 border-divider px-1 pt-3">
        {userPhotoURL ? (
          // avatar de URL externa (Google); next/image exigiria configurar
          // remotePatterns pra um domínio que varia por provedor de login.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={userPhotoURL} alt="" className="h-6 w-6 flex-none border border-divider object-cover" />
        ) : (
          <div className="flex h-6 w-6 flex-none items-center justify-center bg-surface-2 text-[11px] font-bold text-muted">
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
