// src/Components/__tests__/OceanAthletes.test.tsx
import React, { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** ========= FIXTURE =========
 *  Simula una tarjeta de atleta dentro de la página con fondo ocean-bg.
 *  No importa el CSS, solo la estructura y clases para poder testear.
 */
const AthCardFixture: React.FC<{
  name: string;
  email: string;
  rpe: number; // 0..100
  lastSessions: Array<{ date: string; label: string; rpe: number }>;
}> = ({ name, email, rpe, lastSessions }) => {
  const [loading, setLoading] = useState(false);
  return (
    <article className="ath-card ath-bubbles swim-float" data-testid="ath-card">
      <div className="ath-ribbon" />

      <header className="ath-header">
        <div className="ath-id">
          <div className="ath-avatar" aria-label="Avatar">A</div>
          <div className="ath-meta">
            <div className="ath-name" title={name}>{name}</div>
            <div className="ath-mail" title={email}>{email}</div>
          </div>
        </div>
        <button
          aria-label="Eliminar atleta"
          className={`ath-trashbtn ${loading ? "is-loading" : ""}`}
          onClick={() => setLoading(true)}
        >
          <i className="trash-ico" />
        </button>
      </header>

      <section className="ath-metrics" aria-label="Métricas">
        <div className="metric aqua">
          <div className="metric-label">Volumen</div>
          <div className="metric-value">2.4<span className="unit">km</span></div>
        </div>
        <div className="metric blue">
          <div className="metric-label">Sesiones</div>
          <div className="metric-value">4<span className="unit">/sem</span></div>
        </div>
        <div className="metric teal">
          <div className="metric-label">RPE</div>
          <div className="metric-value">
            6<span className="unit">/10</span>
          </div>
          <div className="rpe-bar">
            <div className="rpe-fill" style={{ width: `${rpe}%` }} />
          </div>
        </div>
      </section>

      <div className="ath-spark" aria-label="Mini sparkline">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="spark-bar" style={{ height: `${30 + i * 3}px` }} />
        ))}
        <span className="spark-caption">7d</span>
      </div>

      <section className="ath-last">
        <div className="ath-last-title">Últimas sesiones</div>
        {lastSessions.length ? (
          <div className="ath-chips">
            {lastSessions.map(s => (
              <div key={s.date} className="chip">
                <span className="chip-date">{s.date}</span>
                <span>{s.label}</span>
                <span className="chip-rpe">RPE {s.rpe}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="ath-empty">Sin sesiones recientes</div>
        )}
      </section>

      <section className="ath-spark2">
        <div className="spark-block">
          <div className="spark-title">Volumen (km)</div>
          <div className="spark-bars">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="spark-bar" style={{ height: `${20 + i * 5}px` }} />
            ))}
          </div>
        </div>
        <div className="spark-block">
          <div className="spark-title">Ritmo (s/100m)</div>
          <div className="spark-bars alt">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="spark-bar" style={{ height: `${25 + i * 4}px` }} />
            ))}
          </div>
        </div>
      </section>

      <section className="ath-session-list" aria-label="Historial">
        <div className="ath-session-card">
          <div className="as-head">
            <span className="badge agua">Piscina</span>
            <span className="as-date">2025-10-05</span>
            <span className="as-place">Complejo A</span>
          </div>
          <div className="as-grid">
            <div className="kv"><span>Distancia</span><strong>2000 m</strong></div>
            <div className="kv"><span>Ritmo</span><strong>2:05 /100m</strong></div>
            <div className="kv"><span>RPE</span><strong>6/10</strong></div>
          </div>
          <div className="as-notes">Trabajo de técnica y series cortas.</div>
          <details className="as-blocks">
            <summary>Bloques</summary>
            <ul>
              <li>4×50 c/1:10</li>
              <li className="muted">200 suave</li>
            </ul>
          </details>
        </div>
      </section>
    </article>
  );
};

const OceanPageFixture = () => (
  <div className="coach-page ocean-bg">
    <div className="ocean-container">
      <header className="pretty-head">
        <div>
          <h2>Atletas</h2>
          <p className="sub">Resumen general</p>
        </div>
      </header>

      <div className="pretty-grid">
        <AthCardFixture
          name="Ana Nadadora"
          email="ana@example.com"
          rpe={70}
          lastSessions={[
            { date: "10/01", label: "Piscina 1.8k", rpe: 6 },
            { date: "10/03", label: "Aguas abiertas 2.4k", rpe: 7 },
          ]}
        />
      </div>
    </div>
  </div>
);

