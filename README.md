# Chatbot Portfolio

Chatbot com streaming de respostas, construído com Next.js 16 (App Router) e
[Vercel AI SDK](https://ai-sdk.dev). Interface em sidebar com múltiplas
conversas, inspirada em ChatGPT/Claude, com o design "Kado" (tema escuro
único, Newsreader nos títulos + Manrope no resto, acento dourado). Login
obrigatório (Google ou e-mail/senha, via Firebase Auth) e persistência real
por usuário no Firestore — cada conta só enxerga as próprias conversas.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4)
- **Vercel AI SDK** (`ai` + `@ai-sdk/react`) — streaming de tokens e o hook
  `useChat`
- **Google Gemini** (`gemini-3.5-flash` por padrão) via `@ai-sdk/google` —
  provider default porque o free tier não exige cartão de crédito
- **OpenAI** (`gpt-4o-mini`) via `@ai-sdk/openai` — implementado como
  alternativa, mas desde maio/2026 a OpenAI exige cartão cadastrado mesmo
  para o crédito de teste
- **Firebase Authentication** — login obrigatório, Google Sign-In e
  e-mail/senha; sessão via cookie httpOnly (não localStorage/token exposto
  a JS); ver seção "Autenticação e Firestore" abaixo
- **Firestore** — cada usuário autenticado é a raiz de todo dado dele
  (conversas, e reservado pra imagens/PDFs gerados no futuro); ver mesma
  seção
- **Tool calling** — o bot tem habilidades reais (data/hora, calculadora,
  busca de Pokémon na PokéAPI, consulta de CEP, listagem das próprias
  habilidades) via o parâmetro `tools` da AI SDK; ver seção "Habilidades
  (tools)" abaixo
- **Personas** — um seletor na barra de mensagem troca o tom das respostas
  (descontraído, formal, didático) sem trocar de modelo nem apagar o
  histórico; ver seção "Personas" abaixo
- **Conversas (threads)** — sidebar com múltiplas conversas por usuário,
  cada uma persistida no Firestore e recarregada ao abrir a página; ver
  seção "Interface" abaixo
- Rate limiting simples em memória, por IP, protegendo a chave de API contra
  abuso (ver `lib/rate-limit.ts`)

## Arquitetura

```
middleware.ts                # Gate de UX: redireciona pra /login sem cookie de sessão (ver "Autenticação e Firestore")
firestore.rules              # Regras de segurança do Firestore (defesa em profundidade — ver mesma seção)

app/
├── page.tsx                 # Orquestra o chat: auth, threads/persona, useChat, layout
├── layout.tsx                # Layout raiz — monta o AuthProvider (lib/auth/use-auth.tsx)
├── login/page.tsx            # Tela de login/cadastro (Google + e-mail/senha)
└── api/
    ├── chat/route.ts         # Route handler: exige sessão válida, chama o LLM, faz stream da resposta
    ├── status/route.ts       # GET só-leitura: provider de LLM ativo (pra tela de Configurações)
    ├── threads/route.ts      # GET: lista as conversas do usuário logado (pra sidebar)
    ├── threads/[threadId]/messages/route.ts  # GET: histórico de uma conversa
    └── auth/
        ├── session/route.ts  # POST: troca um ID token por um cookie de sessão httpOnly
        └── logout/route.ts   # POST: apaga o cookie de sessão

components/chat/
├── icons.tsx                # Ícones SVG do design "Kado" + alguns desenhados à mão (kebab/pin/lixeira/Logout/Google)
├── Sidebar.tsx               # Fixados/Recentes + renomear/fixar/excluir + "Novo" + Configurações + usuário/Sair
├── ChatHeader.tsx            # Cabeçalho do chat (avatar, nome, status online/digitando)
├── EmptyState.tsx            # Tela vazia (avatar grande, tagline da persona, chips sugeridos)
├── MessageList.tsx           # Lista de mensagens + indicador de digitação + banner de erro
├── MessageBubble.tsx         # Uma mensagem: texto/código/tool call + ações (copiar/editar/refazer)
├── CodeBlock.tsx             # Bloco de código com label de linguagem + botão copiar
├── Composer.tsx               # Input + menu de anexo (decorativo) + seletor de persona
└── SettingsPanel.tsx          # Tela de configurações (sobre o bot, personas, backend ativo)

lib/
├── llm/provider.ts         # Abstração de provider de LLM — troca de modelo em um único arquivo
├── personas.ts              # Personas do seletor de tom — id/label/tagline/tone de cada uma
├── parse-message-content.ts # Parser simples de blocos ```código``` dentro do texto de uma mensagem
├── format.ts                # truncate() — compartilhado entre servidor e cliente
├── rate-limit.ts            # Rate limiter em memória por IP
├── skills/                  # Habilidades (tools) do bot — registro central + uma tool por arquivo
│   ├── catalog.ts            # Metadados (id/título/descrição) de cada habilidade
│   ├── get-datetime.ts, calculate.ts, lookup-pokemon.ts, lookup-cep.ts, list-skills.ts
│   ├── render-tool-output.ts # Formata a saída de uma tool pra UI
│   └── index.ts               # getTools() — o que entra no `tools` do streamText
├── firebase/
│   ├── client.ts             # SDK client do Firebase (navegador) — auth, googleProvider
│   └── admin.ts               # SDK admin (server-only) — adminAuth(), adminDb()
├── auth/
│   ├── constants.ts           # Nome do cookie de sessão — sem imports, pro Edge (middleware.ts) poder usar
│   ├── session.ts              # getSessionUser() — verifica o cookie via Admin SDK (a autorização de verdade)
│   ├── use-auth.tsx            # AuthProvider/useAuth() — estado do usuário logado no cliente
│   ├── client-actions.ts       # establishSession()/logout() — pontes entre SDK client e o cookie de sessão
│   └── errors.ts               # Traduz códigos de erro do Firebase Auth pra português
└── db/                       # Persistência de conversas (e, reservado, imagens/PDFs) — Firestore
    ├── types.ts               # Interface ConversationStore + StoredMessage/ThreadMeta/StoredImage/StoredPdf
    ├── firebase-store.ts       # Implementação real (users/{uid}/... — ver "Autenticação e Firestore")
    └── index.ts                # getStore() — único backend agora, sem mais switch por env var
```

