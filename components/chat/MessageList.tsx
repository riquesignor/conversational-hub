"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { UIMessage } from "ai";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageBubble, messageText } from "./MessageBubble";

// Espaçamento vertical entre linhas — antes vinha de gap-3.5 no flex
// container; sob virtualização cada linha é posicionada via `transform`
// (não é mais flex layout), então o gap vira padding-bottom por linha.
const ROW_GAP_PX = 14;

/**
 * Uma "linha" da lista virtualizada. Mensagens de verdade são a maioria, mas
 * o indicador de "digitando", o banner de erro e o botão "carregar
 * anteriores" também entram no fluxo de scroll — viram linhas com o mesmo
 * mecanismo de medição/posicionamento em vez de ficarem fora da área
 * virtualizada (o que exigiria dois containers de scroll sincronizados).
 */
type Row =
  | { kind: "load-older" }
  | { kind: "message"; message: UIMessage }
  | { kind: "typing" }
  | { kind: "error" };

function rowKey(row: Row): string {
  switch (row.kind) {
    case "load-older":
      return "__load-older__";
    case "message":
      return row.message.id;
    case "typing":
      return "__typing__";
    case "error":
      return "__error__";
  }
}

// Chute inicial de altura por tipo de linha — só precisa ser "próximo o
// suficiente" pra não deixar a barra de scroll saltando muito antes da
// medição real (measureElement, via ResizeObserver) corrigir no primeiro
// paint de cada linha. Pra mensagem, escala com o tamanho do texto (uma
// resposta de 3 parágrafos e um "ok" não deveriam usar a mesma estimativa).
function estimateRowSize(row: Row): number {
  switch (row.kind) {
    case "load-older":
      return 48;
    case "typing":
      return 68;
    case "error":
      return 68;
    case "message": {
      const text = messageText(row.message);
      const approxLines = Math.max(1, Math.ceil(text.length / 55));
      // Anexo (imagem/PDF/texto, ver MessageBubble.tsx) soma uma estimativa
      // fixa por item — bem grosseiro de propósito (uma imagem pode ir de
      // poucos px de altura até o teto de 256px de max-h-64), só pra chutar
      // mais perto do real e sofrer menos salto de scroll até measureElement
      // corrigir no primeiro paint (ver comentário da função acima).
      const attachmentCount = row.message.parts.filter((p) => p.type === "file").length;
      return 44 + approxLines * 21 + attachmentCount * 120;
    }
  }
}

function lastMessageSignature(messages: UIMessage[]): string {
  const last = messages[messages.length - 1];
  if (!last) return "";
  const text = last.parts.find(
    (p): p is Extract<typeof p, { type: "text" }> => p.type === "text",
  )?.text;
  // id + tamanho do texto já basta pra detectar "a última mensagem mudou"
  // (nova mensagem OU token novo chegando no streaming) sem comparar o
  // array inteiro — é só isso que decide se rola pro fim (ver efeito
  // abaixo).
  return `${last.id}:${text?.length ?? 0}`;
}

interface MessageListProps {
  messages: UIMessage[];
  botName: string;
  isSubmitted: boolean;
  isLoading: boolean;
  error: Error | undefined;
  onEdit: (text: string) => void;
  onRedo: () => void;
  onRetry: () => void;
  /** Há uma página de mensagens mais antigas ainda não carregada (ver
   * lib/db/firebase-store.ts — a página inicial já vem com teto). */
  hasOlderMessages: boolean;
  loadingOlderMessages: boolean;
  onLoadOlderMessages: () => void;
  /** Div com overflow-y-auto que efetivamente rola — dono dela é page.tsx
   * (é compartilhada com os estados de loading/empty), repassada como VALOR
   * (não como RefObject) de propósito: é `useState`, não `useRef`, do lado
   * de page.tsx. A virtualização precisa saber, via re-render, assim que
   * esse elemento passa de null pro nó real — um RefObject não dispara
   * re-render nenhum quando `.current` muda, então o layout effect interno
   * do useVirtualizer (que só reavalia `getScrollElement()` a cada render)
   * podia ficar preso vendo `null` pra sempre se o elemento só existisse
   * DEPOIS do primeiro render em que o hook rodou (ver comentário mais
   * abaixo, no useVirtualizer, sobre a corrida que isto evita). */
  scrollContainerEl: HTMLDivElement | null;
}

