import { randomUUID } from "node:crypto";
import {
  streamText,
  stepCountIs,
  convertToModelMessages,
  APICallError,
  type UIMessage,
  type FileUIPart,
} from "ai";
import { getModel, getWebSearchTools } from "@/lib/llm/provider";
import { checkRateLimit } from "@/lib/rate-limit";
import { getTools } from "@/lib/skills";
import { getStore } from "@/lib/db";
import { getPersona } from "@/lib/personas";
import { getNimModel, NIM_MODELS } from "@/lib/models";
import { getSessionUser } from "@/lib/auth/session";
import { truncate } from "@/lib/format";
import { MAX_ATTACHMENTS_PER_MESSAGE, validateAttachment } from "@/lib/attachments/constraints";
import { uploadAttachment } from "@/lib/storage/attachments";
import type { StoredAttachment } from "@/lib/db/types";

export const runtime = "nodejs";
// Modelo "reasoning" (Nemotron Lightning, ver lib/models.ts) pode demorar
// mais que uma resposta comum antes do primeiro token visível — 30s batia
// o timeout da function no meio da geração, derrubando a conexão sem erro
// claro pro cliente (aparecia como "travou"). Confirme que 60s cabe no seu
// plano da Vercel (Hobby cobre até 60s; se seu plano for menor, ajuste).
export const maxDuration = 60;

// Instruções que valem pra qualquer persona (ferramentas disponíveis,
// idioma) — o tom de voz em si vive em `lib/personas.ts` e é concatenado
// em `buildSystemPrompt` abaixo. Separado assim pra trocar de persona
// nunca arriscar quebrar a parte que ensina o modelo a usar as tools.
const BASE_INSTRUCTIONS =
  "Você é um assistente de portfólio. " +
  "Responda em português por padrão, a menos que o usuário escreva em outro idioma. " +
  "Você tem ferramentas (tools) disponíveis — use-as sempre que fizerem sentido em " +
  "vez de tentar adivinhar: data/hora atual, contas matemáticas, busca de Pokémon " +
  'na PokéAPI, consulta de endereço por CEP, busca na web em tempo real, notícias ' +
  "recentes (política brasileira, F1, F2, WEC), previsão do tempo de uma cidade e " +
  "status do último deploy deste projeto na Vercel. " +
  'Se o usuário perguntar o que você sabe fazer, use a tool ' +
  '"list_skills" em vez de responder de memória, porque a lista pode mudar. ' +
  "Você também consegue LER anexos que o usuário mandar diretamente na mensagem — " +
  "descreva, transcreva ou responda sobre o conteúdo deles normalmente, sem pedir " +
  "pra colar o texto. Atenção: com o provider NVIDIA (o padrão deste projeto), só " +
  "imagem funciona como anexo — PDF e arquivo de texto são bloqueados antes de " +
  "chegar até você (o usuário já recebe um aviso pra colar o conteúdo direto ou " +
  "trocar de provider). Quando a pergunta depender de " +
  "informação que pode ter mudado depois do seu treinamento (notícias, preços, " +
  "versões de software, eventos recentes), prefira buscar na web em vez de " +
  "responder de memória — e diga que a informação veio de uma busca.";