A escolha de provider de LLM continua centralizada em `lib/llm/provider.ts` e
controlada pela variável `LLM_PROVIDER` (`google` ou `openai`) — isso não
mudou nesta rodada. Adicionar outro provider (ex.: Groq) é instalar o pacote
`@ai-sdk/<provider>` e adicionar um `case` nesse arquivo.

## Autenticação e Firestore

Login passou a ser **obrigatório** pra usar o chat — decisão deliberada pra
manter o Firestore "arrumado": toda conversa nasce amarrada a um usuário
real, em vez de uma sessão anônima solta. Duas camadas, cada uma cobrindo o
que a outra não cobre:

- **`middleware.ts`** roda no Edge runtime e só checa se o cookie de sessão
  *existe*, pra redirecionar pra `/login` antes de piscar a tela de chat.
  Não verifica a assinatura do cookie — o Edge não roda o Admin SDK (precisa
  de Node crypto).
- **`lib/auth/session.ts`** (`getSessionUser()`) é a autorização de verdade,
  chamada em toda rota que toca dado de usuário (`/api/chat`,
  `/api/threads`, `/api/threads/[id]/messages`): verifica o cookie via
  `adminAuth().verifySessionCookie(...)` e só então libera acesso. **Nunca
  confie em um `uid` vindo do corpo da requisição** — o único lugar que
  decide "de quem é esse dado" é o cookie verificado aqui.

### Como o login funciona (Google e e-mail/senha)

1. `app/login/page.tsx` usa o SDK **client** do Firebase (`lib/firebase/client.ts`)
   pra autenticar: `signInWithPopup` (Google) ou
   `createUserWithEmailAndPassword`/`signInWithEmailAndPassword`.
2. Com o usuário autenticado no SDK client, `establishSession()`
   (`lib/auth/client-actions.ts`) pega o ID token dele e faz
   `POST /api/auth/session`.
3. Essa rota (Admin SDK) verifica o token, cria um **cookie de sessão
   httpOnly** (`createSessionCookie`, válido por 14 dias — o máximo
   permitido pelo SDK) e grava/atualiza `users/{uid}` no Firestore.
4. Da em diante, toda requisição pro app já leva esse cookie
   automaticamente (é `httpOnly` — nenhum script no navegador consegue
   ler/roubar via XSS, ao contrário de guardar o ID token em
   `localStorage`).
