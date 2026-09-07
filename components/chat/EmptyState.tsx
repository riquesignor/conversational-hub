interface EmptyStateProps {
  botName: string;
  tagline: string;
  chips: string[];
  onChipClick: (label: string) => void;
}

export function EmptyState({ botName, tagline, chips, onChipClick }: EmptyStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-3 px-6 py-10 sm:px-8">
      <div className="mb-1 flex h-[56px] w-[56px] items-center justify-center bg-accent-strong text-2xl font-extrabold text-on-accent">
        {botName.charAt(0).toUpperCase()}
      </div>
      <h2 className="m-0 text-2xl font-extrabold">{botName}</h2>
      <p className="m-0 max-w-md text-sm leading-relaxed text-muted">{tagline}</p>
      <div className="mt-2 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {chips.map((label, i) => (
          <button
            key={label}
            onClick={() => onChipClick(label)}
            style={{ animationDelay: `${i * 60}ms` }}
            className="animate-chip-in border border-divider border-l-2 border-l-accent bg-surface px-3 py-2.5 text-left text-sm font-semibold text-text transition-colors hover:bg-surface-2"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