function buildSystemPrompt(personaId: string | undefined): string {
  const persona = getPersona(personaId);
  return `${BASE_INSTRUCTIONS}\n\n${persona.tone}`;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function lastUserMessage(messages: UIMessage[]): UIMessage | undefined {
  return [...messages].reverse().find((m) => m.role === "user");
}

function textOf(message: UIMessage | undefined): string {
  if (!message) return "";
  return message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

function fileParts(message: UIMessage | undefined): FileUIPart[] {
  if (!message) return [];
  return message.parts.filter((p): p is FileUIPart => p.type === "file");
}

/** Traduz o erro do provider (NVIDIA/Google/OpenAI) pra uma mensagem curta
 * e SEGURA de mostrar pro usuário final — nunca o `responseBody`/`message`
 * cru do provider (pode conter detalhe interno do request), só a categoria
 * do problema a partir do `statusCode`. O erro completo (esse sim, com todo
 * detalhe) sempre vai pro `console.error` de quem chama esta função, que
 * cai no Runtime Log da Vercel — é lá que dá pra confirmar a causa exata
 * (ex.: "model not found" quando o modelId configurado não existe mais no
 * catálogo do provider). Ver lib/models.ts sobre modelo errado ser a causa
 * mais comum de um provider "travar" sem erro nenhum aparecer na tela. */
function describeProviderError(error: unknown): string {
  if (APICallError.isInstance(error)) {
    switch (error.statusCode) {
      case 401:
      case 403:
        return "Chave de API inválida ou sem permissão pro provider configurado.";
      case 404:
        return "Modelo não encontrado no provider — verifique o NVIDIA_MODEL/modelo escolhido em lib/models.ts.";
      case 429:
        return "Limite de requisições do provider atingido. Espere um pouco e tente de novo.";
      default:
        if (error.statusCode && error.statusCode >= 500) {
          return "O provider de IA está com instabilidade no momento. Tente de novo em instantes.";
        }
    }
  }
  // O timeout configurado em streamText (ver `timeout:` abaixo) lança um
  // DOMException com name "TimeoutError" — checa por name E por message
  // (regex) porque DOMException nem sempre é `instanceof Error` dependendo
  // do runtime, então duck-typing é mais seguro que instanceof aqui.
  const name = (error as { name?: unknown } | null)?.name;
  const message = (error as { message?: unknown } | null)?.message;
  if (name === "TimeoutError" || (typeof message === "string" && /timeout|aborted|timed out/i.test(message))) {
    return "O provider demorou demais pra responder (timeout). Tente de novo ou troque de modelo no seletor.";
  }
  return "Erro ao gerar resposta. Verifique a chave de API e o provider configurados.";
}

export async function POST(req: Request) {
  // Login é obrigatório pra usar o chat (ver middleware.ts) — mas o
  // middleware só checa se o cookie EXISTE, não se ele é válido (Edge
  // runtime não roda o Admin SDK). A verificação de verdade é aqui: sem uid
  // confirmado pelo Admin SDK, a rota nem chega a chamar o modelo.
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Não autenticado. Faça login pra conversar." }, { status: 401 });
  }

  const ip = getClientIp(req);
  const { allowed } = checkRateLimit(ip);

  if (!allowed) {
    return Response.json(
      { error: "Muitas mensagens em pouco tempo. Aguarde um minuto e tente de novo." },
      { status: 429 },
    );
  }

  // `id` vem automaticamente no corpo da requisição — é o `id` do `useChat`
  // no cliente (app/page.tsx), o id da CONVERSA (thread) ativa na sidebar.
  // Quem decide DE QUEM é essa thread é sempre `user.uid` (do cookie
  // verificado acima), nunca um campo vindo do corpo — o client não tem
  // como escrever na área de outro uid nem manipulando a requisição.
  const {
    messages,
    personaId,
    modelId,
    id: threadId,
  }: { messages: UIMessage[]; personaId?: string; modelId?: string; id?: string } =
    await req.json();

  const effectiveThreadId = threadId || randomUUID();
  const store = getStore();

  const userMessage = lastUserMessage(messages);
  const userText = textOf(userMessage);
  const userFileParts = fileParts(userMessage);

  if (userFileParts.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return Response.json(
      { error: `Máximo de ${MAX_ATTACHMENTS_PER_MESSAGE} anexos por mensagem.` },
      { status: 400 },
    );
  }

  // Revalida tipo/tamanho no servidor mesmo já validado no Composer — nunca
  // confiar só na checagem do cliente (mesmo princípio de defesa em
  // profundidade do resto desta rota: uid, rate limit, etc). Falha ANTES de
  // gastar uma chamada ao modelo ou tentar subir qualquer coisa pro Storage.
  for (const part of userFileParts) {
    const base64Length = part.url.length - part.url.indexOf(",") - 1;
    const approxBytes = Math.floor((base64Length * 3) / 4);
    const check = validateAttachment(part.mediaType, approxBytes);
    if (!check.ok) {
      return Response.json({ error: check.error }, { status: 400 });
    }
  }

  // Nem todo modelo do catálogo NVIDIA lê imagem (ver `supportsImages` em
  // lib/models.ts) — mandar mesmo assim não dá erro do provider, só some: o
  // modelo ignora o conteúdo que não entende e às vezes responde vazio (ver
  // describeProviderError acima sobre erro mascarado; aqui nem chega a ser
  // erro, então bloqueamos ANTES de gastar a chamada).
  const nimModel = getNimModel(modelId);
  const hasImageAttachment = userFileParts.some((p) => p.mediaType.startsWith("image/"));
  if ((process.env.LLM_PROVIDER || "nvidia") === "nvidia" && hasImageAttachment && !nimModel.supportsImages) {
    const visionModel = NIM_MODELS.find((m) => m.supportsImages);
    return Response.json(
      {
        error:
          `O modelo "${nimModel.label}" não processa imagens.` +
          (visionModel
            ? ` Troque pro "${visionModel.label}" no seletor da barra de mensagem e envie de novo.`
            : ""),
      },
      { status: 400 },
    );
  }

  // Verificado direto em node_modules/@ai-sdk/openai/dist/index.js: o
  // provider "nvidia" (que reaproveita o conversor de mensagens do
  // @ai-sdk/openai, ver getModel() em lib/llm/provider.ts) só sabe converter
  // anexo de IMAGEM (vira `image_url`) e PDF (vira um content-part `file`
  // com `file_data`, formato específico da API da própria OpenAI). Qualquer
  // OUTRO tipo de arquivo — incluindo texto/.txt/.md/.csv, que este projeto
  // também aceita como anexo (ver ATTACHMENT_KINDS em
  // lib/attachments/constraints.ts) — faz o SDK lançar
  // UnsupportedFunctionalityError durante a conversão da mensagem, ANTES de
  // qualquer chamada de rede. E mesmo o PDF é incerto: a NVIDIA NIM expõe uma
  // Chat Completions API clássica, que não documenta suporte ao content-part
  // `file`/`file_data` da OpenAI — não há garantia de que o modelo NIM
  // realmente leia o PDF em vez de só ignorar ou dar erro 400. Por isso
  // bloqueamos os dois ANTES de gastar a chamada, em vez de deixar virar um
  // erro genérico e confuso via describeProviderError (que não reconhece
  // UnsupportedFunctionalityError).
  const hasPdfAttachment = userFileParts.some((p) => p.mediaType === "application/pdf");
  const hasTextFileAttachment = userFileParts.some((p) => p.mediaType.startsWith("text/"));
  if ((process.env.LLM_PROVIDER || "nvidia") === "nvidia" && (hasPdfAttachment || hasTextFileAttachment)) {
    return Response.json(
      {
        error:
          "Modelos NVIDIA (NIM) não leem PDF nem arquivo de texto anexado — só imagem. " +
          "Cole o conteúdo direto na mensagem, ou troque pra LLM_PROVIDER=google (Gemini lê " +
          "PDF e texto nativamente).",
      },
      { status: 400 },
    );
  }

  // Persistência é best-effort: nunca deve derrubar a resposta do chat. Uma
  // mensagem só com anexo (sem legenda) também conta como "tem o que salvar"
  // — por isso o guard abaixo não é só `if (userText)` como antes.
  const userMessageId = randomUUID();
  if (userText || userFileParts.length > 0) {
    // IIFE async (não só `.catch()` solto como o resto da rota) porque este
    // bloco precisa de um `await` antes de chamar appendMessage — subir os
    // anexos pro Storage primeiro. Continua best-effort: erro aqui nunca
    // chega a afetar `result` abaixo, que já começou a streamar em paralelo.
    (async () => {
      try {
        const attachments: StoredAttachment[] = userFileParts.length
          ? await Promise.all(
              userFileParts.map((part) => uploadAttachment(user.uid, effectiveThreadId, userMessageId, part)),
            )
          : [];

        await store.appendMessage(user.uid, effectiveThreadId, {
          id: userMessageId,
          role: "user",
          text: userText,
          createdAt: Date.now(),
          ...(attachments.length > 0 ? { attachments } : {}),
        });
      } catch (err) {
        console.error("[api/chat] falha ao salvar mensagem do usuário (ou seus anexos):", err);
      }
    })();

    // title só "pega" na criação da thread (primeira mensagem) — ver o
    // contrato do método em lib/db/types.ts. Em turnos seguintes isto só
    // atualiza personaId/lastMessagePreview/updatedAt. Uma mensagem só com
    // anexo (sem texto) cai no fallback de touchThread pra título ("Nova
    // conversa", ver lib/db/firebase-store.ts) em vez de truncar string vazia.
    store
      .touchThread(user.uid, effectiveThreadId, {
        ...(userText ? { title: truncate(userText, 40) } : {}),
        personaId,
        modelId,
        lastMessagePreview: truncate(userText || "📎 Anexo", 48),
      })
      .catch((err) => console.error("[api/chat] falha ao atualizar metadados da thread:", err));
  }

  const result = streamText({
    // modelId escolhido no seletor da UI (lib/models.ts) — só tem efeito de
    // fato quando LLM_PROVIDER=nvidia (ver comentário em getModel()).
    model: getModel(nimModel.modelString),
    // Sem isso, cada modelo cai no `max_tokens` default do endpoint da
    // NVIDIA — pequeno demais pro Nemotron Lightning (modelo "reasoning",
    // gasta parte do orçamento "pensando" antes do texto final) e faz o
    // provider devolver resposta vazia/truncada sem erro nenhum. Ver
    // maxOutputTokens em lib/models.ts.
    maxOutputTokens: nimModel.maxOutputTokens,
    system: buildSystemPrompt(personaId),
    messages: await convertToModelMessages(messages),
    // Tools próprias (lib/skills/) + busca nativa do provider ativo (ver
    // getWebSearchTools() em lib/llm/provider.ts — hoje só Gemini, {} pra
    // qualquer outro). ATENÇÃO se um dia usar Gemini 2.x/anteriores: versões
    // mais antigas da Search Grounding tool do Google não podiam ser
    // combinadas com function-calling tools próprias no mesmo request ("tool
    // use with function calling is not supported"). gemini-3.5-flash (default
    // atual, ver provider.ts) já suporta as duas juntas, mas se trocar de
    // modelo e essa combinação passar a estourar erro do provider (vai
    // aparecer no log do onError abaixo), a saída mais rápida é comentar a
    // linha `...getWebSearchTools()` até confirmar suporte na versão nova.
    tools: { ...getTools(), ...getWebSearchTools() },
    // Permite até 5 "passos": o modelo pode chamar uma tool, ler o
    // resultado e responder (ou encadear outra tool) antes de finalizar.
    // Sem isso, a AI SDK para no primeiro tool call e nunca gera a
    // resposta em texto que usa o resultado da tool.
    stopWhen: stepCountIs(5),
    // Sem isso, um provider que trava (confirmado: DeepSeek V4.1 Flash às
    // vezes não manda NENHUM byte de volta, principalmente com imagem —
    // testado direto na API da NVIDIA, ficou 70s+ sem responder) só é
    // interrompido quando a Vercel mata a function no maxDuration (60s, ver
    // topo do arquivo) — e essa morte é do PLATAFORMA, não um erro que a
    // AI SDK consegue capturar, então o cliente não recebe nem o onError
    // abaixo: a tela só fica travada em branco pra sempre. firstChunkMs
    // aborta ANTES disso (dentro do nosso próprio código), o que dispara
    // onError/describeProviderError normalmente e mostra um erro de verdade.
    timeout: { firstChunkMs: 45_000, totalMs: 55_000 },
    onFinish: ({ text }) => {
      if (!text) return;
      store
        .appendMessage(user.uid, effectiveThreadId, {
          id: randomUUID(),
          role: "assistant",
          text,
          createdAt: Date.now(),
        })
        .catch((err) => console.error("[api/chat] falha ao salvar resposta do bot:", err));

      store
        .touchThread(user.uid, effectiveThreadId, { lastMessagePreview: truncate(text, 48) })
        .catch((err) => console.error("[api/chat] falha ao atualizar prévia da thread:", err));
    },
    // Sem isso, um erro do provider (chave inválida, quota, modelo errado
    // etc.) vira só "An error occurred" pro cliente e some sem deixar
    // rastro nenhum no log da Vercel. Loga o erro real aqui.
    onError: ({ error }) => {
      console.error("[api/chat] streamText error:", error);
    },
  });

  return result.toUIMessageStreamResponse({
    // Mesma lógica: a AI SDK mascara erros de servidor por padrão pra não
    // vazar detalhes sensíveis pro cliente. Logamos o erro real aqui
    // também (fica no Runtime Log da Vercel) e devolvemos uma categoria
    // seguro de mostrar (ver describeProviderError acima) em vez do texto
    // cru do provider ou de uma mensagem genérica sempre igual.
    onError: (error) => {
      console.error("[api/chat] stream response error:", error);
      return describeProviderError(error);
    },
  });
}