5. "Sair" (`lib/auth/client-actions.ts` → `logout()`) desfaz os dois lados:
   `signOut()` no SDK client + `POST /api/auth/logout` apagando o cookie.

### Schema do Firestore

Um documento raiz por usuário, tudo pendurado como subcoleção abaixo dele —
nada de coleção solta no topo misturando gente diferente (a "salada" que
motivou esta reorganização):

```
users/{uid}                                    { email, displayName, photoURL, createdAt, lastLoginAt }
  users/{uid}/threads/{threadId}                 ThreadMeta { title, personaId, lastMessagePreview, createdAt, updatedAt }
    users/{uid}/threads/{threadId}/messages/{id}   StoredMessage { role, text, createdAt }
  users/{uid}/images/{id}                        StoredImage — RESERVADO, ver nota abaixo
  users/{uid}/pdfs/{id}                          StoredPdf — RESERVADO, ver nota abaixo
```

`uid` é o identificador do Firebase Auth, não o e-mail cru — evita colisão
de maiúsculas/minúsculas e caracteres especiais no e-mail como id de
documento, e é o padrão idiomático do Firebase. O e-mail continua acessível
como campo (`users/{uid}.email`), então buscar/exibir por e-mail continua
trivial; só a chave física da árvore é o uid.

**Imagens e PDFs (`images`/`pdfs`) são só o tipo e a coleção reservados** —
`lib/db/types.ts`/`firebase-store.ts` já sabem gravar e listar nesse
formato (`saveImage`/`listImages`, `savePdf`/`listPdfs`), mas nada no
projeto gera imagem ou PDF ainda (o bot é só texto hoje). Fica pronto pro
dia em que isso virar prioridade — ver "Próximos passos".

`firestore.rules` (raiz do projeto) espelha esse desenho: cada `uid` só lê/
escreve a própria subárvore. Isso é defesa em profundidade, não a primeira
linha — hoje todo acesso passa pelo Admin SDK no servidor, que ignora
Security Rules por padrão; elas importam no dia em que alguma tela vier a
ler o Firestore direto do navegador com o SDK client.

### Configurando um projeto Firebase do zero

1. Crie um projeto em https://console.firebase.google.com (gratuito, plano
   Spark já cobre um projeto de portfólio).
2. **Authentication** → Sign-in method → habilite **Google** e
   **E-mail/senha**.
3. **Firestore Database** → Criar banco de dados (modo produção; as regras
   de acesso vêm de `firestore.rules`, não do modo de teste).