/** ========= TESTS ========= */

describe("Ocean athletes view (estructura base)", () => {
  it("renderiza el fondo ocean-bg y el header bonito", () => {
    render(<OceanPageFixture />);
    const page = document.querySelector(".coach-page.ocean-bg") as HTMLElement;
    expect(page).toBeInTheDocument();

    const head = page.querySelector(".pretty-head")!;
    expect(within(head).getByRole("heading", { level: 2 })).toHaveTextContent("Atletas");
    expect(within(head).getByText(/resumen general/i)).toBeInTheDocument();
  });

  it("muestra al menos una ath-card con avatar, nombre y email", () => {
    render(<OceanPageFixture />);
    const card = screen.getByTestId("ath-card");
    expect(card).toBeInTheDocument();

    expect(within(card).getByLabelText("Avatar")).toBeInTheDocument();
    expect(within(card).getByText("Ana Nadadora")).toHaveClass("ath-name");
    expect(within(card).getByText("ana@example.com")).toHaveClass("ath-mail");
  });
});

describe("Métricas y barras (RPE / spark)", () => {
  it("tiene sección de métricas con 3 items y unidad en el valor", () => {
    render(<OceanPageFixture />);
    const metrics = screen.getByLabelText("Métricas");
    const items = metrics.querySelectorAll(".metric");
    expect(items.length).toBeGreaterThanOrEqual(3);

    const firstValue = metrics.querySelector(".metric-value")!;
    expect(firstValue.querySelector(".unit")).toBeInTheDocument();
  });

  it("la barra de RPE incluye .rpe-fill con width acorde al valor", () => {
    render(<OceanPageFixture />);
    const fill = document.querySelector(".rpe-fill") as HTMLElement;
    // del fixture: rpe=70 => style width: 70%
    expect(fill).toBeInTheDocument();
    expect(fill.getAttribute("style")).toMatch(/width:\s*70%/i);
  });

  it("renderiza spark bars y la leyenda 7d", () => {
    render(<OceanPageFixture />);
    const spark = screen.getByLabelText("Mini sparkline");
    const bars = spark.querySelectorAll(".spark-bar");
    expect(bars.length).toBeGreaterThan(5);
    expect(within(spark).getByText("7d")).toBeInTheDocument();
  });
});

describe("Últimas sesiones, lista y bloques", () => {
  it("muestra chips de últimas sesiones con fecha y RPE", () => {
    render(<OceanPageFixture />);
    const chips = document.querySelectorAll(".ath-chips .chip");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0].querySelector(".chip-date")).toBeInTheDocument();
    expect(chips[0].querySelector(".chip-rpe")).toBeInTheDocument();
  });

  it("renderiza una tarjeta de historial con badge, grid de kv y notas", () => {
    render(<OceanPageFixture />);
    const card = document.querySelector(".ath-session-card") as HTMLElement;
    expect(card).toBeInTheDocument();
    expect(card.querySelector(".badge")).toBeInTheDocument();

    const kvs = card.querySelectorAll(".as-grid .kv");
    expect(kvs.length).toBeGreaterThanOrEqual(3);

    expect(card.querySelector(".as-notes")?.textContent).toMatch(/técnica/i);
  });

  it("incluye sección de bloques con <details> y <summary>", () => {
    render(<OceanPageFixture />);
    const details = document.querySelector(".as-blocks") as HTMLElement;
    expect(details).toBeInTheDocument();
    expect(details.querySelector("summary")).toHaveTextContent(/bloques/i);
    expect(details.querySelectorAll("ul li").length).toBeGreaterThan(0);
  });
});

describe("Acciones", () => {
  it("el botón de eliminar tiene icono y puede entrar en estado is-loading", async () => {
    render(<OceanPageFixture />);
    const btn = screen.getByRole("button", { name: /eliminar atleta/i });
    expect(btn.querySelector(".trash-ico")).toBeInTheDocument();

    await userEvent.click(btn);
    expect(btn).toHaveClass("is-loading");
  });
});