export function MessageList({
  messages,
  botName,
  isSubmitted,
  isLoading,
  error,
  onEdit,
  onRedo,
  onRetry,
  hasOlderMessages,
  loadingOlderMessages,
  onLoadOlderMessages,
  scrollContainerEl,
}: MessageListProps) {
  const prevTailSigRef = useRef("");
  // scrollHeight capturado no instante do clique em "carregar anteriores",
  // ANTES do fetch resolver — null quando não há restauração pendente.
  const preLoadScrollHeightRef = useRef<number | null>(null);

  // Conversas longas (sobretudo depois da paginação: cada "carregar mais"
  // empilha +50 mensagens) deixavam de caber confortavelmente no DOM — cada
  // token de streaming forçava o navegador a recalcular layout de centenas
  // de nós. Virtualização mantém só as linhas visíveis (+ overscan) montadas
  // por vez; o resto vira só altura reservada no sizer abaixo.
  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];
    if (hasOlderMessages) result.push({ kind: "load-older" });
    for (const message of messages) result.push({ kind: "message", message });
    if (isSubmitted) result.push({ kind: "typing" });
    if (error) result.push({ kind: "error" });
    return result;
  }, [messages, hasOlderMessages, isSubmitted, error]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    // `scrollContainerEl` é state do componente-pai (ver comentário na prop
    // acima), não um ref — então quando ele passa de null pro elemento real,
    // MessageList re-renderiza e esta função (recriada a cada render) já
    // devolve o valor certo. Com um RefObject aqui, o layout effect interno
    // da lib roda uma vez só (a cada render de MessageList, sem depender de
    // nada) e, se calhar de rodar ANTES do ref ser anexado (comum sob
    // Strict Mode em dev — React monta, desmonta e remonta de propósito pra
    // pegar bug de efeito mal limpo, RFC "Ensuring reusable state"), fica
    // sem nenhum outro gatilho pra tentar de novo: nada mais faz
    // MessageList re-renderizar, e a lib nunca chega a ver o scroll element
    // de verdade. Confirmado isso na prática rodando a lista virtualizada
    // isolada — sem essa mudança, getVirtualItems() ficava vazio pra sempre.
    getScrollElement: () => scrollContainerEl,
    estimateSize: (index) => estimateRowSize(rows[index]!),
    // getItemKey por IDENTIDADE (id da mensagem, não posição) é o que faz o
    // cache de medição da lib sobreviver a um prepend de mensagens antigas
    // sem se desalinhar — sem isto, a linha que era o índice 0 "herdaria" a
    // altura medida da mensagem que ocupava esse índice antes do prepend.
    getItemKey: (index) => rowKey(rows[index]!),
    overscan: 6,
  });

  // Rola pro fim só quando a ÚLTIMA mensagem muda de verdade (nova mensagem,
  // ou mais um token chegando no streaming) ou quando o indicador "digitando"
  // aparece — nunca quando `messages` muda só porque uma página de mensagens
  // MAIS ANTIGAS foi anteposta ao array (ver handleLoadOlder abaixo, que tem
  // seu próprio efeito de preservação de posição).
  //
  // scrollContainerEl entra nas deps por um motivo específico: no mount,
  // este efeito já roda na PRIMEIRA renderização de MessageList — momento em
  // que scrollContainerEl ainda é null (é state do componente pai, só vira
  // o elemento real numa renderização seguinte, ver comentário na prop). Se
  // a gente marcasse "já tratei esta cauda" (prevTailSigRef) mesmo sem ter
  // rolado de verdade, perderíamos a ÚNICA chance de rolar pro fim ao abrir
  // uma conversa já carregada — por isso o early return abaixo NÃO atualiza
  // prevTailSigRef quando ainda não há pra onde rolar, e a mudança de
  // scrollContainerEl (null → elemento) dispara uma nova tentativa.
  useEffect(() => {
    if (!scrollContainerEl) return;
    const sig = lastMessageSignature(messages);
    const tailChanged = sig !== prevTailSigRef.current;
    if ((tailChanged || isSubmitted) && rows.length > 0) {
      prevTailSigRef.current = sig;
      rowVirtualizer.scrollToIndex(rows.length - 1, { align: "end", behavior: "smooth" });
    }
    // rowVirtualizer não é estável por identidade entre renders (é recriado
    // pelo hook), incluí-lo nas deps disparoria o efeito a cada render à
    // toa — a chamada em si já lê a instância mais recente via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isSubmitted, rows.length, scrollContainerEl]);

  // Preserva a posição visual de leitura depois de anteposto um lote de
  // mensagens mais antigas: sem isto, o navegador mantém o scrollTop em
  // PIXELS, e como o conteúdo novo entra ACIMA do que já estava na tela,
  // tudo que o usuário via "empurra" pra baixo — parece um salto. Roda em
  // useLayoutEffect (síncrono, antes do navegador pintar) pra não haver
  // flash do salto acontecendo e sendo corrigido em seguida.
  //
  // Limitação aceita: o sizer da virtualização usa ALTURA ESTIMADA pras
  // linhas recém-adicionadas (measureElement/ResizeObserver só mede depois
  // de montadas) — a compensação abaixo já usa essa estimativa no mesmo
  // layout effect, então fica correta na prática; só pode haver um ajuste
  // fino adicional, quase imperceptível, no instante em que a medição real
  // substitui a estimativa.
  useLayoutEffect(() => {
    const container = scrollContainerEl;
    const before = preLoadScrollHeightRef.current;
    if (container && before !== null) {
      container.scrollTop += container.scrollHeight - before;
    }
    preLoadScrollHeightRef.current = null;
  }, [messages, scrollContainerEl]);

  function handleLoadOlder() {
    preLoadScrollHeightRef.current = scrollContainerEl?.scrollHeight ?? null;
    onLoadOlderMessages();
  }

  // Índice, dentro de `rows`, da última mensagem de verdade — NÃO é sempre
  // `rows.length - 1`: quando há um banner de erro (ou o indicador
  // "digitando") depois dela, esses viram linhas extras no fim. showRedo só
  // deve marcar a última mensagem de assistente de verdade, então precisa
  // desse índice calculado à parte em vez de comparar contra o fim de `rows`.
  const lastMessageRowIndex = (hasOlderMessages ? 1 : 0) + messages.length - 1;

  function renderRow(row: Row, index: number) {
    switch (row.kind) {
      case "load-older":
        return (
          <div className="flex justify-center pb-1">
            <button
              onClick={handleLoadOlder}
              disabled={loadingOlderMessages}
              className="rounded-md border border-divider px-3 py-1.5 text-xs font-semibold text-accent-text transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              {loadingOlderMessages ? "Carregando…" : "Carregar mensagens anteriores"}
            </button>
          </div>
        );

      case "message":
        return (
          <MessageBubble
            message={row.message}
            botName={botName}
            showRedo={!isLoading && row.message.role === "assistant" && index === lastMessageRowIndex}
            onEdit={onEdit}
            onRedo={onRedo}
          />
        );

      case "typing":
        return (
          <div className="flex animate-fade-in-up flex-col items-start">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-accent-text">
              {botName}
            </span>
            <div className="flex items-center gap-1.5 rounded-[var(--radius-md)] rounded-bl-[6px] border border-divider bg-surface px-3.5 py-3">
              <span className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-accent-text" />
              <span
                className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-accent-text"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-accent-text"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        );

      case "error":
        return (
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-[var(--radius-md)] border border-divider bg-surface px-3 py-2.5">
            <p className="m-0 text-sm">Algo travou aqui. Tenta de novo?</p>
            <button
              onClick={onRetry}
              className="flex-none rounded-md border border-divider px-2.5 py-1.5 text-xs font-semibold text-accent-text transition-colors hover:bg-surface-2"
            >
              Tentar de novo
            </button>
          </div>
        );
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-8">
      <div style={{ position: "relative", height: rowVirtualizer.getTotalSize(), width: "100%" }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              paddingBottom: ROW_GAP_PX,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderRow(rows[virtualRow.index]!, virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
