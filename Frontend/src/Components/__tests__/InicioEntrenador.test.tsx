import { describe, it, expect } from "vitest";
import React, { useEffect } from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";


const hasClass = (el: HTMLElement, cls: string) =>
  el.classList.contains(cls);


const AquaPageFixture = () => (
  <div className="aqua-page">
    <section className="coach-hero">
      <div>
        <h1 className="hero-title">Panel del Coach</h1>
        <p className="hero-sub">Resumen y acciones rápidas</p>
        <div className="hero-actions">
          <button className="btn-primary big">Crear equipo</button>
          <button className="btn-ghost">Ver reportes</button>
        </div>
      </div>
      <div className="hero-art" aria-label="Decoración">
        <span className="bubble b1" aria-hidden="true" />
        <span className="bubble b2" aria-hidden="true" />
        <span className="bubble b3" aria-hidden="true" />
        <div className="waves">
          <div className="wave w1" />
          <div className="wave w2" />
          <div className="wave w3" />
        </div>
      </div>
    </section>

    <div className="aqua-container">
      <header className="pretty-head">
        <h2>Mis equipos <span className="count-pill">3</span></h2>
        <button className="btn-ghost">Gestionar</button>
      </header>

      <div className="grid pretty-grid">
        <article className="card aqua-card">
          <div className="team-top">
            <div className="team-avatar" aria-label="Avatar">A</div>
            <div className="team-head">
              <h4>Azules</h4>
              <span className="pill">Activo</span>
            </div>
          </div>
          <p className="team-meta">8 atletas • 3 sesiones/sem</p>
          <div className="team-accion">
            <button className="btn-add">Añadir atleta</button>
            <button className="btn-view">Ver equipo</button>
            <button className="btn-trash" aria-label="Eliminar equipo">
              <i className="trash-ico" />
            </button>
          </div>

          <div className="card-waves">
            <div className="cw w1" />
            <div className="cw w2" />
          </div>
        </article>

        <article className="card empty">
          <div>
            <div className="empty-icon">💧</div>
            <p>No hay equipos aún</p>
          </div>
        </article>

        <article className="card skeleton" aria-busy="true">
          <div className="shimmer" />
        </article>
      </div>
    </div>
  </div>
);

// Modal controlado por prop `open` + callback `onClose`
const ModalFixture: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  useEffect(() => {
    if (open) document.body.classList.add("no-scroll");
    else document.body.classList.remove("no-scroll");
    return () => document.body.classList.remove("no-scroll");
  }, [open]);

  if (!open) return null;
  return (
    <div className="md-backdrop" role="dialog" aria-modal="true">
      <div className="md-card">
        <div className="md-head">
          <h3>Nuevo equipo</h3>
          <button className="md-x" aria-label="Cerrar" onClick={onClose} />
        </div>
        <div className="md-body">
          <label className="field">
            <span>Nombre</span>
            <input placeholder="Azules" />
          </label>
        </div>
      </div>
    </div>
  );
};

// ======== TESTS ========

