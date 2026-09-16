interface EmptyStateProps {
  botName: string;
  tagline: string;
  chips: string[];
  onChipClick: (label: string) => void;
}

export function EmptyState({ botName, tagline, chips, onChipClick }: EmptyStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-3 px-6 py-10 sm:px-8">
      <div className="mb-1 flex items-center gap-3">
        <div className="h-8 w-8 flex-none rounded-[var(--radius-sm)] bg-accent" />
        <h2 className="font-heading m-0 text-[28px] font-normal">{botName}</h2>
      </div>
      <p className="font-heading m-0 max-w-md text-[17px] text-muted">{tagline}</p>
      <div className="mt-3 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {chips.map((label, i) => (
          <button
            key={label}
            onClick={() => onChipClick(label)}
            style={{ animationDelay: `${i * 60}ms` }}
            className="animate-chip-in rounded-[var(--radius-sm)] border border-divider bg-surface-2 px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-text transition-colors hover:bg-surface"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
