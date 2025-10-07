// src/Components/__tests__/AñadirNadadores.test.tsx
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AñadirNadadores from "../AñadirNadadores";

/* ================== Mocks básicos ================== */

// CSS
vi.mock("../DOCSS/AñadirNadadores.css", () => ({}), { virtual: true });

// ToastStack: render mínimo
vi.mock("../ToastStack", () => ({
  __esModule: true,
  default: ({ toasts }: any) => (
    <div data-testid="toaststack">
      {toasts?.map((t: any) => (
        <div key={t.id} data-testid={`toast-${t.variant}`}>
          {t.title}: {t.message}
        </div>
      ))}
    </div>
  ),
}));

// Router: navegador espía
const navigateSpy = vi.fn();
vi.mock("react-router-dom", async (orig) => {
  const actual: any = await orig();
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

// firebase/client
vi.mock("../../firebase/client", () => ({
  auth: { currentUser: { uid: "coach1" } },
  db: {},
}));

/* ================== Firestore mock ================== */

const onSnapshotMock = vi.fn();
const getDocMock = vi.fn();
const getDocsMock = vi.fn();
const writeBatchMock = vi.fn();
const updateDocMock = vi.fn();
const collectionMock = vi.fn();
const queryMock = vi.fn();
const whereMock = vi.fn();
const docMock = vi.fn();
const serverTimestampMock = vi.fn(() => 123456789);
const incrementMock = vi.fn((n) => ({ __inc: n }));
const arrayUnionMock = vi.fn((...vals) => ({ __union: vals }));

// Representamos referencias por una string path legible
const mkRef = (...parts: string[]) => ({ __path: parts.join("/") });

vi.mock("firebase/firestore", () => ({
  onSnapshot: (...a: any[]) => onSnapshotMock(...a),
  getDoc: (...a: any[]) => getDocMock(...a),
  getDocs: (...a: any[]) => getDocsMock(...a),
  writeBatch: (...a: any[]) => writeBatchMock(...a),
  updateDoc: (...a: any[]) => updateDocMock(...a),
  collection: (...a: any[]) => collectionMock(...a),
  query: (...a: any[]) => queryMock(...a),
  where: (...a: any[]) => whereMock(...a),
  doc: (...a: any[]) => docMock(...a),
  serverTimestamp: () => serverTimestampMock(),
  increment: (n: number) => incrementMock(n),
  arrayUnion: (...vals: any[]) => arrayUnionMock(...vals),
}));

/* ================== Helpers de render ================== */

function renderWithRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<AñadirNadadores />} />
      </Routes>
    </MemoryRouter>
  );
}

/* ================== State por test ================== */

beforeEach(() => {
  vi.clearAllMocks();
  navigateSpy.mockClear();

  // onSnapshot => devuelve 3 usuarios (Ana, Bruno, Carla)
  onSnapshotMock.mockImplementation((_q: any, cb: any) => {
    const docs = [
      { id: "u1", data: () => ({ uid: "u1", nombre: "Ana",   email: "ana@x.com",   rol: "USER" }) },
      { id: "u2", data: () => ({ uid: "u2", nombre: "Bruno", email: "bruno@x.com", rol: "USER" }) },
      { id: "u3", data: () => ({ uid: "u3", nombre: "Carla", email: "carla@x.com", rol: "USER" }) },
    ];
    cb({ docs });
    return vi.fn(); // unsubscribe
  });

  // collection/query/where/doc mocks “pasivos”
  collectionMock.mockImplementation((_db, ...parts) => mkRef(...parts));
  queryMock.mockImplementation((ref) => ({ __queryOf: ref }));
  whereMock.mockImplementation(() => ({}));
  docMock.mockImplementation((_db, ...parts) => mkRef(...parts));

  // writeBatch: objeto con set/update/commit
  writeBatchMock.mockImplementation(() => {
    const ops: any[] = [];
    return {
      set: vi.fn((ref, data) => ops.push({ type: "set", ref, data })),
      update: vi.fn((ref, data) => ops.push({ type: "update", ref, data })),
      commit: vi.fn(async () => ops.length),
    };
  });

  getDocsMock.mockResolvedValue({ docs: [] });
  updateDocMock.mockResolvedValue(undefined);
});

/* ================== TESTS ================== */

