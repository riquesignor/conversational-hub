import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fake mínimo do client do Admin SDK do Firestore — só a fatia de API que
 * lib/db/firebase-store.ts realmente usa (collection/doc/get/set/delete/
 * orderBy/limit/startAfter/batch). Guarda tudo num Map<caminho completo,
 * dado>, então "users/u1/threads/t1" e "users/u1/threads/t1/messages/m1"
 * convivem sem se confundir, do mesmo jeito que coleções/subcoleções reais
 * do Firestore.
 *
 * Não é uma reimplementação do Firestore — só o suficiente pra testar a
 * LÓGICA de touchThread/paginação/etc. sem precisar de um projeto Firebase
 * de verdade (nem do emulador) rodando em CI.
 */
class FakeDb {
  store = new Map<string, unknown>();

  collection(name: string) {
    return new FakeCollectionRef(this.store, name);
  }

  batch() {
    return new FakeBatch(this.store);
  }
}

class FakeBatch {
  private ops: Array<() => void> = [];

  constructor(private store: Map<string, unknown>) {}

  delete(ref: FakeDocRef) {
    this.ops.push(() => this.store.delete(ref.path));
  }

  async commit() {
    for (const op of this.ops) op();
  }
}

class FakeDocRef {
  constructor(
    private store: Map<string, unknown>,
    public path: string,
  ) {}

  async get() {
    const data = this.store.get(this.path);
    return { exists: data !== undefined, data: () => data };
  }

  async set(data: unknown, opts?: { merge?: boolean }) {
    if (opts?.merge) {
      const prev = (this.store.get(this.path) as Record<string, unknown>) ?? {};
      this.store.set(this.path, { ...prev, ...(data as Record<string, unknown>) });
    } else {
      this.store.set(this.path, data);
    }
  }

  async delete() {
    this.store.delete(this.path);
  }

  collection(name: string) {
    return new FakeCollectionRef(this.store, `${this.path}/${name}`);
  }
}

class FakeQuery {
  constructor(
    private store: Map<string, unknown>,
    private path: string,
    private field: string,
    private dir: "asc" | "desc",
    private limitN?: number,
    private startAfterValue?: number,
  ) {}

  limit(n: number) {
    return new FakeQuery(this.store, this.path, this.field, this.dir, n, this.startAfterValue);
  }

  startAfter(value: number) {
    return new FakeQuery(this.store, this.path, this.field, this.dir, this.limitN, value);
  }

  async get() {
    const prefix = `${this.path}/`;
    let docs = [...this.store.entries()]
      .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
      .map(([key, value]) => ({ data: () => value, ref: new FakeDocRef(this.store, key) }));

    docs.sort((a, b) => {
      const av = (a.data() as Record<string, number>)[this.field] ?? 0;
      const bv = (b.data() as Record<string, number>)[this.field] ?? 0;
      return this.dir === "asc" ? av - bv : bv - av;
    });

    if (this.startAfterValue !== undefined) {
      const cursor = this.startAfterValue;
      docs = docs.filter((d) => {
        const v = (d.data() as Record<string, number>)[this.field] ?? 0;
        return this.dir === "asc" ? v > cursor : v < cursor;
      });
    }

    if (this.limitN !== undefined) {
      docs = docs.slice(0, this.limitN);
    }

    return { docs };
  }
}

class FakeCollectionRef {
  constructor(
    private store: Map<string, unknown>,
    public path: string,
  ) {}

  doc(id: string) {
    return new FakeDocRef(this.store, `${this.path}/${id}`);
  }

  orderBy(field: string, dir: "asc" | "desc" = "asc") {
    return new FakeQuery(this.store, this.path, field, dir);
  }

  async get() {
    return this.orderBy("__none__").get();
  }
}

const fakeDb = new FakeDb();

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: () => fakeDb,
}));

// Import só depois do vi.mock (hoisted pelo Vitest pro topo do arquivo de
// qualquer forma, mas deixar explícito ajuda a ler).
const { FirebaseConversationStore } = await import("./firebase-store");

