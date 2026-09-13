"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { PERSONAS } from "@/lib/personas";
import {
  ATTACHMENT_KINDS,
  MAX_ATTACHMENTS_PER_MESSAGE,
  classifyMediaType,
  guessMediaTypeFromFilename,
  validateAttachment,
  type AttachmentKind,
} from "@/lib/attachments/constraints";
import { PlusIcon, ImageIcon, PdfIcon, FileIcon, ChevronDownIcon, SendIcon } from "./icons";

/** Anexo ainda não enviado, vivendo só no estado local do Composer — style
 * de `PendingMessage` comum em composers de chat: existe só até o submit,
 * quando vira um FileUIPart de verdade (ver PendingAttachment.toFilePart e
 * app/page.tsx). `url` já é a data URL base64 (lida no momento da seleção,
 * não no submit) — é o formato que `sendMessage({ files })` da AI SDK espera
 * pra um FileUIPart manual (ver ai-sdk.dev/docs/ai-sdk-ui/chatbot). */
export interface PendingAttachment {
  id: string;
  kind: AttachmentKind;
  filename: string;
  mediaType: string;
  size: number;
  url: string;
}

interface ComposerProps {
  botName: string;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (attachments: PendingAttachment[]) => void;
  isLoading: boolean;
  personaId: string;
  onPersonaChange: (id: string) => void;
}

const ATTACH_OPTIONS: Array<{ label: string; kind: AttachmentKind; icon: typeof ImageIcon }> = [
  { label: "Imagem", kind: "image", icon: ImageIcon },
  { label: "PDF", kind: "pdf", icon: PdfIcon },
  { label: "Arquivo", kind: "text", icon: FileIcon },
];

const KIND_ICON: Record<AttachmentKind, typeof ImageIcon> = {
  image: ImageIcon,
  pdf: PdfIcon,
  text: FileIcon,
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

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
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const persona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0];

  // Um <input type="file"> escondido por tipo (não um só reaproveitado) —
  // cada um já nasce com o `accept` certo pro seletor de arquivo do SO
  // filtrar de cara, em vez de aceitar qualquer coisa e só validar depois.
  const fileInputRefs = {
    image: useRef<HTMLInputElement>(null),
    pdf: useRef<HTMLInputElement>(null),
    text: useRef<HTMLInputElement>(null),
  };

  const hasText = input.trim().length > 0;
  const canSubmit = (hasText || attachments.length > 0) && !isLoading;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(attachments);
    setAttachments([]);
    setAttachError(null);
  }

  function openPicker(kind: AttachmentKind) {
    setAttachOpen(false);
    fileInputRefs[kind].current?.click();
  }

  async function handleFilesPicked(kind: AttachmentKind, e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Limpa o input já aqui (não só no fim da função) — sem isso, escolher o
    // MESMO arquivo duas vezes seguidas não dispara onChange na segunda vez
    // (o navegador só notifica quando o value muda).
    e.target.value = "";
    if (files.length === 0) return;

    if (attachments.length + files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      setAttachError(`Máximo de ${MAX_ATTACHMENTS_PER_MESSAGE} anexos por mensagem.`);
      return;
    }

    const next: PendingAttachment[] = [];
    for (const file of files) {
      // file.type vem vazio ou errado pra .md/.csv em vários navegadores —
      // cai pro fallback por extensão antes de rejeitar (ver constraints.ts).
      const mediaType = file.type || guessMediaTypeFromFilename(file.name) || "";
      const check = validateAttachment(mediaType, file.size);
      if (!check.ok) {
        setAttachError(`"${file.name}": ${check.error}`);
        return;
      }

      const detectedKind = classifyMediaType(mediaType) ?? kind;
      try {
        const url = await readAsDataUrl(file);
        next.push({
          id: crypto.randomUUID(),
          kind: detectedKind,
          filename: file.name,
          mediaType,
          size: file.size,
          url,
        });
      } catch {
        setAttachError(`Não consegui ler "${file.name}".`);
        return;
      }
    }

    setAttachError(null);
    setAttachments((prev) => [...prev, ...next]);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="relative flex flex-none flex-col gap-2 border-t-2 border-divider bg-surface px-4 py-3 sm:px-6">
      {ATTACH_OPTIONS.map(({ kind }) => (
        <input
          key={kind}
          ref={fileInputRefs[kind]}
          type="file"
          multiple
          accept={ATTACHMENT_KINDS[kind].accept}
          onChange={(e) => void handleFilesPicked(kind, e)}
          className="hidden"
        />
      ))}

      {attachOpen && (
        <div className="absolute bottom-full left-4 z-10 mb-2 flex animate-pop-in flex-col overflow-hidden rounded-lg border border-divider bg-bg shadow-[var(--shadow-dropdown)] sm:left-6">
          {ATTACH_OPTIONS.map(({ label, kind, icon: Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => openPicker(kind)}
              className="flex min-w-[160px] items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-text hover:bg-surface-2"
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-1.5">
          {attachments.map((a) => {
            const Icon = KIND_ICON[a.kind];
            return (
              <span
                key={a.id}
                className="flex max-w-[220px] items-center gap-1.5 rounded-md border border-divider bg-bg py-1 pl-2 pr-1 text-xs text-text"
              >
                {a.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- preview transiente a partir de uma data URL local, não um asset otimizável pelo next/image.
                  <img src={a.url} alt="" className="h-4 w-4 flex-none rounded-sm object-cover" />
                ) : (
                  <Icon size={13} className="flex-none text-muted" />
                )}
                <span className="truncate">{a.filename}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  title="Remover anexo"
                  className="flex h-4 w-4 flex-none items-center justify-center text-muted hover:text-accent-text"
                >
                  <PlusIcon size={11} className="rotate-45" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {attachError && (
        <p className="mx-auto w-full max-w-3xl text-xs font-semibold text-accent-text">{attachError}</p>
      )}

      <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-3xl gap-2">
        <button
          type="button"
          onClick={() => {
            setAttachOpen((o) => !o);
            setPersonaOpen(false);
          }}
          title="Anexar"
          className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-md border border-divider text-text"
        >
          <PlusIcon size={18} />
        </button>
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={`Escreve pra ${botName}...`}
          disabled={isLoading}
          className="min-w-0 flex-1 rounded-md border border-divider bg-input-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex flex-none items-center gap-1.5 rounded-md bg-accent-strong px-4 py-2.5 text-sm font-extrabold text-on-accent transition-[transform,background-color] active:scale-95 active:bg-accent disabled:opacity-40"
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
          className="flex items-center gap-1.5 rounded-md border border-divider px-2.5 py-1.5 text-xs font-semibold text-muted"
        >
          <span className="h-1.5 w-1.5 flex-none rounded-full bg-accent" />
          {persona.label}
          <ChevronDownIcon />
        </button>

        {personaOpen && (
          <div className="absolute bottom-full left-0 z-10 mb-2 flex w-72 animate-pop-in flex-col overflow-hidden rounded-lg border border-divider bg-bg shadow-[var(--shadow-dropdown)]">
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
