import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Limpia el DOM después de cada test
afterEach(() => {
  cleanup();
});

/* ===========================================================
   MOCK FIREBASE/AUTH
   =========================================================== */
vi.mock("firebase/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/auth")>();

  let currentUser: any = {
    uid: "test-uid",
    displayName: "Tester",
    email: "tester@example.com",
    photoURL: "",
  };

  const onAuthStateChanged = vi.fn((auth: any, cb: any) => {
    setTimeout(() => cb(currentUser), 0);
    return () => {};
  });

  const updateProfile = vi.fn(async (_user: any, data: any) => {
    currentUser = { ...currentUser, ...data };
  });

  const getAuth = vi.fn(() => ({}));

  return { ...actual, onAuthStateChanged, updateProfile, getAuth };
});

/* ===========================================================
   MOCK FIREBASE/FIRESTORE
   =========================================================== */
vi.mock("firebase/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/firestore")>();

  // Base de datos simulada
  const __db = {
    usuarios: new Map<string, any>(),
    equipos: new Map<string, any>(),
  };

  const makeDocSnap = (data: any = {}, id = "fake-id") => ({
    id,
    data: () => data,
    exists: () => Object.keys(data).length > 0,
  });

  const makeQuerySnap = (docs: any[]) => ({
    docs: docs.map((d, i) => ({
      id: d.id ?? `doc-${i}`,
      data: () => d,
    })),
  });

  const doc = vi.fn((_db: any, path: string, id: string) => ({
    __type: "doc",
    path: `${path}/${id}`,
    collection: path,
    id,
  }));

  const getDoc = vi.fn(async (ref: any) => {
    const col = ref.collection;
    const store = (col === "usuarios") ? __db.usuarios : __db.equipos;
    return makeDocSnap(store.get(ref.id) ?? {}, ref.id);
  });

  const setDoc = vi.fn(async (ref: any, data: any) => {
    const store = (ref.collection === "usuarios") ? __db.usuarios : __db.equipos;
    const prev = store.get(ref.id) ?? {};
    store.set(ref.id, { ...prev, ...data });
  });

  const serverTimestamp = vi.fn(() => new Date());

  const collection = vi.fn((_db: any, path: string) => ({ __type: "collection", path }));
  const where = vi.fn((f: string, op: string, v: any) => ({ __type: "where", f, op, v }));
  const query = vi.fn((...parts: any[]) => ({ __type: "query", parts }));

  const onSnapshot = vi.fn((refOrQuery: any, next: any) => {
    const cb = typeof next === "function" ? next : next?.next;
    if (!cb) return () => {};

    // simulamos datos vacíos
    if (refOrQuery?.__type === "query" || Array.isArray(refOrQuery?.parts)) {
      cb(makeQuerySnap([]));
    } else if (refOrQuery?.__type === "doc") {
      cb(makeDocSnap({}, refOrQuery.id));
    }
    return () => {};
  });

  (globalThis as any).__FAKE_DB__ = __db;

  return {
    ...actual,
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    collection,
    where,
    query,
    onSnapshot,
  };
});

/* ===========================================================
   MOCK ../firebase/client
   =========================================================== */
vi.mock("../firebase/client", () => {
  const auth = {};
  const db = {};
  return { auth, db };
});
