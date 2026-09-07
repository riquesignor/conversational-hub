# Chatbot Portfolio

Chatbot com streaming de respostas, construído com Next.js 16 (App Router) e
[Vercel AI SDK](https://ai-sdk.dev). Projeto enxuto propositalmente: sem
banco de dados, sem autenticação, sem orquestração multi-provider complexa —
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
- **Personas** — um seletor na UI troca o tom das respostas (descontraído,
  formal, didático) sem trocar de modelo nem apagar o histórico; ver seção
  "Personas" abaixo
- Rate limiting simples em memória, por IP, protegendo a chave de API contra
  abuso (ver `lib/rate-limit.ts`)
- Persistência de conversas com backend plugável (`lib/db/`) — hoje em
  memória, pronto pra virar Firebase/Firestore trocando uma env var

## Arquitetura

```
app/
├── page.tsx              # UI do chat (client component, hook useChat)
└── api/chat/route.ts     # Route handler: recebe mensagens, chama o LLM, faz stream da resposta

lib/
├── llm/provider.ts        # Abstração de provider de LLM — troca de modelo em um único arquivo
├── personas.ts             # Personas do seletor de tom — id/label/tagline/tone de cada uma
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
mostrando o que rodou e o resultado (`app/page.tsx`, usando os helpers
`isToolUIPart`/`getToolName` da AI SDK).

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

Nenhum desses passos toca em `route.ts` ou `page.tsx`.

## Personas

Um `<select>` no header (`app/page.tsx`) deixa escolher o tom das respostas
sem trocar de modelo, de provider ou apagar o histórico da conversa — só o
`system` prompt enviado ao `streamText` muda dali em diante:

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

### Adicionando uma persona nova

Só acrescente um item ao array `PERSONAS` em `lib/personas.ts` (`id`,
`label`, `tagline`, `tone`). Nada mais muda — o `<select>` da UI e a
resolução no backend já leem dessa lista.

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

Cada mensagem trocada é salva via `lib/db/index.ts`, agrupada por uma sessão
anônima (um UUID em cookie, sem login nenhum). O backend ativo é escolhido
pela env var `DB_PROVIDER`:

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

Importante: isso persiste uma cópia server-side do histórico, mas a UI
continua funcionando como hoje (o `useChat` mantém o estado da conversa no
navegador e reenvia o histórico completo a cada mensagem — recarregar a
página ainda limpa a tela). Carregar o histórico salvo de volta na UI ao
abrir a página é o próximo passo natural depois que o Firebase estiver
plugado, e passa a ser trivial: um `GET` que chama `getStore().getMessages(sessionId)`.

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

- **Sem persistência de histórico** — o histórico de conversa vive só no
  estado do React; recarregar a página limpa o chat. Se quiser persistir,
  a rota mais simples é salvar `messages` no `localStorage` do navegador
  (não precisa de banco de dados para isso).
- **Rate limit por instância, não global** — o `Map` em memória em
  `lib/rate-limit.ts` não é compartilhado entre instâncias serverless da
  Vercel sob carga alta. Suficiente para conter abuso automatizado básico;
  para uma garantia rígida, trocar por Upstash Redis (mesma assinatura de
  função).
- **Um único provider ativo por vez** — não há fallback automático entre
  provedores (diferente da arquitetura full production). Adicionar isso é
  natural depois, encapsulando um `try/catch` com retry em
  `lib/llm/provider.ts` ou na rota.
- **Persistência server-side não é lida de volta pela UI ainda** — o
  histórico é salvo (ver seção acima), mas a tela ainda depende só do
  estado do React; recarregar a página limpa o chat visualmente mesmo com
  o histórico salvo no backend.
- **`lookup_pokemon` depende de rede externa liberada** — funciona normal
  na Vercel; só não dá pra testar dentro de sandboxes com egress
  restrito (mesma categoria de limitação que já existia com a API do
  Gemini nesses ambientes).

## Próximos passos sugeridos (se quiser evoluir o projeto)

- Adicionar um segundo provider (Groq também tem free tier sem cartão e é a
  adição mais barata) para demonstrar a abstração funcionando de fato —
  exige `npm install @ai-sdk/groq` e uma chave de API do Groq, então não dá
  pra ativar sem rodar `npm install` num ambiente com esse pacote disponível.
- Ativar `lib/db/firebase-store.ts` de verdade e carregar o histórico salvo
  de volta na UI ao abrir a página (ver seção "Persistência de conversas").
- Testes: pelo menos um teste de integração da rota `/api/chat` mockando o
  provider — exige escolher e instalar um test runner (ex.: `vitest`) como
  devDependency, hoje o projeto não tem nenhum.
- Mais habilidades em `lib/skills/` (ver "Adicionando uma habilidade nova"
  acima) — ex.: busca na web, previsão do tempo.
