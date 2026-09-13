import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente admin do Supabase — usado SÓ pra Storage dos anexos de
 * imagem/PDF/texto (ver lib/storage/attachments.ts e README, seção
 * "Anexos"). Login e persistência de conversas continuam 100% Firebase
 * (Auth + Firestore, ver lib/firebase/admin.ts) — não é uma migração, é só
 * o backend de arquivo binário.
 *
 * Por quê Supabase Storage em vez de Firebase Storage: desde set/2024 o
 * Firebase Storage exige o projeto estar no plano Blaze (cartão vinculado),
 * mesmo pra ficar dentro da cota gratuita — ver
 * https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024.
 * Supabase Storage no plano Free (1GB storage / 5GB egress por mês) não
 * exige cartão pra criar o projeto.
 *
 * Server-only — nunca importe isto de um Client Component nem exponha
 * SUPABASE_SERVICE_ROLE_KEY pro navegador: essa chave ignora toda RLS do
 * projeto (é o equivalente Supabase de uma service account do Firebase).
 * Lida dentro da função, não no topo do módulo, pelo mesmo motivo de
 * lib/firebase/admin.ts: só falha quando alguém de fato tenta subir/baixar
 * um anexo, nunca só por o módulo ser importado.
 */
let cachedClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase não configurado — defina SUPABASE_URL e " +
        "SUPABASE_SERVICE_ROLE_KEY (ver .env.example) pra habilitar anexos.",
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}

/** Nome do bucket — configurável porque, ao contrário do Firebase, o bucket
 * do Supabase não é criado automaticamente: precisa ser criado (privado) no
 * dashboard antes do primeiro upload (ver README). */
export function attachmentsBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || "attachments";
}

export function adminSupabase(): SupabaseClient {
  return getAdminClient();
}
