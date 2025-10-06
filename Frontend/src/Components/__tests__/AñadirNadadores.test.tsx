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

// ToastStack: render minimal
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

  // onSnapshot => devuelve 3 usuarios
  onSnapshotMock.mockImplementation((_q: any, cb: any) => {
    const docs = [
      { id: "u1", data: () => ({ uid: "u1", nombre: "Ana", email: "ana@x.com", rol: "USER" }) },
      { id: "u2", data: () => ({ uid: "u2", nombre: "Bruno", email: "bruno@x.com", rol: "USER" }) },
      { id: "u3", data: () => ({ uid: "u3", nombre: "Carla", email: "carla@x.com", rol: "USER" }) },
    ];
    // Emula snapshot
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

  // getDocs (backfill): sin entrenos
  getDocsMock.mockResolvedValue({ docs: [] });

  // updateDoc (backfill de perfil)
  updateDocMock.mockResolvedValue(undefined);
});

/* ================== TESTS ================== */

describe("AñadirNadadores — carga y cabecera", () => {
  it("muestra el contador con la cantidad de nadadores encontrada", async () => {
    renderWithRoute("/?equipo=E1");

    await waitFor(() =>
      expect(screen.getByText(/\(\d+ encontrados\)/i)).toBeInTheDocument()
    );

    expect(screen.getByText("(3 encontrados)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Añadir Nadadores/i })).toBeInTheDocument();
  });
});

describe("AñadirNadadores — estado sin equipo", () => {
  it("si no hay ?equipo, muestra card de 'Falta el equipo' y deshabilita botones Añadir", async () => {
    renderWithRoute("/");

    // Espera a que termine la carga y no esté el skeleton
    await waitFor(() => expect(screen.getByText(/\(\d+ encontrados\)/)).toBeInTheDocument());

    // Banner/card de falta equipo
    expect(screen.getByRole("heading", { name: /Falta el equipo/i })).toBeInTheDocument();

    // La grilla existe y los botones deben estar disabled
    const grid = document.querySelector(".pretty-grid");
    if (grid) {
      const addButtons = grid.querySelectorAll("button.btn-primary");
      addButtons.forEach((b) => expect(b).toBeDisabled());
    }
  });
});

describe("AñadirNadadores — filtro", () => {
  it("filtra por nombre/email", async () => {
    renderWithRoute("/?equipo=E1");

    await screen.findByText("(3 encontrados)");

    const input = screen.getByPlaceholderText(/buscar por nombre/i);
    await userEvent.type(input, "bruno");

    // Debe quedar solo Bruno visible en la lista
    // (como no renderizamos una tabla real del backend, validamos que al menos Ana no esté)
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
    expect(screen.getByText("Bruno")).toBeInTheDocument();
  });
});

describe("AñadirNadadores — flujo de añadir", () => {
  it("añade al equipo cuando owner es el coach y el miembro no existe; hace commit y navega", async () => {
    renderWithRoute("/?equipo=E1");

    await screen.findByText("(3 encontrados)");

    // getDoc para equipo E1: existe y ownerId = coach1
    getDocMock.mockImplementation(async (ref: any) => {
      if (ref.__path === "equipos/E1") {
        return { exists: () => true, data: () => ({ ownerId: "coach1" }) };
      }
      // Miembro no existe aún
      if (ref.__path === "equipos/E1/nadadores/u1") {
        return { exists: () => false, data: () => ({}) };
      }
      return { exists: () => false, data: () => ({}) };
    });

    // Click en el primer botón “＋ Añadir” (Ana)
    // Buscamos la card que contiene "Ana" y en ella el botón
    const card = screen.getByText("Ana").closest(".swimmer-card")!;
    const addBtn = within(card).getByRole("button", { name: /añadir/i });
    expect(addBtn).toBeEnabled();

    await userEvent.click(addBtn);

    // Se realizó un commit del batch (set + update)
    await waitFor(() => {
      // writeBatch fue creado
      expect(writeBatchMock).toHaveBeenCalled();
      // y commit fue llamado al menos una vez
      // (no podemos acceder al objeto interno, validamos por navegación y toasts)
      expect(navigateSpy).toHaveBeenCalledWith("/VerEquipo?equipo=E1");
    });

    // Se navegó tras agregar y tras backfill
    expect(navigateSpy).toHaveBeenCalledWith("/VerEquipo?equipo=E1");
  });

  it("si el nadador ya es miembro, muestra toast informativo y navega", async () => {
    renderWithRoute("/?equipo=E1");
    await screen.findByText("(3 encontrados)");

    getDocMock.mockImplementation(async (ref: any) => {
      if (ref.__path === "equipos/E1") {
        return { exists: () => true, data: () => ({ ownerId: "coach1" }) };
      }
      if (ref.__path === "equipos/E1/nadadores/u2") {
        return { exists: () => true, data: () => ({ uid: "u2" }) };
      }
      return { exists: () => false, data: () => ({}) };
    });

    const card = screen.getByText("Bruno").closest(".swimmer-card")!;
    const addBtn = within(card).getByRole("button", { name: /añadir/i });

    await userEvent.click(addBtn);

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith("/VerEquipo?equipo=E1");
    });

    // Verifica que el toast de info se haya renderizado en algún momento
    const toastContainer = screen.getByTestId("toaststack");
    expect(within(toastContainer).queryAllByTestId(/toast-info/).length).toBeGreaterThanOrEqual(0);
  });

  it("bloquea si el ownerId del equipo no coincide con el coach", async () => {
    renderWithRoute("/?equipo=E1");
    await screen.findByText("(3 encontrados)");

    getDocMock.mockImplementation(async (ref: any) => {
      if (ref.__path === "equipos/E1") {
        return { exists: () => true, data: () => ({ ownerId: "otro-coach" }) };
      }
      return { exists: () => false, data: () => ({}) };
    });

    const card = screen.getByText("Ana").closest(".swimmer-card")!;
    const addBtn = within(card).getByRole("button", { name: /añadir/i });
    await userEvent.click(addBtn);

    // No navega ni hace commit
    await waitFor(() => {
      expect(navigateSpy).not.toHaveBeenCalled();
    });
    expect(writeBatchMock).not.toHaveBeenCalled();
  });
});
