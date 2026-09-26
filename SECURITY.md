# Política de Segurança

Este é um projeto de portfólio pessoal, código aberto apenas para leitura
(ver `LICENSE` ausente = todos os direitos reservados). Ainda assim, como
qualquer aplicação com autenticação e dados de usuário reais, falhas de
segurança são levadas a sério.

## Reportando uma vulnerabilidade

Se você encontrar uma vulnerabilidade de segurança neste projeto (bypass de
autenticação, vazamento de dados entre usuários, exposição de segredo,
injeção, etc.), **não abra uma issue pública**. Reporte de forma privada:

- E-mail: rique.signor@gmail.com
- Inclua: passos para reproduzir, impacto estimado, e (se possível) uma
  sugestão de correção.

Tentarei responder em até 7 dias e corrigir problemas críticos o mais rápido
possível. Não há programa de bug bounty — este é um projeto pessoal, não uma
empresa — mas todo report responsável é bem-vindo e será creditado (se
desejado) após a correção.

## Escopo e arquitetura de segurança

Um resumo do desenho de segurança atual, para contextualizar reports:

- **Autenticação real**: toda rota que lê/escreve dado de usuário valida a
  sessão no servidor via `getSessionUser()` (`lib/auth/session.ts`), que
  chama `adminAuth().verifySessionCookie(cookie, true)` — o `true` força
  checagem de revogação. Nenhuma rota confia em `uid`/`personaId` vindos do
  corpo da requisição para decidir de quem é o dado.
- **`proxy.ts`** é só uma checagem de UX (presença de cookie, sem validar);
  a fronteira de segurança real é o server-side check acima.
- **Isolamento por usuário**: `firestore.rules` nega tudo por padrão e só
  libera `/users/{uid}/...` para `request.auth.uid == uid`, sem regra
  catch-all. O Admin SDK ignora essas regras (por design), então elas são
  defesa em profundidade, não a única camada.
- **Anexos**: bucket privado no Supabase Storage; todo acesso passa pelo
  proxy autenticado em `app/api/attachments/.../route.ts`, nunca direto do
  cliente. Chave `service_role` é server-only.
- **Rate limiting**: limitador por IP em memória (`lib/rate-limit.ts`),
  10 req/60s — adequado para a escala atual; tem limitação conhecida
  (não é global entre instâncias serverless) documentada no próprio arquivo.
- **Segredos**: nenhuma chave de API, credencial ou `.env*` é commitada —
  `.gitignore` exclui `.env*` (exceto `.env.example`) e `*.pem`. O histórico
  completo do git foi auditado e não contém segredos reais em nenhum commit.
- **CI de proteção**: um workflow de secret-scanning (`gitleaks`) roda em
  todo push/PR para pegar qualquer segredo commitado por engano no futuro
  (ver `.github/workflows/gitleaks.yml`).
