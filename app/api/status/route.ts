/**
 * Endpoint só-leitura, informativo, pra tela de Configurações (ver
 * components/chat/SettingsPanel.tsx). Expõe só o NOME do provider ativo —
 * nunca a chave nem qualquer outro dado sensível — lido dos mesmos env vars
 * que lib/llm/provider.ts e lib/db/index.ts já usam pra decidir o backend.
 */
export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    llmProvider: process.env.LLM_PROVIDER || "google",
    dbProvider: process.env.DB_PROVIDER || "memory",
  });
}
