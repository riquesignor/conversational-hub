interface ChatHeaderProps {
  botName: string;
  isLoading: boolean;
}

export function ChatHeader({ botName, isLoading }: ChatHeaderProps) {
  return (
    <header className="flex flex-none items-center gap-3 border-b-2 border-divider bg-surface px-4 py-3 sm:px-6">
      <div className="relative flex-none">
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-accent-strong text-[15px] font-extrabold text-on-accent">
          {botName.charAt(0).toUpperCase()}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 animate-presence-pulse rounded-full border-2 border-surface bg-accent" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-extrabold">{botName}</span>
        <span className="text-xs text-muted">{isLoading ? "digitando…" : "online agora"}</span>
      </div>
    </header>
  );
}
