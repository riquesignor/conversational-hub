/**
 * Truncamento com reticência, usado tanto no servidor (app/api/chat/route.ts,
 * pra gravar o título/prévia da thread no Firestore) quanto no cliente
 * (app/page.tsx, pro título otimista na sidebar antes do round-trip da API)
 * — extraído aqui pra não duplicar a mesma função dos dois lados.
 */
export function truncate(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