describe("AñadirNadadores — carga y cabecera", () => {
  it("muestra el contador con la cantidad tras escribir en el buscador", async () => {
    renderWithRoute("/?equipo=E1");

    const input = await screen.findByPlaceholderText(/buscar por nombre/i);
    await userEvent.type(input, "a"); // activa la búsqueda

    // espera el texto (ej: "(2 coincidencias)" o "(3 encontrados)")
    const counter = await screen.findByText(/\(\d+\s+(encontrados|coincidencias)\)/i);
    expect(counter).toBeInTheDocument();

    // extrae el número y valida que haya al menos 1 coincidencia
    const match = counter.textContent?.match(/\((\d+)/);
    expect(Number(match?.[1])).toBeGreaterThan(0);

    expect(screen.getByRole("heading", { name: /Añadir Nadadores/i })).toBeInTheDocument();
  });
});

describe("AñadirNadadores — estado sin equipo", () => {
  it("si no hay ?equipo, muestra card de 'Falta el equipo' y deshabilita botones Añadir", async () => {
    renderWithRoute("/");

    await screen.findByRole("heading", { name: /Falta el equipo/i });

    const addButtons = screen.queryAllByRole("button", { name: /añadir/i });
    addButtons.forEach((b) => expect(b).toBeDisabled());

    expect(screen.queryByText(/\(\d+\s+(encontrados|coincidencias)\)/i)).not.toBeInTheDocument();
  });
});

describe("AñadirNadadores — filtro", () => {
  it("filtra por nombre/email", async () => {
    renderWithRoute("/?equipo=E1");

    const input = await screen.findByPlaceholderText(/buscar por nombre/i);
    await userEvent.type(input, "bruno");

    expect(await screen.findByText("Bruno")).toBeInTheDocument();
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
  });
});

describe("AñadirNadadores — flujo de añadir", () => {
  it("añade al equipo cuando owner es el coach y el miembro no existe; hace commit y navega", async () => {
    renderWithRoute("/?equipo=E1");

    const input = await screen.findByPlaceholderText(/buscar por nombre/i);
    await userEvent.type(input, "ana");

    getDocMock.mockImplementation(async (ref: any) => {
      if (ref.__path === "equipos/E1") {
        return { exists: () => true, data: () => ({ ownerId: "coach1" }) };
      }
      if (ref.__path === "equipos/E1/nadadores/u1") {
        return { exists: () => false, data: () => ({}) };
      }
      return { exists: () => false, data: () => ({}) };
    });

    const card = (await screen.findByText("Ana")).closest(".swimmer-card")!;
    const addBtn = within(card).getByRole("button", { name: /añadir/i });
    expect(addBtn).toBeEnabled();

    await userEvent.click(addBtn);

    await waitFor(() => {
      expect(writeBatchMock).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith("/VerEquipo?equipo=E1");
    });
  });

  it("si el nadador ya es miembro, muestra toast informativo y navega", async () => {
    renderWithRoute("/?equipo=E1");

    const input = await screen.findByPlaceholderText(/buscar por nombre/i);
    await userEvent.type(input, "bruno");

    getDocMock.mockImplementation(async (ref: any) => {
      if (ref.__path === "equipos/E1") {
        return { exists: () => true, data: () => ({ ownerId: "coach1" }) };
      }
      if (ref.__path === "equipos/E1/nadadores/u2") {
        return { exists: () => true, data: () => ({ uid: "u2" }) };
      }
      return { exists: () => false, data: () => ({}) };
    });

    const card = (await screen.findByText("Bruno")).closest(".swimmer-card")!;
    const addBtn = within(card).getByRole("button", { name: /añadir/i });
    await userEvent.click(addBtn);

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith("/VerEquipo?equipo=E1");
    });

    const toastContainer = screen.getByTestId("toaststack");
    expect(within(toastContainer).queryAllByTestId(/toast-info/).length).toBeGreaterThanOrEqual(0);
  });

  it("bloquea si el ownerId del equipo no coincide con el coach", async () => {
    renderWithRoute("/?equipo=E1");

    const input = await screen.findByPlaceholderText(/buscar por nombre/i);
    await userEvent.type(input, "ana");

    getDocMock.mockImplementation(async (ref: any) => {
      if (ref.__path === "equipos/E1") {
        return { exists: () => true, data: () => ({ ownerId: "otro-coach" }) };
      }
      return { exists: () => false, data: () => ({}) };
    });

    const card = (await screen.findByText("Ana")).closest(".swimmer-card")!;
    const addBtn = within(card).getByRole("button", { name: /añadir/i });
    await userEvent.click(addBtn);

    await waitFor(() => {
      expect(navigateSpy).not.toHaveBeenCalled();
    });
    expect(writeBatchMock).not.toHaveBeenCalled();
  });
});
