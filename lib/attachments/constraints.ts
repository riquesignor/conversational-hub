/**
 * Regras de anexo (imagem, PDF, texto genérico) — módulo isomórfico
 * (sem `next/headers`, sem `firebase-admin`, sem nada server-only) porque é
 * importado tanto pelo cliente (components/chat/Composer.tsx, validação
 * otimista antes de nem tentar enviar) quanto pelo servidor
 * (app/api/chat/route.ts, a validação que de fato importa — nunca confiar só
 * na checagem do cliente, ver comentário de defesa em profundidade em
 * lib/auth/session.ts).
 *
 * Limites pensados pro teto de request inline do Gemini (~20MB já em
 * base64, que infla ~33% sobre o binário): manter cada tipo bem abaixo disso
 * e cap de anexos por mensagem evita estourar esse teto quando o usuário
 * manda vários arquivos de uma vez.
 */
export const MAX_ATTACHMENTS_PER_MESSAGE = 3;

export type AttachmentKind = "image" | "pdf" | "text";

interface KindConfig {
  /** `accept` do `<input type="file">` correspondente, ver Composer.tsx. */
  accept: string;
  maxBytes: number;
  mediaTypes: readonly string[];
}

export const ATTACHMENT_KINDS: Record<AttachmentKind, KindConfig> = {
  image: {
    accept: "image/*",
    maxBytes: 6 * 1024 * 1024,
    // Lista fechada em vez de aceitar "image/*" cru na validação: SVG entra
    // em image/* mas pode carregar script (XSS se algo um dia renderizar o
    // anexo como <img src="..."> a partir de um blob não sanitizado) — os
    // formatos abaixo cobrem o que o Gemini entende nativamente sem esse risco.
    mediaTypes: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "image/heif"],
  },
  pdf: {
    accept: "application/pdf",
    maxBytes: 10 * 1024 * 1024,
    mediaTypes: ["application/pdf"],
  },
  text: {
    accept: ".txt,.md,.csv,text/plain,text/markdown,text/csv",
    maxBytes: 2 * 1024 * 1024,
    // Navegadores são inconsistentes reportando o `type` de .md/.csv (às
    // vezes vem vazio, às vezes "application/vnd.ms-excel" pro Excel) — por
    // isso Composer.tsx tem um fallback por extensão antes de chegar aqui.
    mediaTypes: ["text/plain", "text/markdown", "text/csv"],
  },
};

export function classifyMediaType(mediaType: string): AttachmentKind | null {
  for (const kind of Object.keys(ATTACHMENT_KINDS) as AttachmentKind[]) {
    if (ATTACHMENT_KINDS[kind].mediaTypes.includes(mediaType)) return kind;
  }
  return null;
}

/** Deriva um mediaType a partir da extensão do arquivo — usado quando
 * `File.type` vem vazio (comum pra .md em vários navegadores/SOs). */
export function guessMediaTypeFromFilename(filename: string): string | null {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "txt":
      return "text/plain";
    case "md":
      return "text/markdown";
    case "csv":
      return "text/csv";
    case "pdf":
      return "application/pdf";
    default:
      return null;
  }
}

export type AttachmentValidation = { ok: true } | { ok: false; error: string };

export function validateAttachment(mediaType: string, bytes: number): AttachmentValidation {
  const kind = classifyMediaType(mediaType);
  if (!kind) {
    return { ok: false, error: `Tipo de arquivo não suportado: "${mediaType}".` };
  }
  const { maxBytes } = ATTACHMENT_KINDS[kind];
  if (bytes > maxBytes) {
    return {
      ok: false,
      error: `Arquivo excede o limite de ${Math.round(maxBytes / (1024 * 1024))}MB para este tipo.`,
    };
  }
  return { ok: true };
}
