// src/Components/__tests__/Recomendaciones.test.tsx
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

// ⏱️ Fijamos Date.now SIN fake timers (evita bloquear microtasks)
const FIXED_NOW = new Date("2025-03-01T12:00:00Z").getTime();
let nowSpy: ReturnType<typeof vi.spyOn>;

// ---- Mocks ANTES de importar el componente ----
vi.mock("../../firebase/client", () => ({ auth: {}, db: {} }));
vi.mock("../DOCSS/Recomendaciones.css", () => ({}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn((_auth, cb: any) => {
    setTimeout(() => {
      cb({ uid: "u1", displayName: "Laura", email: "laura@x.com" });
    }, 0);
    return () => {};
  }),
}));

let mockUserDoc: any;
let mockTrainings: any[];

vi.mock("firebase/firestore", () => {
  return {
    doc: vi.fn(),
    collection: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    query: vi.fn(),
    getDoc: vi.fn(async () => ({
      exists: () => true,
      data: () => mockUserDoc,
    })),
    onSnapshot: vi.fn((_q: any, next: any) => {
      setTimeout(() => {
        const docs = mockTrainings.map((t, i) => ({
          id: `t${i + 1}`,
          data: () => t,
        }));
        next({ docs });
      }, 0);
      return () => {};
    }),
  };
});

// IMPORTAMOS el componente DESPUÉS de definir todos los mocks
let Recomendaciones: React.ComponentType;

beforeEach(async () => {
  cleanup();

  nowSpy = vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);

  // Perfil por defecto
  mockUserDoc = {
    nombre: "Laura",
    nadador: {
      fechaNacimiento: "2005-01-02",
      genero: "femenino",
      alturaCm: 150,
      pesoKg: 50,
      fcReposo: 60,
      categoria: "altorendimiento",
      objetivoGeneral: "mejorar resistencia",
      condicionesMedicas: "lesión de hombro leve",
      fotoURL: "",
      avatarSeed: "seed",
    },
  };

  const DAY = 86400000;
  mockTrainings = [
    {
      startMs: FIXED_NOW - 2 * DAY,
      tipo: "agua",
      rpe: 6,
      fatiga: "Alta",
      duracionMin: 60,
      distanciaTotal: 1600,
    },
    {
      startMs: FIXED_NOW - 9 * DAY,
      tipo: "agua",
      rpe: 5,
      fatiga: "Media",
      duracionMin: 45,
      distanciaTotal: 1200,
    },
  ];

  Recomendaciones = (await import("../Recomendaciones")).default;
});

afterAll(() => {
  nowSpy?.mockRestore();
});

// ======================== TESTS ========================
describe("<Recomendaciones />", () => {
  it("muestra cabecera con nombre, objetivo y métricas base", async () => {
    render(<Recomendaciones />);

    // 👇 Usamos el H1 para evitar el conflicto con el H2 del bloque
    const h1 = await screen.findByRole("heading", {
      level: 1,
      name: /Recomendaciones personalizadas/i,
    });
    expect(h1).toBeInTheDocument();

    expect(screen.getByText(/Laura/i)).toBeInTheDocument();
    expect(screen.getByText(/Objetivo:\s*mejorar resistencia/i)).toBeInTheDocument();

    expect(screen.getByText(/Volumen 7d/i)).toBeInTheDocument();
    expect(screen.getByText(/RPE prom \(10\)/i, { selector: 'span' })).toBeInTheDocument();

    expect(screen.getByText(/50 kg/)).toBeInTheDocument();
    expect(screen.getByText(/1500 ml/)).toBeInTheDocument();        // 50*30
    expect(screen.getByText(/70–90 g\/día/i)).toBeInTheDocument();  // 1.4–1.8 g/kg
    expect(screen.getByText(/150 mg/i)).toBeInTheDocument();        // 3 mg/kg
  });

  it("incluye recomendaciones PERSONALIZADAS por lesión de hombro", async () => {
    render(<Recomendaciones />);
    expect(await screen.findByText(/Cuida tus hombros/i)).toBeInTheDocument();
  });

  it("incluye recomendaciones GENERALES por sesión exigente (pre-CHO)", async () => {
    render(<Recomendaciones />);
    expect(await screen.findByText(/Carga de carbohidratos previa/i)).toBeInTheDocument();
  });

  it("oculta la fila de cafeína si hay hipertensión", async () => {
    mockUserDoc = {
      ...mockUserDoc,
      nadador: {
        ...mockUserDoc.nadador,
        condicionesMedicas: "hipertensión controlada",
      },
    };

    render(<Recomendaciones />);
    await screen.findByText(/Tu línea base/i);
    expect(screen.queryByText(/Cafeína \(opcional\)/i)).not.toBeInTheDocument();
  });

  it("renderiza tarjetas sin dejar huecos y el sello no solapa texto", async () => {
    render(<Recomendaciones />);

    await waitFor(() => {
      expect(
        screen.getAllByRole("heading", { name: /pre|carga|colación|meal|cuida|técnica/i }).length
      ).toBeGreaterThan(0);
    });

    expect(
      screen.getAllByText(/Agua|Snack|Plan|Hidratación|Cafeína|Técnica/i).length
    ).toBeGreaterThan(0);
  });
});
