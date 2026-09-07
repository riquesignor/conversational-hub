# Chatbot Portfolio

Chatbot com streaming de respostas, construído com Next.js 16 (App Router) e
[Vercel AI SDK](https://ai-sdk.dev). Interface em sidebar com múltiplas
conversas, inspirada em ChatGPT/Claude, com o sistema de design "Modernist"
(flat, raio zero, divisores de 2px, acento vermelho-laranja). Projeto enxuto
propositalmente: sem autenticação, sem orquestração multi-provider complexa —
o objetivo é ser um demo limpo e fácil de rodar/deployar para portfólio.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4)
- **Vercel AI SDK** (`ai` + `@ai-sdk/react`) — streaming de tokens e o hook
  `useChat`
- **Google Gemini** (`gemini-3.5-flash` por padrão) via `@ai-sdk/google` —
  provider default porque o free tier não exige cartão de crédito
- **OpenAI** (`gpt-4o-mini`) via `@ai-sdk/openai` — implementado como
  alternativa, mas desde maio/2026 a OpenAI exige cartão cadastrado mesmo
  para o crédito de teste
- **Tool calling** — o bot tem habilidades reais (data/hora, calculadora,
  busca de Pokémon na PokéAPI, consulta de CEP, listagem das próprias
  habilidades) via o parâmetro `tools` da AI SDK; ver seção "Habilidades
  (tools)" abaixo
- **Personas** — um seletor na barra de mensagem troca o tom das respostas
  (descontraído, formal, didático) sem trocar de modelo nem apagar o
  histórico; ver seção "Personas" abaixo
- **Conversas (threads)** — sidebar com múltiplas conversas, cada uma
  persistida separadamente no backend; ver seção "Interface" abaixo
- Rate limiting simples em memória, por IP, protegendo a chave de API contra
  abuso (ver `lib/rate-limit.ts`)
- Persistência de conversas com backend plugável (`lib/db/`) — hoje em
  memória, pronto pra virar Firebase/Firestore trocando uma env var

## Arquitetura

```
app/
├── page.tsx                # Orquestra o chat: estado de threads/persona, useChat, layout
└── api/
    ├── chat/route.ts        # Route handler: recebe mensagens, chama o LLM, faz stream da resposta
    └── status/route.ts      # GET só-leitura: provider de LLM e de persistência ativos (pra tela de Configurações)

components/chat/
├── icons.tsx                # Ícones SVG do design (Modernist), um componente por ícone
├── Sidebar.tsx               # Lista de conversas + "Nova conversa" + botão Configurações
├── ChatHeader.tsx            # Cabeçalho do chat (avatar, nome, status online/digitando)
├── EmptyState.tsx            # Tela vazia (avatar grande, tagline da persona, chips sugeridos)
├── MessageList.tsx           # Lista de mensagens + indicador de digitação + banner de erro
├── MessageBubble.tsx         # Uma mensagem: texto/código/tool call + ações (copiar/editar/refazer)
├── CodeBlock.tsx             # Bloco de código com label de linguagem + botão copiar
├── Composer.tsx               # Input + menu de anexo (decorativo) + seletor de persona
└── SettingsPanel.tsx          # Tela de configurações (sobre o bot, personas, backend ativo)

lib/
├── llm/provider.ts        # Abstração de provider de LLM — troca de modelo em um único arquivo
├── personas.ts             # Personas do seletor de tom — id/label/tagline/tone de cada uma
├── parse-message-content.ts # Parser simples de blocos ```código``` dentro do texto de uma mensagem
├── rate-limit.ts           # Rate limiter em memória por IP
├── skills/                 # Habilidades (tools) do bot — registro central + uma tool por arquivo
│   ├── catalog.ts           # Metadados (id/título/descrição) de cada habilidade
│   ├── get-datetime.ts, calculate.ts, lookup-pokemon.ts, lookup-cep.ts, list-skills.ts
│   ├── render-tool-output.ts # Formata a saída de uma tool pra UI
│   └── index.ts              # getTools() — o que entra no `tools` do streamText
└── db/                      # Persistência de conversas — backend plugável
    ├── types.ts              # Interface ConversationStore
    ├── memory-store.ts        # Implementação default (sem configuração)
    ├── firebase-store.ts      # Esqueleto pronto pra ativar (ver comentários no arquivo)
    └── index.ts               # getStore() — troca de backend via DB_PROVIDER
```

A escolha de provider de LLM é centralizada em `lib/llm/provider.ts` e
controlada pela variável `LLM_PROVIDER` (`google` ou `openai`). Adicionar
outro provider (ex.: Groq) é instalar o pacote `@ai-sdk/<provider>` e
adicionar um `case` nesse arquivo — nenhum outro ponto do código muda,
porque todo provider da AI SDK implementa a mesma interface `LanguageModel`.

## Interface