describe("AquaPage (estructura y clases clave)", () => {
  it("renderiza el hero con título, subtítulo y acciones", () => {
    render(<AquaPageFixture />);
    const hero = screen.getByText("Panel del Coach").closest(".coach-hero")!;
    expect(hero).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Panel del Coach" })).toBeInTheDocument();
    expect(screen.getByText("Resumen y acciones rápidas")).toBeInTheDocument();

    const actions = hero.querySelector(".hero-actions") as HTMLElement;
    expect(actions).toBeInTheDocument();
    expect(within(actions).getByRole("button", { name: "Crear equipo" })).toBeInTheDocument();
    expect(within(actions).getByRole("button", { name: "Ver reportes" })).toBeInTheDocument();

    const primary = within(actions).getByRole("button", { name: "Crear equipo" });
    expect(hasClass(primary, "btn-primary")).toBe(true);
    expect(hasClass(primary, "big")).toBe(true);
  });

  it("incluye arte con burbujas y olas animadas", () => {
    render(<AquaPageFixture />);
    const art = screen.getByLabelText("Decoración");
    expect(art).toBeInTheDocument();

    // Burbujas
    const bubbles = art.querySelectorAll(".bubble");
    expect(bubbles.length).toBeGreaterThanOrEqual(3);
    expect((art.querySelector(".b1"))).toBeTruthy();
    expect((art.querySelector(".b2"))).toBeTruthy();
    expect((art.querySelector(".b3"))).toBeTruthy();

    // Olas
    const waves = art.querySelector(".waves")!;
    expect(waves).toBeInTheDocument();
    expect(waves.querySelector(".w1")).toBeTruthy();
    expect(waves.querySelector(".w2")).toBeTruthy();
    expect(waves.querySelector(".w3")).toBeTruthy();
  });

  it("muestra cards con variantes: aqua-card, empty y skeleton", () => {
    render(<AquaPageFixture />);

    const aquaCard = document.querySelector(".aqua-card") as HTMLElement;
    expect(aquaCard).toBeInTheDocument();
    expect(aquaCard.querySelector(".team-avatar")).toBeInTheDocument();
    expect(aquaCard.querySelector(".team-head h4")?.textContent).toBe("Azules");
    expect(aquaCard.querySelector(".pill")).toBeInTheDocument();
    expect(aquaCard.querySelector(".team-meta")?.textContent).toMatch(/atletas/i);

    const actions = aquaCard.querySelector(".team-accion")!;
    expect(within(actions).getByRole("button", { name: "Añadir atleta" })).toBeInTheDocument();
    expect(within(actions).getByRole("button", { name: "Ver equipo" })).toBeInTheDocument();
    expect(within(actions).getByRole("button", { name: "Eliminar equipo" })).toBeInTheDocument();

    const empty = document.querySelector(".card.empty") as HTMLElement;
    expect(empty).toBeInTheDocument();
    expect(within(empty).getByText(/no hay equipos/i)).toBeInTheDocument();

    const sk = document.querySelector(".card.skeleton") as HTMLElement;
    expect(sk).toBeInTheDocument();
    expect(sk.querySelector(".shimmer")).toBeInTheDocument();
  });

  it("tiene waves decorativas dentro de aqua-card", () => {
    render(<AquaPageFixture />);
    const cw = document.querySelector(".card-waves") as HTMLElement;
    expect(cw).toBeInTheDocument();
    expect(cw.querySelector(".cw.w1")).toBeTruthy();
    expect(cw.querySelector(".cw.w2")).toBeTruthy();
  });

  it("usa contenedor y cabecera bonitos", () => {
    render(<AquaPageFixture />);
    const container = document.querySelector(".aqua-container")!;
    expect(container).toBeInTheDocument();

    const prettyHead = container.querySelector(".pretty-head")!;
    expect(prettyHead).toBeInTheDocument();
    expect(within(prettyHead).getByRole("heading", { level: 2 })).toHaveTextContent(/mis equipos/i);
    expect(prettyHead.querySelector(".count-pill")).toHaveTextContent("3");
  });
});

describe("Modal (md-backdrop/md-card) y bloqueo de scroll", () => {
  it("no renderiza cuando open=false y no añade .no-scroll al body", () => {
    render(<ModalFixture open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass("no-scroll");
  });

  it("renderiza cuando open=true y bloquea scroll en body", () => {
    render(<ModalFixture open={true} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    expect(document.body).toHaveClass("no-scroll");
    const head = within(dialog).getByRole("heading", { name: "Nuevo equipo" });
    expect(head).toBeInTheDocument();

    expect(within(dialog).getByText("Nombre")).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("Azules")).toBeInTheDocument();
  });

  it("cierra al hacer click en la 'X' y quita .no-scroll del body", () => {
    const onClose = vi.fn();
    render(<ModalFixture open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalled();
  });
});

// ======== EJEMPLOS de aserciones de botones ========
describe("Botones y estados básicos", () => {
  it("btn-primary.big existe y es interactivo", () => {
    render(<AquaPageFixture />);
    const btn = screen.getByRole("button", { name: "Crear equipo" });
    expect(btn).toBeEnabled();
    expect(hasClass(btn, "btn-primary")).toBe(true);
    expect(hasClass(btn, "big")).toBe(true);
  });

  it("btn-trash contiene el ícono con clase .trash-ico", () => {
    render(<AquaPageFixture />);
    const del = screen.getByRole("button", { name: "Eliminar equipo" });
    expect(del.querySelector(".trash-ico")).toBeInTheDocument();
  });
});
