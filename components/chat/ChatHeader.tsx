import { PlusIcon } from "./icons";

interface ChatHeaderProps {
  botName: string;
  isLoading: boolean;
  onNewThread: () => void;
  disabled: boolean;
}

export function ChatHeader({ botName, isLoading, onNewThread, disabled }: ChatHeaderProps) {
  return (
    <header className="flex flex-none items-center gap-2.5 border-b border-divider bg-bg-2 px-4 py-3.5 sm:px-6">
      <div className="relative flex-none">
        <div className="h-[26px] w-[26px] rounded-[7px] bg-accent" />
        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 animate-presence-pulse rounded-full border-2 border-bg-2 bg-accent" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="font-heading text-[15px]">{botName}</span>
        <span className="text-[11px] text-muted">{isLoading ? "digitando…" : "online agora"}</span>
      </div>
      <button
        onClick={onNewThread}
        disabled={disabled}
        title="Nova conversa"
        className="ml-auto flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-divider px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-text disabled:opacity-50"
      >
        <PlusIcon size={13} />
        Nova conversa
      </button>
    </header>
  );
}