A UI (`app/page.tsx` + `components/chat/`) segue o design "Zezinho Chatbot"
feito no Claude Design, adaptado do protótipo estático pra componentes
React de verdade conectados ao backend real do projeto:

- **Sidebar com múltiplas conversas** — "Nova conversa" cria uma thread nova
  (um id gerado com `crypto.randomUUID()`); clicar numa conversa na lista
  troca pra ela. Cada thread tem seu próprio `id`, que vira o `id` do
  `useChat` — a AI SDK descarta e recria o `Chat` interno automaticamente
  quando esse `id` muda, e o `id` viaja sozinho no corpo de cada requisição
  pro backend (ver "Conversas (threads) no backend" abaixo). Título e
  preview de cada conversa na sidebar vêm do conteúdo real trocado nela
  (primeira mensagem do usuário / última mensagem), nunca de dado inventado.
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
  o provider de LLM e de persistência ativos no momento (só leitura, sem
  segredo nenhum exposto).
- **Menu de anexo** (botão "+" ao lado do input) — só a interface por
  enquanto: abre o menu (Imagem/PDF/Arquivo), mas nenhuma opção envia
  arquivo de verdade. Mesma fidelidade do protótipo original em Claude
  Design, cujo próprio mock também só fecha o menu ao clicar numa opção —
  implementar upload de verdade (parts multimodais na UIMessage, suporte do
  provider) fica como próximo passo caso vire prioridade.

O que existia no protótipo original e **não** foi portado, por decisão
consciente:
- O "seletor de agentes" (Zezinho/Pesquisador/Modo Turbo/Visão, alguns
  bloqueados até colar uma chave de API) era só decorativo no mock — não
  correspondia a nenhum backend real (o projeto usa um único provider por
  vez, via `LLM_PROVIDER`). Reaproveitei o mecanismo de UI (pill + menu
  suspenso) pro seletor de **Persona**, que é uma feature real do backend.
- O toggle "Vazio / Conversa" no cabeçalho existia só pra pré-visualizar os
  dois estados dentro da ferramenta de design. No app real esse estado já é
  automático (`messages.length === 0`), então o toggle não tem função e foi
  removido.

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

- **Zezinho** (padrão) — descontraído e direto, como um amigo que manja de
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
no corpo de toda requisição — `app/api/chat/route.ts` só precisa ler `id`
do corpo (`const { messages, personaId, id: threadId } = await req.json()`)
e usar esse valor como chave em `lib/db` pra persistir a conversa certa.

Isso substitui o cookie de sessão anônima que a rota usava antes de o
projeto ter múltiplas conversas na sidebar — não fazia mais sentido manter
uma única "sessão" por navegador quando cada aba pode ter N conversas
simultâneas, cada uma com seu próprio histórico. `Set-Cookie` foi removido
da resposta.

Trade-off dessa mudança: antes, o cookie sobrevivia a um reload (mesmo sem
a UI recarregar o histórico — ver limitação abaixo), o que deixava a porta
aberta pra, no futuro, recuperar a mesma sessão automaticamente. Com o `id`
gerado no cliente, um reload da página sempre começa uma primeira thread
nova (e a lista da sidebar, que é só estado React, reseta junto). Não é uma
regressão prática hoje (a UI nunca recarregava histórico mesmo com o
cookie), mas é bom ter registrado pra quando "carregar conversas antigas ao
abrir a página" virar prioridade de verdade (ver "Próximos passos").

## Rodando localmente

Pré-requisitos: Node.js 18.18+ (recomendado 20+) e uma chave de API do
Google AI Studio (gratuita, sem cartão).

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie o arquivo de exemplo de variáveis de ambiente:

   ```bash
   cp .env.example .env.local
   ```

3. Gere uma chave em https://aistudio.google.com/apikey (login com conta
   Google, sem necessidade de cadastrar cartão para o tier gratuito) e cole
   em `.env.local`:

   ```
   GOOGLE_GENERATIVE_AI_API_KEY=...
   ```

4. Suba o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

5. Abra http://localhost:3000 e converse com o bot.

### Usando OpenAI em vez de Gemini

Defina no `.env.local`:

```
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Atenção: desde maio/2026 a OpenAI exige cartão de crédito cadastrado mesmo
para o crédito de teste único de US$15 (expira em 30 dias). Não é uma opção
gratuita de fato — use só se decidir pagar.

## Persistência de conversas (pronto pra Firebase)

Cada mensagem trocada é salva via `lib/db/index.ts`, agrupada pelo `id` da
thread (ver "Conversas (threads) no backend" acima). O backend ativo é
escolhido pela env var `DB_PROVIDER`:

- `DB_PROVIDER=memory` (default) — guarda tudo num `Map` em memória, mesma
  categoria de limitação do rate limiter: não sobrevive a cold start/redeploy
  e não é compartilhado entre instâncias serverless. Funciona sem nenhuma
  configuração, então é o default.
- `DB_PROVIDER=firebase` — usa `lib/db/firebase-store.ts`, hoje um esqueleto
  que só lança um erro explicando o que falta. Pra ativar de verdade:
  1. `npm install firebase-admin`
  2. Criar um projeto no [Firebase Console](https://console.firebase.google.com)
     e gerar uma service account (Project Settings → Service Accounts →
     Generate new private key)
  3. Preencher `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e
     `FIREBASE_PRIVATE_KEY` no `.env.local`/Vercel
  4. Descomentar a implementação de referência já escrita (comentada) no
     final de `lib/db/firebase-store.ts`
  5. Trocar `DB_PROVIDER=firebase`

