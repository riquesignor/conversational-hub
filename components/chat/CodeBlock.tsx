"use client";

import { useState } from "react";
import { CopyIcon } from "./icons";

interface CodeBlockProps {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard indisponível (ex.: contexto não seguro/sem permissão) —
      // falha silenciosa, não é crítico pro chat continuar funcionando.
    }
  }

  return (
    <div className="max-w-full overflow-hidden rounded-[var(--radius-sm)] bg-code-bg text-code-text">
      <div className="flex items-center justify-between border-b border-code-border px-2.5 py-1.5">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-code-lang">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-code-copy-text"
        >
          <CopyIcon size={12} />
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto p-3 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
