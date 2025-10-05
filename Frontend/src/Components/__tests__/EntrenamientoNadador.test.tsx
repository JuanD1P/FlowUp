// src/Components/__tests__/EntrenamientoNadador.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EntrenamientoNadador from "../EntrenamientoNadador";
import { renderWithRouter } from "./test-utils";

vi.mock("../DOCSS/EntrenamientoNadador.css", () => ({}), { virtual: true });

// Router
vi.mock("react-router-dom", async (orig) => {
  const actual: any = await orig();
  return { ...actual, useNavigate: () => vi.fn() };
});

// firebase/client
vi.mock("../../firebase/client", () => ({ auth: {}, db: {} }));

// Auth
const onAuthStateChanged = vi.fn();
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (...a: any[]) => onAuthStateChanged(...a),
}));

// Firestore
const addDoc = vi.fn();
const collection = vi.fn();
const onSnapshot = vi.fn();
const query = vi.fn();
const orderBy = vi.fn();
vi.mock("firebase/firestore", () => ({
  addDoc: (...a: any[]) => addDoc(...a),
  collection: (...a: any[]) => collection(...a),
  onSnapshot: (...a: any[]) => onSnapshot(...a),
  orderBy: (...a: any[]) => orderBy(...a),
  query: (...a: any[]) => query(...a),
  serverTimestamp: () => 111,
}));

// jsPDF (import dinámico)
vi.mock("jspdf", () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
    setFont: () => ({ setFontSize: () => ({ setTextColor: () => ({}) }) }),
    setFontSize: () => ({ setTextColor: () => ({}) }),
    setTextColor: () => ({}),
    text: () => {},
    setDrawColor: () => ({}),
    setFillColor: () => ({}),
    roundedRect: () => ({}),
    line: () => ({}),
    splitTextToSize: (t: string) => [t],
    addPage: () => ({}),
    save: () => ({}),
    internalScaleFactor: 1,
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Simula usuario autenticado + colección vacía
  onAuthStateChanged.mockImplementation((_a: any, cb: any) => {
    cb({ uid: "u1" });
    return () => {};
  });
  onSnapshot.mockImplementation((_q: any, cb: any) => {
    cb({ docs: [] });
    return vi.fn();
  });
});

describe("EntrenamientoNadador", () => {
  it("valida hora fin > hora inicio", async () => {
    renderWithRouter(<EntrenamientoNadador />);

    // Forzar hora fin < inicio
    await userEvent.clear(screen.getByLabelText(/Hora inicio/i));
    await userEvent.type(screen.getByLabelText(/Hora inicio/i), "10:00");
    await userEvent.clear(screen.getByLabelText(/Hora fin/i));
    await userEvent.type(screen.getByLabelText(/Hora fin/i), "09:00");

    await userEvent.click(screen.getByRole("button", { name: /Guardar sesión/i }));

    expect(await screen.findByText(/La hora fin debe ser mayor/i)).toBeInTheDocument();
  });

  it("calcula distancia total y ritmo medio en natación", async () => {
    renderWithRouter(<EntrenamientoNadador />);

    // Bloque por defecto: 1 × 100
    // Añadimos otro bloque 2×50 (=100) y minutos para ritmo
    await userEvent.click(screen.getByRole("button", { name: /\+ Añadir estilo/i }));
    const seriesInputs = screen.getAllByRole("spinbutton", { name: /Series/i });
    const metrosInputs = screen.getAllByRole("spinbutton", { name: /Metros por serie/i });
    const minutosInputs = screen.getAllByRole("spinbutton", { name: /Minutos \(opcional\)/i });

    await userEvent.clear(seriesInputs[1]);
    await userEvent.type(seriesInputs[1], "2");
    await userEvent.clear(metrosInputs[1]);
    await userEvent.type(metrosInputs[1], "50");
    await userEvent.type(minutosInputs[0], "10"); // 10 min para 100 m => 10:00 /100m

    // Distancia total: 100 (bloque1) + 100 (bloque2) = 200 m
    expect(await screen.findByText(/200 m/i)).toBeInTheDocument();
    // Ritmo medio (sobre duración de toda la sesión si se llenara — aquí comprobamos que muestra formato)
    expect(screen.getAllByText(/\/100m/i).length).toBeGreaterThan(0);
  });

  it("guarda sesión (addDoc) cuando los datos son válidos", async () => {
    renderWithRouter(<EntrenamientoNadador />);

    // Dejalo en natación, con bloque por defecto (100 m) y horas válidas
    await userEvent.clear(screen.getByLabelText(/Hora inicio/i));
    await userEvent.type(screen.getByLabelText(/Hora inicio/i), "09:00");
    await userEvent.clear(screen.getByLabelText(/Hora fin/i));
    await userEvent.type(screen.getByLabelText(/Hora fin/i), "10:00");

    await userEvent.click(screen.getByRole("button", { name: /Guardar sesión/i }));

    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    expect(screen.getByText(/Sesión guardada/i)).toBeInTheDocument();
  });

  it("deshabilita Exportar PDF si no hay historial", async () => {
  renderWithRouter(<EntrenamientoNadador />);
  const btn = await screen.findByRole("button", { name: /Exportar PDF/i });
  expect(btn).toBeDisabled();
});

});