Nenhum outro arquivo do projeto precisa mudar — `route.ts` só conhece a
interface `ConversationStore`, nunca o backend concreto (mesmo padrão do
provider de LLM).

Importante: isso persiste uma cópia server-side de cada thread, mas a UI
continua funcionando como hoje (a sidebar guarda a lista de conversas só em
estado React; recarregar a página limpa a lista e o histórico visível,
mesmo com tudo salvo no backend). Carregar as conversas salvas de volta na
sidebar ao abrir a página é o próximo passo natural depois que o Firebase
estiver plugado (ver "Próximos passos").

## Deploy na Vercel

1. Suba o projeto para um repositório no GitHub.
2. Em https://vercel.com, "Add New Project" → importe o repositório.
3. Em **Environment Variables**, adicione `GOOGLE_GENERATIVE_AI_API_KEY`
   (ou, se for usar OpenAI, `LLM_PROVIDER=openai` + `OPENAI_API_KEY`).
4. Deploy. A Vercel detecta o Next.js automaticamente — nenhuma configuração
   extra é necessária.

O link gerado (`seu-projeto.vercel.app`) já é o suficiente para colocar no
portfólio; um domínio próprio pode ser apontado depois em Project Settings →
Domains.

## Limitações conhecidas (deliberadas para manter o escopo simples)

- **Sidebar não sobrevive a reload** — a lista de conversas e o histórico
  visível vivem só no estado do React; recarregar a página zera a sidebar e
  começa uma conversa nova (mesmo com o conteúdo anterior já salvo no
  backend — ver "Persistência de conversas"). Carregar isso de volta ao
  abrir a página é o passo natural depois do Firebase.
- **Rate limit por instância, não global** — o `Map` em memória em
  `lib/rate-limit.ts` não é compartilhado entre instâncias serverless da
  Vercel sob carga alta. Suficiente para conter abuso automatizado básico;
  para uma garantia rígida, trocar por Upstash Redis (mesma assinatura de
  função).
- **Um único provider ativo por vez** — não há fallback automático entre
  provedores (diferente da arquitetura full production). Adicionar isso é
  natural depois, encapsulando um `try/catch` com retry em
  `lib/llm/provider.ts` ou na rota.
- **Menu de anexo é só interface** — abre e fecha, mas não envia arquivo
  nenhum de verdade (ver seção "Interface" acima).
- **`lookup_pokemon`/`lookup_cep` dependem de rede externa liberada** —
  funcionam normal na Vercel; só não dá pra testar dentro de sandboxes com
  egress restrito (mesma categoria de limitação que já existia com a API do
  Gemini nesses ambientes).

## Próximos passos sugeridos (se quiser evoluir o projeto)

- Carregar as conversas salvas de volta na sidebar ao abrir a página —
  natural depois de ativar `lib/db/firebase-store.ts` de verdade (ver
  "Persistência de conversas"); hoje não tem como listar "as conversas
  desse navegador" sem @algum identificador estável entre visitas (o cookie
  de sessão foi removido — ver "Conversas (threads) no backend" — então
  esse próximo passo provavelmente volta a precisar de algo do tipo, ou de
  autenticação de verdade).
- Upload de anexo de verdade (imagem/PDF/arquivo) — o botão e o menu já
  existem na UI (`components/chat/Composer.tsx`), falta a parte real: subir
  o arquivo, converter pra uma `FileUIPart` da AI SDK, e confirmar que o
  provider ativo (Gemini/GPT-4o mini) suporta o tipo de mídia enviado.
- Adicionar um segundo provider (Groq também tem free tier sem cartão e é a
  adição mais barata) para demonstrar a abstração funcionando de fato —
  exige `npm install @ai-sdk/groq` e uma chave de API do Groq, então não dá
  pra ativar sem rodar `npm install` num ambiente com esse pacote disponível.
- Testes: pelo menos um teste de integração da rota `/api/chat` mockando o
  provider — exige escolher e instalar um test runner (ex.: `vitest`) como
  devDependency, hoje o projeto não tem nenhum.
- Mais habilidades em `lib/skills/` (ver "Adicionando uma habilidade nova"
  acima) — ex.: busca na web, previsão do tempo.
