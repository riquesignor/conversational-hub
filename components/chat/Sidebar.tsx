"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { PlusIcon, GearIcon, LogoutIcon, KebabIcon, PinIcon, EditIcon, TrashIcon } from "./icons";

export interface ThreadSummary {
  id: string;
  title: string;
  snippet: string;
  pinned: boolean;
}

interface SidebarProps {
  botName: string;
  threads: ThreadSummary[];
  activeThreadId: string;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onRenameThread: (id: string, title: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onDeleteThread: (id: string) => void;
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

/** Estado do menu "⋮" — no máximo um aberto por vez (guardar só o id da
 * thread, não um Set, já basta: abrir um novo fecha o anterior). `confirm`
 * distingue as duas telas do MESMO menu (opções vs. "tem certeza?"), pra
 * excluir sempre exigir um segundo clique em vez de agir no primeiro. */
interface MenuState {
  threadId: string;
  confirmDelete: boolean;
}

export function Sidebar({
  botName,
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onOpenSettings,
  onLogout,
  onRenameThread,
  onTogglePin,
  onDeleteThread,
  userLabel,
  userPhotoURL,
  disabled,
  hasMoreThreads,
  loadingMoreThreads,
  onLoadMoreThreads,
}: SidebarProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  function openMenu(threadId: string) {
    setMenu((prev) => (prev?.threadId === threadId ? null : { threadId, confirmDelete: false }));
  }

  function startRename(t: ThreadSummary) {
    setMenu(null);
    setRenamingId(t.id);
    setRenameValue(t.title);
    // Foca depois do próprio input existir no DOM (troca de <button> pra
    // <input> acontece neste mesmo render) — sem o timeout, o input ainda
    // não existe no instante deste clique.
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  }

  function commitRename(id: string) {
    const trimmed = renameValue.trim();
    setRenamingId(null);
    if (trimmed) onRenameThread(id, trimmed);
  }

  function cancelRename() {
    setRenamingId(null);
  }

  const pinned = threads.filter((t) => t.pinned);
  const recent = threads.filter((t) => !t.pinned);

  function renderThreadRow(t: ThreadSummary) {
    const active = t.id === activeThreadId;
    const isRenaming = renamingId === t.id;
    const menuOpen = menu?.threadId === t.id;

    if (isRenaming) {
      return (
        <input
          key={t.id}
          ref={renameInputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={() => commitRename(t.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitRename(t.id);
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancelRename();
            }
          }}
          className="w-full rounded-md border border-accent bg-surface-2 px-2.5 py-2 text-[12.5px] font-medium text-text outline-none"
        />
      );
    }

    return (
      <div key={t.id} className="group relative flex items-center rounded-md">
        <button
          onClick={() => onSelectThread(t.id)}
          disabled={disabled}
          className={`min-w-0 flex-1 truncate rounded-md px-2.5 py-2 text-left text-[12.5px] font-medium disabled:opacity-50 ${
            active ? "bg-surface text-text" : "text-muted hover:bg-surface"
          }`}
        >
          {t.title}
        </button>
        <button
          onClick={() => openMenu(t.id)}
          title="Mais opções"
          className={`absolute right-1 flex h-6 w-6 flex-none items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text ${
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <KebabIcon />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-10 mt-1 w-48 animate-pop-in overflow-hidden rounded-[var(--radius-md)] border border-divider bg-surface-2 shadow-[var(--shadow-dropdown)]">
            {menu.confirmDelete ? (
              <div className="flex flex-col gap-2 p-3">
                <p className="m-0 text-[12px] text-text">Excluir esta conversa?</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setMenu(null)}
                    className="flex-1 rounded-md border border-divider px-2 py-1.5 text-[12px] font-semibold text-text hover:bg-surface"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      setMenu(null);
                      onDeleteThread(t.id);
                    }}
                    className="flex-1 rounded-md bg-accent px-2 py-1.5 text-[12px] font-bold text-on-accent"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => startRename(t)}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-text hover:bg-surface"
                >
                  <EditIcon size={13} />
                  Renomear
                </button>
                <button
                  onClick={() => {
                    setMenu(null);
                    onTogglePin(t.id, !t.pinned);
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-text hover:bg-surface"
                >
                  <PinIcon size={13} filled={t.pinned} />
                  {t.pinned ? "Desafixar" : "Fixar"}
                </button>
                <button
                  onClick={() => setMenu({ threadId: t.id, confirmDelete: true })}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-accent-text hover:bg-surface"
                >
                  <TrashIcon size={13} />
                  Excluir
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="flex h-full w-[248px] flex-none flex-col gap-3.5 overflow-hidden border-r border-divider bg-bg-2 px-4 py-5">
      <div className="flex items-center gap-2">
        <div className="h-[22px] w-[22px] flex-none rounded-md bg-accent" />
        <span className="font-heading text-[19px]">{botName}</span>
      </div>

      <button
        onClick={onNewThread}
        disabled={disabled}
        className="flex items-center gap-2 justify-start rounded-[var(--radius-sm)] border border-divider px-3 py-2.5 text-left text-[13px] font-semibold text-text disabled:opacity-50"
      >
        <PlusIcon size={14} />
        Novo
      </button>

      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto">
        {pinned.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="px-2.5 pb-0.5 text-[11px] text-muted">Fixados</span>
            {pinned.map(renderThreadRow)}
          </div>
        )}

        <div className="flex flex-1 flex-col gap-0.5">
          <span className="px-2.5 pb-0.5 text-[11px] text-muted">Recentes</span>
          {recent.map(renderThreadRow)}
          {hasMoreThreads && (
            <button
              onClick={onLoadMoreThreads}
              disabled={disabled || loadingMoreThreads}
              className="mt-1 rounded-md px-2.5 py-1.5 text-left text-[11px] font-semibold text-accent-text disabled:opacity-50"
            >
              {loadingMoreThreads ? "Carregando…" : "Carregar mais conversas"}
            </button>
          )}
        </div>
      </div>

      <button
        onClick={onOpenSettings}
        className="flex items-center gap-2 justify-start rounded-md px-1 text-left text-[13px] font-semibold text-muted hover:text-text"
      >
        <GearIcon size={15} />
        Configurações
      </button>

      <div className="flex items-center gap-2 border-t border-divider px-0.5 pt-3.5">
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
            width={22}
            height={22}
            className="h-[22px] w-[22px] flex-none rounded-full border border-divider object-cover"
          />
        ) : (
          <div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-muted">
            {userLabel.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-text">{userLabel}</span>
        <button onClick={onLogout} title="Sair" className="flex-none text-muted hover:text-accent-text">
          <LogoutIcon />
        </button>
      </div>
    </aside>
  );
}
