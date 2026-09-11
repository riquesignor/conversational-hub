import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fake mínimo do client do Admin SDK do Firestore — só a fatia de API que
 * lib/db/firebase-store.ts realmente usa (collection/doc/get/set/delete/
 * orderBy). Guarda tudo num Map<caminho completo, dado>, então
 * "users/u1/threads/t1" e "users/u1/threads/t1/messages/m1" convivem sem
 * se confundir, do mesmo jeito que coleções/subcoleções reais do Firestore.
 *
 * Não é uma reimplementação do Firestore — só o suficiente pra testar a
 * LÓGICA de touchThread/appendMessage/etc. sem precisar de um projeto
 * Firebase de verdade (nem do emulador) rodando em CI.
 */
class FakeDb {
  store = new Map<string, unknown>();

  collection(name: string) {
    return new FakeCollectionRef(this.store, name);
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

class FakeCollectionRef {
  constructor(
    private store: Map<string, unknown>,
    public path: string,
  ) {}

  doc(id: string) {
    return new FakeDocRef(this.store, `${this.path}/${id}`);
  }

  orderBy(field: string, dir: "asc" | "desc" = "asc") {
    return {
      get: async () => {
        const prefix = `${this.path}/`;
        const docs = [...this.store.entries()]
          .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
          .map(([key, value]) => ({
            data: () => value,
            ref: new FakeDocRef(this.store, key),
          }));
        docs.sort((a, b) => {
          const av = (a.data() as Record<string, number>)[field] ?? 0;
          const bv = (b.data() as Record<string, number>)[field] ?? 0;
          return dir === "asc" ? av - bv : bv - av;
        });
        return { docs };
      },
    };
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
      const [thread] = await store.listThreads("u1");
      expect(thread.title).toBe("Minha primeira pergunta");
      expect(thread.id).toBe("t1");
    });

    it("na criação, cai pra 'Nova conversa' quando title vem vazio/ausente", async () => {
      await store.touchThread("u1", "t1", {});
      const [thread] = await store.listThreads("u1");
      expect(thread.title).toBe("Nova conversa");
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

      const [thread] = await store.listThreads("u1");
      expect(thread.title).toBe("Título original");
      expect(thread.lastMessagePreview).toBe("oi");
    });

    it("uma chamada seguinte atualiza updatedAt e faz merge dos outros campos", async () => {
      await store.touchThread("u1", "t1", { title: "T", personaId: "default" });
      const before = (await store.listThreads("u1"))[0];

      await new Promise((r) => setTimeout(r, 5));
      await store.touchThread("u1", "t1", { personaId: "coder" });

      const after = (await store.listThreads("u1"))[0];
      expect(after.personaId).toBe("coder");
      expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
      expect(after.createdAt).toBe(before.createdAt);
    });
  });

  describe("appendMessage / getMessages", () => {
    it("devolve as mensagens ordenadas por createdAt ascendente", async () => {
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

      const messages = await store.getMessages("u1", "t1");
      expect(messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    });

    it("threads de usuários diferentes não se misturam (isolamento por uid)", async () => {
      await store.appendMessage("u1", "t1", { id: "m1", role: "user", text: "de u1", createdAt: 1 });
      await store.appendMessage("u2", "t1", { id: "m1", role: "user", text: "de u2", createdAt: 1 });

      const [msgU1] = await store.getMessages("u1", "t1");
      const [msgU2] = await store.getMessages("u2", "t1");
      expect(msgU1.text).toBe("de u1");
      expect(msgU2.text).toBe("de u2");
    });
  });

  describe("clearThread", () => {
    it("apaga as mensagens e o próprio doc da thread", async () => {
      await store.touchThread("u1", "t1", { title: "T" });
      await store.appendMessage("u1", "t1", { id: "m1", role: "user", text: "oi", createdAt: 1 });

      await store.clearThread("u1", "t1");

      expect(await store.getMessages("u1", "t1")).toEqual([]);
      expect(await store.listThreads("u1")).toEqual([]);
    });
  });
});