4. Publique as regras: cole o conteúdo de `firestore.rules` em Firestore
   Database → Regras, ou `firebase deploy --only firestore:rules` com o
   [Firebase CLI](https://firebase.google.com/docs/cli).
5. **Configurações do projeto → Geral → Seus apps** → adicione um app Web
   → copie o objeto de config pras variáveis `NEXT_PUBLIC_FIREBASE_*` do
   `.env.local` (ver `.env.example`).
6. **Configurações do projeto → Contas de serviço** → "Gerar nova chave
   privada" → baixa um JSON com `project_id`, `client_email`, `private_key`
   → preencha `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
   `FIREBASE_PRIVATE_KEY` no `.env.local` (mantenha os `\n` literais da
   chave — `lib/firebase/admin.ts` desfaz esse escape).
7. `npm install` (traz `firebase` e `firebase-admin`, que entraram no
   `package.json` nesta rodada) e `npm run dev`.

Sem essas sete env vars preenchidas, o app builda e sobe normalmente, mas
**ninguém consegue logar** (a página de login carrega, os botões existem,
mas o SDK client/Admin SDK falham ao tentar autenticar de verdade) — e como
login é obrigatório, o chat fica inacessível até isso estar configurado.
Isso é intencional (mesmo padrão de "falha só quando usado, nunca só por
existir no código" do resto do projeto — ver `lib/llm/provider.ts`), não um
bug.

## Anexos

O chat aceita anexar imagem, PDF e arquivo de texto genérico (`.txt`/`.md`/`.csv`)
numa mensagem — a mídia entra no modelo (multimodal, via `FileUIPart` da AI
SDK) e fica persistida pra sobreviver a reload/reabrir a conversa.

Login e histórico de mensagens continuam 100% Firebase (Auth + Firestore,
seção acima) — o arquivo binário em si (a imagem/PDF/txt) fica no
**Supabase Storage**, não no Firebase Storage. Motivo: desde set/2024 o
Firebase Storage passou a exigir o projeto no plano Blaze (cartão de crédito
vinculado), mesmo pra ficar dentro da cota grátis — ver
[o anúncio oficial](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).
Supabase Storage no plano Free (1GB de storage, 5GB de egress/mês) não pede
cartão pra criar o projeto, o que mantém este projeto 100% gratuito.

**Setup (uma vez só):**

1. Crie um projeto grátis em https://supabase.com (sem cartão).
2. **Storage** → New bucket → nome `attachments` → deixe **desmarcado**
   "Public bucket". O bucket precisa ficar privado: todo acesso passa pelo
   proxy autenticado em `app/api/attachments/.../route.ts`
   (`lib/storage/attachments.ts` faz o upload, nunca o cliente falando com o
   Supabase direto).
3. **Project Settings → API** → copie a "Project URL" e a chave
   **`service_role`** (não a `anon public` — essa não tem permissão de
   escrita no bucket privado).
4. Preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `.env.local`
   (ver `.env.example`). `SUPABASE_STORAGE_BUCKET` é opcional, default
   `attachments`.

Sem essas duas env vars, o resto do app funciona normal (login, chat sem
anexo) — só a tentativa de enviar um anexo falha (`uploadAttachment()`
lança erro explicando o que falta), mesmo padrão de "falha só quando usado"
já mencionado acima.

Tetos e tipos aceitos ficam centralizados em `lib/attachments/constraints.ts`
(máximo 3 anexos por mensagem; imagem até 6MB, PDF até 10MB, texto até 2MB) —
validados tanto no cliente (`components/chat/Composer.tsx`) quanto no
servidor (`app/api/chat/route.ts`, defesa em profundidade).

## Interface

A UI (`app/page.tsx` + `components/chat/`) segue o design "Kado Chatbot"
feito no Claude Design, adaptado do protótipo estático pra componentes
React de verdade conectados ao backend real do projeto:

- **Sidebar com múltiplas conversas** — carregada do Firestore ao abrir a
  página (`GET /api/threads`), não mais reiniciada a cada reload. "Novo"
  cria uma thread nova (um id gerado com `crypto.randomUUID()`); clicar numa
  conversa já visitada troca na hora (cache local em memória), numa
  conversa ainda não visitada busca o histórico primeiro
  (`GET /api/threads/[id]/messages`). Cada thread tem seu próprio `id`, que
  vira o `id` do `useChat` — a AI SDK descarta e recria o `Chat` interno
  automaticamente quando esse `id` muda, e o `id` viaja sozinho no corpo de
  cada requisição pro backend (ver "Conversas (threads) no backend"
  abaixo). Título e preview de cada conversa vêm do conteúdo real trocado
  nela, nunca de dado inventado — a menos que o usuário renomeie (próximo
  item).
- **Renomear, fixar e excluir conversa** — menu "⋮" ao passar o mouse sobre
  uma conversa na sidebar (`components/chat/Sidebar.tsx`), com as três
  ações batendo em `PATCH`/`DELETE /api/threads/[threadId]`
  (`lib/db/firebase-store.ts`: `renameThread`/`setThreadPinned`, e
  `clearThread` reaproveitado pro excluir). Conversas fixadas (`pinned`)
  aparecem numa seção "Fixados" separada, acima de "Recentes". Renomear é
  otimista na UI e marca a conversa como tendo título "manual" — sem isso,
  o título ao vivo derivado da primeira mensagem (`liveActiveSummary` em
  `app/page.tsx`) sobrescreveria de volta o nome escolhido a cada novo
  token de streaming. Excluir some com a conversa inteira (mensagens +
  metadado), sem confirmação de navegador (`window.confirm`) — a
  confirmação é um segundo passo dentro do próprio menu.
- **Usuário logado + Sair** — rodapé da sidebar mostra avatar (foto do
  Google, quando existe) ou inicial, nome/e-mail, e um botão de logout.
- **Blocos de código** — `lib/parse-message-content.ts` separa texto normal
  de trechos cercados por ` ``` ` na resposta do bot; cada bloco vira um
  `CodeBlock` com label de linguagem e botão de copiar, em vez de aparecer
  como texto cru com os ` ``` ` literais na tela.
- **Ações por mensagem** — copiar (qualquer mensagem), editar (recoloca o
  texto da mensagem no campo de input pra reenviar/ajustar) e refazer (só
  na última resposta do bot — chama o `regenerate()` da AI SDK, o mesmo já
  usado no banner de erro).
- **Tela de Configurações** — botão na sidebar; mostra nome/persona atual e
  a lista de personas disponíveis, e consulta `GET /api/status` pra exibir
  o provider de LLM ativo no momento (só leitura, sem segredo nenhum
  exposto).
- **Menu de anexo** (botão "+" ao lado do input) — só a interface por
  enquanto: abre o menu (Imagem/PDF/Arquivo), mas nenhuma opção envia
  arquivo de verdade. Mesma fidelidade do protótipo original em Claude
  Design, cujo próprio mock também só fecha o menu ao clicar numa opção —
  implementar upload de verdade (parts multimodais na UIMessage, suporte do
  provider, e gravar em `users/{uid}/images` ou `/pdfs`) fica como próximo
  passo caso vire prioridade.

O que existia no protótipo original e **não** foi portado, por decisão
consciente:
- O "seletor de agentes" (Kado/Pesquisador/Modo Turbo/Visão, alguns
  bloqueados até colar uma chave de API) era só decorativo no mock — não
  correspondia a nenhum backend real. Reaproveitei o mecanismo de UI (pill +
  menu suspenso) pro seletor de **Persona**, que é uma feature real.
- O toggle "Vazio / Conversa" no cabeçalho existia só pra pré-visualizar os
  dois estados dentro da ferramenta de design. No app real esse estado já é
  automático (`messages.length === 0`), então foi removido.
- O menu "Chaves de API"/"Agentes incluídos" da tela de configurações do
  mock era decorativo, ligado ao mesmo seletor de agentes fake citado acima
  — não veio pra `SettingsPanel.tsx`, que mostra dado real (persona atual,
  provider de LLM/persistência ativos via `GET /api/status`).

A tela de login (`app/login/page.tsx`) desta vez **veio do mock** (canvas
"Kado Chatbot" tem telas de auth) — layout dividido, formulário à esquerda
e foto à direita (`lg:` pra cima; só o formulário em telas estreitas). Só o
botão "Continuar com Apple" do mock não foi portado — não existe provider
Apple configurado no Firebase Auth deste projeto, e um botão que não faz
nada seria decoração enganosa.

## Habilidades (tools)

O bot não fica só no texto — ele pode chamar funções reais no servidor via
o parâmetro `tools` do `streamText` (`app/api/chat/route.ts`). Habilidades
de hoje, cada uma em `lib/skills/<nome>.ts`:

- `get_datetime` — data/hora atual (o modelo não sabe "agora" sozinho)
- `calculate` — resolve expressões matemáticas com um parser dedicado
  (nunca `eval`/`Function` sobre texto vindo do usuário — ver comentário em
  `lib/skills/calculate.ts`)
- `lookup_pokemon` — consulta a PokéAPI pública (sem chave)
- `lookup_cep` — busca endereço (rua, bairro, cidade, UF, DDD) a partir de
  um CEP brasileiro na ViaCEP (sem chave)
- `list_skills` — o próprio modelo lista as habilidades disponíveis quando
  perguntado "o que você sabe fazer"

Cada tool call aparece na UI como uma faixa discreta acima da resposta,
mostrando o que rodou e o resultado (`components/chat/MessageBubble.tsx`,
usando os helpers `isToolUIPart`/`getToolName` da AI SDK).

### Adicionando uma habilidade nova

1. Crie `lib/skills/minha-skill.ts` exportando uma `tool({ description, inputSchema, execute })`
   (schema com `zod`, igual às habilidades existentes).
2. Registre um item em `lib/skills/catalog.ts` (id, título, descrição) — é o
   que a tool `list_skills` devolve e o que vira o título na UI.
3. Adicione a tool em `getTools()` (`lib/skills/index.ts`), com a chave
   igual ao `id` do passo 2.
4. (Opcional) Adicione um `case` em `lib/skills/render-tool-output.ts` pra
   formatar a saída de forma mais bonita na UI — sem isso, cai num fallback
   JSON genérico, então nada quebra se você pular esse passo.

Nenhum desses passos toca em `route.ts` ou nos componentes de chat.

## Personas

Um seletor na barra de mensagem (`components/chat/Composer.tsx`) deixa
escolher o tom das respostas sem trocar de modelo, de provider ou apagar o
histórico da conversa — só o `system` prompt enviado ao `streamText` muda
dali em diante:

- **Kado** (padrão) — descontraído e direto, como um amigo que manja de
  tecnologia
- **Consultor** — formal e conciso, sem gírias, tom de atendimento
  corporativo
- **Professor** — didático e paciente, explica em passos com analogias

Cada persona é só um `id` + `label` + `tagline` (mostrada na tela vazia) +
`tone` (instrução de tom) em `lib/personas.ts`. O `id` da persona ativa
viaja no corpo da requisição pro `/api/chat` (`body: { personaId }` no
`DefaultChatTransport`); a rota (`app/api/chat/route.ts`) resolve o `id`
pra uma `Persona` via `getPersona()` e monta o `system` prompt concatenando
`BASE_INSTRUCTIONS` (ferramentas disponíveis, idioma — igual pra qualquer
persona) com o `tone` dela. Um `personaId` desconhecido ou ausente cai pra
persona default, então a rota nunca quebra por causa de um corpo malformado.

A tela de Configurações (`components/chat/SettingsPanel.tsx`) mostra a
persona ativa e a lista completa, só como referência — a troca em si
acontece pelo seletor no Composer.

### Adicionando uma persona nova

Só acrescente um item ao array `PERSONAS` em `lib/personas.ts` (`id`,
`label`, `tagline`, `tone`). Nada mais muda — o seletor no Composer, a tela
de Configurações e a resolução no backend já leem dessa lista.

## Conversas (threads) no backend

Cada conversa da sidebar é uma thread independente, identificada por um
`id` gerado no cliente (a primeira, com `useId()` do React pra ser estável
entre servidor e cliente; toda thread nova criada depois, com
`crypto.randomUUID()` dentro do handler de "Nova conversa" — 100%
client-side, sem risco de mismatch de hidratação). Esse `id` é o mesmo `id`
passado pro `useChat`, e a AI SDK já inclui automaticamente o `id` do chat
no corpo de toda requisição.

`app/api/chat/route.ts` lê esse `id` do corpo, mas **de quem** é a thread
nunca vem do corpo — vem do `uid` no cookie de sessão verificado (ver
"Autenticação e Firestore"). Isso fecha um jeito óbvio de furar dados de
outro usuário: mesmo que alguém adulterasse o `id` da thread na requisição,
o caminho no Firestore é sempre `users/{uid-da-sessão}/threads/{id}` — não
existe como escrever ou ler a árvore de outro uid só trocando esse campo.

Título e prévia de cada conversa são gravados no Firestore a cada turno
(`store.touchThread(...)` em `route.ts`): o título só é definido na
primeira mensagem da thread (chamadas seguintes ignoram esse campo de
propósito — ver o contrato do método em `lib/db/types.ts`), a prévia é
sempre atualizada com o texto mais recente.

## Rodando localmente

Pré-requisitos: Node.js 18.18+ (recomendado 20+), uma chave de API do
Google AI Studio (gratuita, sem cartão) **e** um projeto Firebase com
Authentication + Firestore habilitados (ver "Autenticação e Firestore" →
"Configurando um projeto Firebase do zero" — login é obrigatório agora, não
dá pra rodar o chat sem isso).

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie o arquivo de exemplo de variáveis de ambiente:

   ```bash
   cp .env.example .env.local
   ```

3. Gere uma chave em https://aistudio.google.com/apikey e cole em
   `.env.local`:

   ```
   GOOGLE_GENERATIVE_AI_API_KEY=...
   ```

4. Preencha as sete variáveis `NEXT_PUBLIC_FIREBASE_*` e
   `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` no
   mesmo `.env.local`, seguindo o passo a passo da seção "Autenticação e
   Firestore".

5. Suba o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

6. Abra http://localhost:3000 — você cai direto em `/login` (ver
   `middleware.ts`). Crie uma conta ou entre com Google pra chegar no chat.

### Usando OpenAI em vez de Gemini

Defina no `.env.local`:

```
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Atenção: desde maio/2026 a OpenAI exige cartão de crédito cadastrado mesmo
para o crédito de teste único de US$15 (expira em 30 dias). Não é uma opção
gratuita de fato — use só se decidir pagar.

## Deploy na Vercel

1. Suba o projeto para um repositório no GitHub.
2. Em https://vercel.com, "Add New Project" → importe o repositório.
3. Em **Environment Variables**, adicione `GOOGLE_GENERATIVE_AI_API_KEY`
   (ou, se for usar OpenAI, `LLM_PROVIDER=openai` + `OPENAI_API_KEY`) **e**
   as sete variáveis do Firebase (client + admin — ver "Autenticação e
   Firestore"). Pra `FIREBASE_PRIVATE_KEY`, cole a chave com os `\n`
   literais como estão no JSON baixado do Console — a Vercel escapa quebra
   de linha em variável de texto, e `lib/firebase/admin.ts` já desfaz isso.
4. No Firebase Console, **Authentication → Settings → Authorized domains**,
   adicione o domínio da Vercel (`seu-projeto.vercel.app`) — sem isso o
   Google Sign-In falha em produção com "domínio não autorizado".
5. Deploy. A Vercel detecta o Next.js automaticamente — nenhuma configuração
   extra é necessária.

O link gerado (`seu-projeto.vercel.app`) já é o suficiente para colocar no
portfólio; um domínio próprio pode ser apontado depois em Project Settings →
Domains (lembrando de adicionar esse domínio também nos Authorized domains
do passo 4).

## Limitações conhecidas (deliberadas para manter o escopo simples)

- **Cookie de sessão pode ficar dessincronizado do SDK client** — o cookie
  httpOnly expira em 14 dias (máximo permitido pelo Admin SDK), mas o SDK
  client do Firebase renova o próprio token sozinho por muito mais tempo.
  Se o cookie expirar com a aba aberta, o SDK client ainda "acha" que está
  logado, e as chamadas a `/api/chat` passam a devolver 401 até a pessoa
  sair e entrar de novo. Renovar o cookie automaticamente (chamando
  `establishSession()` de novo em background antes de expirar) é o próximo
  passo natural — ver "Próximos passos".
- **E-mail não precisa ser verificado pra usar o chat** — `sendEmailVerification`
  é disparado no cadastro, mas nada bloqueia o acesso enquanto o e-mail não
  é confirmado. Enforçar isso é uma linha a mais em `getSessionUser()` (ver
  `lib/auth/session.ts`) quando virar prioridade.
- **Imagens/PDFs: schema pronto, geração não existe** — `users/{uid}/images`
  e `/pdfs` já têm tipo, store e regra de segurança (ver "Autenticação e
  Firestore"), mas nenhuma feature do bot gera imagem ou PDF ainda.
- **Rate limit por instância, não global** — o `Map` em memória em
  `lib/rate-limit.ts` não é compartilhado entre instâncias serverless da
  Vercel sob carga alta. Suficiente para conter abuso automatizado básico;
  para uma garantia rígida, trocar por Upstash Redis (mesma assinatura de
  função) — continua por IP, não por usuário, mesmo com login.
- **Um único provider de LLM ativo por vez** — não há fallback automático
  entre provedores. Adicionar isso é natural depois, encapsulando um
  `try/catch` com retry em `lib/llm/provider.ts` ou na rota.
- **`lookup_pokemon`/`lookup_cep` dependem de rede externa liberada** —
  funcionam normal na Vercel; só não dá pra testar dentro de sandboxes com
  egress restrito (mesma categoria de limitação que já existia com a API do
  Gemini nesses ambientes).

## Próximos passos sugeridos (se quiser evoluir o projeto)

- Renovar o cookie de sessão automaticamente enquanto o SDK client segue
  logado (evita o usuário ficar preso a um 401 depois de 14 dias com a aba
  aberta — ver "Limitações conhecidas").
- Enforçar e-mail verificado antes de liberar o chat (cadastro por
  e-mail/senha).
- Adicionar um segundo provider (Groq também tem free tier sem cartão e é a
  adição mais barata) para demonstrar a abstração funcionando de fato —
  exige `npm install @ai-sdk/groq` e uma chave de API do Groq.
- Testes: pelo menos um teste de integração da rota `/api/chat` mockando o
  provider e o Admin SDK — exige escolher e instalar um test runner (ex.:
  `vitest`) como devDependency, hoje o projeto não tem nenhum.
- Mais habilidades em `lib/skills/` (ver "Adicionando uma habilidade nova"
  acima) — ex.: busca na web, previsão do tempo.
