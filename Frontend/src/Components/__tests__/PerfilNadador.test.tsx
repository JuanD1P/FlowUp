import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

function renderWithRouter(ui: React.ReactNode, route = "/") {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

vi.mock("../DOCSS/PerfilNadador.css", () => ({}), { virtual: true });
vi.mock("../Components/ToastStack", () => ({
  default: ({ toasts }: any) => <div data-testid="toasts" data-count={toasts?.length || 0} />,
}));
vi.mock("@multiavatar/multiavatar", () => ({ default: () => "<svg />" }), { virtual: true });

const navigateSpy = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async (orig) => {
  const actual: any = await orig();
  return { ...actual, useNavigate: () => navigateSpy, MemoryRouter: actual.MemoryRouter };
});

vi.mock("../../firebase/client", () => ({ auth: {}, db: {} }));

const authMocks = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock("firebase/auth", () => authMocks);

const fsMocks = vi.hoisted(() => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 123),
}));
vi.mock("firebase/firestore", () => fsMocks);

import * as Client from "../../firebase/client";
import PerfilNadador from "../PerfilNadador";

beforeEach(() => {
  vi.clearAllMocks();
  navigateSpy.mockReset();
});

describe("PerfilNadador", () => {
  it("muestra 'Cargando' mientras resuelve auth", async () => {
    authMocks.onAuthStateChanged.mockImplementationOnce((_a: any, _cb: any) => () => {});
    renderWithRouter(<PerfilNadador />);
    expect(screen.getByText(/Cargando perfil/i)).toBeInTheDocument();
  });

  it("redirecciona a /userlogin si no hay usuario", async () => {
    authMocks.onAuthStateChanged.mockImplementationOnce((_a: any, cb: any) => {
      cb(null);
      return () => {};
    });
    renderWithRouter(<PerfilNadador />);
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/userlogin"));
  });

  it("pinta datos del perfil existente y badges", async () => {
    authMocks.onAuthStateChanged.mockImplementationOnce((_a: any, cb: any) => {
      cb({ uid: "u1", displayName: "Ana", email: "ana@x.com" });
      return () => {};
    });
    fsMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        nombre: "Ana",
        email: "ana@x.com",
        avatarSeed: "seed",
        nadador: { genero: "femenino", categoria: "medio", fechaNacimiento: "2000-01-01" },
      }),
    } as any);
    renderWithRouter(<PerfilNadador />);
    expect(await screen.findByText(/Perfil del Nadador/i)).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("ana@x.com")).toBeInTheDocument();
    expect(screen.getAllByText(/Género/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Categoría/i)[0]).toBeInTheDocument();
  });

  it("permite editar y guardar", async () => {
    authMocks.onAuthStateChanged.mockImplementationOnce((_a: any, cb: any) => {
      cb({ uid: "u1", displayName: "", email: "ana@x.com" });
      return () => {};
    });
    fsMocks.getDoc.mockResolvedValueOnce({ exists: () => false } as any);
    (Client as any).auth.currentUser = { uid: "u1", displayName: "" };
    renderWithRouter(<PerfilNadador />);
    await userEvent.click(await screen.findByRole("button", { name: /Editar/i }));
    await userEvent.clear(screen.getByRole("textbox", { name: /Nombre completo/i }));
    await userEvent.type(screen.getByRole("textbox", { name: /Nombre completo/i }), "Ana Gómez");
    await userEvent.click(screen.getByRole("button", { name: /Guardar/i }));
    await waitFor(() => {
      expect(authMocks.updateProfile).toHaveBeenCalled();
      expect(fsMocks.setDoc).toHaveBeenCalled();
    });
    expect(screen.getByText(/Perfil guardado correctamente/i)).toBeInTheDocument();
  });

  it("abre/cierra modal de avatares y muestra tiles", async () => {
    authMocks.onAuthStateChanged.mockImplementationOnce((_a: any, cb: any) => {
      cb({ uid: "u1", displayName: "Ana", email: "ana@x.com" });
      return () => {};
    });
    fsMocks.getDoc.mockResolvedValueOnce({ exists: () => false } as any);
    renderWithRouter(<PerfilNadador />);
    await userEvent.click(await screen.findByRole("button", { name: /Editar/i }));
    await userEvent.click(screen.getByRole("button", { name: /Cambiar avatar/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const tiles = await screen.findAllByRole("button", { name: /Seleccionar avatar/i });
    expect(tiles.length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /Cerrar/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
