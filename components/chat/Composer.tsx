"use client";

import { useState, type FormEvent } from "react";
import { PERSONAS } from "@/lib/personas";
import { PlusIcon, ImageIcon, PdfIcon, FileIcon, ChevronDownIcon, SendIcon } from "./icons";

interface ComposerProps {
  botName: string;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  personaId: string;
  onPersonaChange: (id: string) => void;
}

const ATTACH_OPTIONS = [
  { label: "Imagem", icon: ImageIcon },
  { label: "PDF", icon: PdfIcon },
  { label: "Arquivo", icon: FileIcon },
];

export function Composer({
  botName,
  input,
  onInputChange,
  onSubmit,
  isLoading,
  personaId,
  onPersonaChange,
}: ComposerProps) {
  const [attachOpen, setAttachOpen] = useState(false);
  const [personaOpen, setPersonaOpen] = useState(false);
  const persona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSubmit();
  }

  return (
    <div className="relative flex flex-none flex-col gap-2 border-t-2 border-divider bg-surface px-4 py-3 sm:px-6">
      {/* Menu de anexo: só a interface — nenhuma opção envia arquivo de
          verdade ainda (mesma fidelidade do mock original, cujo próprio
          protótipo também só fecha o menu ao clicar numa opção). */}
      {attachOpen && (
        <div className="absolute bottom-full left-4 z-10 mb-2 flex animate-pop-in flex-col border border-divider bg-bg shadow-[var(--shadow-dropdown)] sm:left-6">
          {ATTACH_OPTIONS.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => setAttachOpen(false)}
              className="flex min-w-[160px] items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-text hover:bg-surface-2"
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-3xl gap-2">
        <button
          type="button"
          onClick={() => {
            setAttachOpen((o) => !o);
            setPersonaOpen(false);
          }}
          title="Anexar"
          className="flex h-[38px] w-[38px] flex-none items-center justify-center border border-divider text-text"
        >
          <PlusIcon size={18} />
        </button>
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={`Escreve pra ${botName}...`}
          disabled={isLoading}
          className="min-w-0 flex-1 border border-divider bg-input-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="flex flex-none items-center gap-1.5 bg-accent-strong px-4 py-2.5 text-sm font-extrabold text-on-accent transition-[transform,background-color] active:scale-95 active:bg-accent disabled:opacity-40"
        >
          <SendIcon />
          Enviar
        </button>
      </form>

      <div className="relative mx-auto w-full max-w-3xl">
        <button
          onClick={() => {
            setPersonaOpen((o) => !o);
            setAttachOpen(false);
          }}
          className="flex items-center gap-1.5 border border-divider px-2.5 py-1.5 text-xs font-semibold text-muted"
        >
          <span className="h-1.5 w-1.5 flex-none bg-accent" />
          {persona.label}
          <ChevronDownIcon />
        </button>

        {personaOpen && (
          <div className="absolute bottom-full left-0 z-10 mb-2 flex w-72 animate-pop-in flex-col border border-divider bg-bg shadow-[var(--shadow-dropdown)]">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onPersonaChange(p.id);
                  setPersonaOpen(false);
                }}
                className={`flex flex-col items-start gap-0.5 px-3.5 py-2.5 text-left ${
                  p.id === personaId ? "bg-accent-tint" : "hover:bg-surface-2"
                }`}
              >
                <span className="text-[13px] font-semibold text-text">{p.label}</span>
                <span className="text-[11px] text-muted">{p.tagline}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