describe("FirebaseConversationStore", () => {
  let store: InstanceType<typeof FirebaseConversationStore>;

  beforeEach(() => {
    fakeDb.store.clear();
    store = new FirebaseConversationStore();
  });

  describe("touchThread", () => {
    it("na criação, usa patch.title quando fornecido", async () => {
      await store.touchThread("u1", "t1", { title: "Minha primeira pergunta" });
      const { items } = await store.listThreads("u1");
      expect(items[0]!.title).toBe("Minha primeira pergunta");
      expect(items[0]!.id).toBe("t1");
    });

    it("na criação, cai pra 'Nova conversa' quando title vem vazio/ausente", async () => {
      await store.touchThread("u1", "t1", {});
      const { items } = await store.listThreads("u1");
      expect(items[0]!.title).toBe("Nova conversa");
    });

    it("na criação, NÃO grava personaId/lastMessagePreview como undefined quando omitidos", async () => {
      await store.touchThread("u1", "t1", { title: "Oi" });
      const raw = fakeDb.store.get("users/u1/threads/t1") as Record<string, unknown>;
      // As chaves precisam estar AUSENTES, não presentes com valor undefined
      // — é exatamente o bug que o Admin SDK real rejeitaria em runtime
      // (.set() lança se algum campo for `undefined`).
      expect("personaId" in raw).toBe(false);
      expect("lastMessagePreview" in raw).toBe(false);
    });

    it("uma chamada seguinte NÃO sobrescreve o título definido na criação", async () => {
      await store.touchThread("u1", "t1", { title: "Título original" });
      await store.touchThread("u1", "t1", { title: "Tentando trocar o título", lastMessagePreview: "oi" });

      const { items } = await store.listThreads("u1");
      expect(items[0]!.title).toBe("Título original");
      expect(items[0]!.lastMessagePreview).toBe("oi");
    });

    it("uma chamada seguinte atualiza updatedAt e faz merge dos outros campos", async () => {
      await store.touchThread("u1", "t1", { title: "T", personaId: "default" });
      const before = (await store.listThreads("u1")).items[0]!;

      await new Promise((r) => setTimeout(r, 5));
      await store.touchThread("u1", "t1", { personaId: "coder" });

      const after = (await store.listThreads("u1")).items[0]!;
      expect(after.personaId).toBe("coder");
      expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
      expect(after.createdAt).toBe(before.createdAt);
    });
  });

  describe("listThreads — paginação", () => {
    async function seedThreads(n: number) {
      for (let i = 0; i < n; i++) {
        await store.touchThread("u1", `t${i}`, { title: `Conversa ${i}` });
        // updatedAt é Date.now() — força timestamps distintos e crescentes
        // (t0 é o mais antigo, t{n-1} o mais recente) sem depender de
        // temporizador de verdade no teste.
        await new Promise((r) => setTimeout(r, 2));
      }
    }

    it("respeita o limit e devolve nextCursor quando há mais páginas", async () => {
      await seedThreads(5);

      const page1 = await store.listThreads("u1", { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.items.map((t) => t.id)).toEqual(["t4", "t3"]); // mais recente primeiro
      expect(page1.nextCursor).not.toBeNull();
    });

    it("o cursor da página 1 busca corretamente a página 2, sem repetir nem pular", async () => {
      await seedThreads(5);

      const page1 = await store.listThreads("u1", { limit: 2 });
      const page2 = await store.listThreads("u1", { limit: 2, cursor: page1.nextCursor });
      const page3 = await store.listThreads("u1", { limit: 2, cursor: page2.nextCursor });

      expect(page2.items.map((t) => t.id)).toEqual(["t2", "t1"]);
      expect(page2.nextCursor).not.toBeNull();

      expect(page3.items.map((t) => t.id)).toEqual(["t0"]);
      expect(page3.nextCursor).toBeNull(); // última página

      const allIds = [...page1.items, ...page2.items, ...page3.items].map((t) => t.id);
      expect(new Set(allIds).size).toBe(5); // nenhum id duplicado entre páginas
    });

    it("sem nenhuma thread, devolve página vazia com nextCursor null", async () => {
      const page = await store.listThreads("u1");
      expect(page.items).toEqual([]);
      expect(page.nextCursor).toBeNull();
    });

    it("limit não numérico/negativo cai pro default em vez de quebrar", async () => {
      await seedThreads(3);
      const page = await store.listThreads("u1", { limit: -5 });
      expect(page.items).toHaveLength(3); // default (30) > 3, devolve tudo
    });
  });

  describe("appendMessage / getMessages", () => {
    it("devolve as mensagens ordenadas cronologicamente (mais antiga primeiro)", async () => {
      await store.appendMessage("u1", "t1", {
        id: "m2",
        role: "assistant",
        text: "segunda",
        createdAt: 200,
      });
      await store.appendMessage("u1", "t1", {
        id: "m1",
        role: "user",
        text: "primeira",
        createdAt: 100,
      });

      const { items } = await store.getMessages("u1", "t1");
      expect(items.map((m) => m.id)).toEqual(["m1", "m2"]);
    });

    it("threads de usuários diferentes não se misturam (isolamento por uid)", async () => {
      await store.appendMessage("u1", "t1", { id: "m1", role: "user", text: "de u1", createdAt: 1 });
      await store.appendMessage("u2", "t1", { id: "m1", role: "user", text: "de u2", createdAt: 1 });

      const { items: itemsU1 } = await store.getMessages("u1", "t1");
      const { items: itemsU2 } = await store.getMessages("u2", "t1");
      expect(itemsU1[0]!.text).toBe("de u1");
      expect(itemsU2[0]!.text).toBe("de u2");
    });

    it("sem cursor, devolve as mensagens MAIS RECENTES (não as mais antigas)", async () => {
      for (let i = 0; i < 5; i++) {
        await store.appendMessage("u1", "t1", {
          id: `m${i}`,
          role: "user",
          text: `msg ${i}`,
          createdAt: i * 100,
        });
      }

      const page = await store.getMessages("u1", "t1", { limit: 2 });
      // m3, m4 são as 2 mais recentes — devolvidas em ordem cronológica.
      expect(page.items.map((m) => m.id)).toEqual(["m3", "m4"]);
      expect(page.nextCursor).not.toBeNull();
    });

    it("o cursor busca a página de mensagens ANTERIORES (mais antigas), sem repetir nem pular", async () => {
      for (let i = 0; i < 5; i++) {
        await store.appendMessage("u1", "t1", {
          id: `m${i}`,
          role: "user",
          text: `msg ${i}`,
          createdAt: i * 100,
        });
      }

      const page1 = await store.getMessages("u1", "t1", { limit: 2 }); // m3, m4
      const page2 = await store.getMessages("u1", "t1", { limit: 2, cursor: page1.nextCursor }); // m1, m2
      const page3 = await store.getMessages("u1", "t1", { limit: 2, cursor: page2.nextCursor }); // m0

      expect(page2.items.map((m) => m.id)).toEqual(["m1", "m2"]);
      expect(page3.items.map((m) => m.id)).toEqual(["m0"]);
      expect(page3.nextCursor).toBeNull();

      // Concatenando as páginas mais antigas ANTES das mais novas (como a UI
      // faria ao "carregar mensagens anteriores"), o histórico completo sai
      // em ordem cronológica correta.
      const fullHistory = [...page3.items, ...page2.items, ...page1.items].map((m) => m.id);
      expect(fullHistory).toEqual(["m0", "m1", "m2", "m3", "m4"]);
    });
  });

  describe("clearThread", () => {
    it("apaga as mensagens e o próprio doc da thread", async () => {
      await store.touchThread("u1", "t1", { title: "T" });
      await store.appendMessage("u1", "t1", { id: "m1", role: "user", text: "oi", createdAt: 1 });

      await store.clearThread("u1", "t1");

      expect((await store.getMessages("u1", "t1")).items).toEqual([]);
      expect((await store.listThreads("u1")).items).toEqual([]);
    });
  });

  describe("renameThread", () => {
    it("sobrescreve o título de uma thread existente", async () => {
      await store.touchThread("u1", "t1", { title: "Título original" });
      await store.renameThread("u1", "t1", "Novo título");

      const { items } = await store.listThreads("u1");
      expect(items[0]!.title).toBe("Novo título");
    });

    it("aparado (trim) e cai pra 'Nova conversa' quando vira vazio", async () => {
      await store.touchThread("u1", "t1", { title: "T" });
      await store.renameThread("u1", "t1", "   ");

      const { items } = await store.listThreads("u1");
      expect(items[0]!.title).toBe("Nova conversa");
    });

    it("não faz nada (sem erro) se a thread não existir", async () => {
      await expect(store.renameThread("u1", "inexistente", "X")).resolves.toBeUndefined();
      expect((await store.listThreads("u1")).items).toEqual([]);
    });

    it("atualiza updatedAt sem mexer em createdAt", async () => {
      await store.touchThread("u1", "t1", { title: "T" });
      const before = (await store.listThreads("u1")).items[0]!;

      await new Promise((r) => setTimeout(r, 5));
      await store.renameThread("u1", "t1", "T2");

      const after = (await store.listThreads("u1")).items[0]!;
      expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
      expect(after.createdAt).toBe(before.createdAt);
    });
  });

  describe("setThreadPinned", () => {
    it("fixa e depois desfixa uma thread", async () => {
      await store.touchThread("u1", "t1", { title: "T" });

      await store.setThreadPinned("u1", "t1", true);
      expect((await store.listThreads("u1")).items[0]!.pinned).toBe(true);

      await store.setThreadPinned("u1", "t1", false);
      expect((await store.listThreads("u1")).items[0]!.pinned).toBe(false);
    });

    it("não faz nada (sem erro) se a thread não existir", async () => {
      await expect(store.setThreadPinned("u1", "inexistente", true)).resolves.toBeUndefined();
      expect((await store.listThreads("u1")).items).toEqual([]);
    });
  });
});
