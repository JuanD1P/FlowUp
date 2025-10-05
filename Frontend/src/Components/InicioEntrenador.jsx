// src/pages/InicioEntrenador.jsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase/client";

import Swal from "sweetalert2";
import "@sweetalert2/themes/borderless/borderless.css";

import "./DOCSS/InicioEntrenador.css";

/* ---------- Modal con portal (centrado y encima de todo) ---------- */
function Modal({ open, title, children, onClose }) {
  useEffect(() => {
    if (!open) return;
    // Bloquear scroll del fondo mientras el modal esté abierto
    document.documentElement.classList.add("no-scroll");
    document.body.classList.add("no-scroll");
    return () => {
      document.documentElement.classList.remove("no-scroll");
      document.body.classList.remove("no-scroll");
    };
  }, [open]);

  if (!open) return null;

  const content = (
    <div className="md-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="md-card aqua-glass" onClick={(e) => e.stopPropagation()}>
        <div className="md-head">
          <h3>{title}</h3>
          <button className="md-x" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="md-body">{children}</div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

/* ---------- Helpers ---------- */
function initialsOf(name = "") {
  const n = (name || "").trim();
  if (!n) return "EQ";
  const parts = n.split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

/* ---------- Card de Equipo ---------- */
function EquipoCard({ equipo, onDelete }) {
  const navigate = useNavigate();

  const miembrosCount =
    typeof equipo.swimmersCount === "number"
      ? equipo.swimmersCount
      : Math.max(0, (equipo.miembros?.length || 0) - 1);

  const name = equipo.name || equipo.nombre || "Equipo";
  const initials = initialsOf(name);

  return (
    <div className="aqua-card card team">
      <div className="team-top">
        <div className="team-avatar" aria-hidden>
          {initials}
        </div>

        <div className="team-head" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h4 title={name} style={{ flex: 1, minWidth: 0 }}>
            {name}
          </h4>
          <span className="pill">👥 {miembrosCount}</span>

          {/* Botón eliminar equipo */}
          <button
            className="btn-trash"
            onClick={() => onDelete?.(equipo)}
            title="Eliminar equipo"
            aria-label={`Eliminar equipo ${name}`}
          >
            <span className="trash-ico" aria-hidden />
          </button>
        </div>
      </div>

      <div className="team-accion">
        <button
          className="btn-add"
          onClick={() => navigate(`/AñadirNadadores?equipo=${equipo.id}`)}
          title="Añadir nadadores"
        >
          ＋ Añadir Nadador
        </button>
        <button
          className="btn-view"
          onClick={() => navigate(`/VerEquipo?equipo=${equipo.id}`)}
          title="Ver equipo"
        >
          Ver equipo
        </button>
      </div>

      <div className="team-meta">
        📅 Creado{" "}
        {equipo.createdAtLocal
          ? new Date(equipo.createdAtLocal).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : ""}
      </div>

      {/* Waves decorativas del card */}
      <div className="card-waves" aria-hidden>
        <span className="cw w1" />
        <span className="cw w2" />
      </div>
    </div>
  );
}

/* =======================================================
   Vista principal
======================================================= */
export default function InicioEntrenador() {
  const [user, setUser] = useState(null);
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openCreate, setOpenCreate] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");

  useEffect(() => {
    let unsubAuth = null;
    let unsubEquipos = null;

    unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setEquipos([]);
        setLoading(false);
        return;
      }

      setUser(u);
      setLoading(true);

      // Asegura el rol para las reglas
      try {
        const coachRef = doc(db, "usuarios", u.uid);
        await setDoc(
          coachRef,
          {
            rol: "USEREN",
            displayName: u.displayName || null,
            email: u.email || null,
            actualizadoEn: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn("No se pudo asegurar el rol USEREN del coach:", e);
      }

      // Traer equipos del owner
      const q = query(collection(db, "equipos"), where("ownerId", "==", u.uid), orderBy("createdAt", "desc"));

      unsubEquipos = onSnapshot(
        q,
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setEquipos(rows);
          setLoading(false);
        },
        (err) => {
          console.error("Error al obtener equipos:", err);
          setEquipos([]);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubAuth && unsubAuth();
      unsubEquipos && unsubEquipos();
    };
  }, []);

  const crearEquipo = async () => {
    const name = nuevoNombre.trim();
    if (!name || !user) return;

    await addDoc(collection(db, "equipos"), {
      name,
      ownerId: user.uid,
      ownerEmail: user.email || null,
      createdAt: serverTimestamp(),
      createdAtLocal: Date.now(),
      nombre: name,
      miembros: [user.uid], 
      swimmersCount: 0,
    });

    setOpenCreate(false);
    setNuevoNombre("");
  };

  // --------- ELIMINAR EQUIPO (con confirmación) ----------
  const eliminarEquipo = async (equipo) => {
    if (!user) return;

    const result = await Swal.fire({
      title: "¿Eliminar este equipo?",
      html:
        `Se eliminará <b>${equipo.name || equipo.nombre || "el equipo"}</b> y su lista de miembros.<br/>` +
        `<small>Esta acción no se puede deshacer.</small>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
      showLoaderOnConfirm: true,
      buttonsStyling: false,
      customClass: {
        popup: "sw-popup",
        title: "sw-title",
        htmlContainer: "sw-text",
        actions: "sw-actions",
        confirmButton: "sw-confirm",
        cancelButton: "sw-cancel",
      },
      preConfirm: async () => {
        try {
          if (equipo.ownerId !== user.uid) {
            throw new Error("Solo el dueño del equipo puede eliminarlo.");
          }

          // Borrar subcolección /nadadores primero (best-effort, batched)
          const sub = collection(db, "equipos", equipo.id, "nadadores");
          const subSnap = await getDocs(sub);
          if (!subSnap.empty) {
            let batch = writeBatch(db);
            let ops = 0;
            for (const d of subSnap.docs) {
              batch.delete(d.ref);
              ops++;
              if (ops === 400) {
                await batch.commit();
                batch = writeBatch(db);
                ops = 0;
              }
            }
            if (ops > 0) await batch.commit();
          }

          // Borrar el documento del equipo
          await deleteDoc(doc(db, "equipos", equipo.id));
        } catch (e) {
          console.error("[Eliminar equipo] Error:", e);
          Swal.showValidationMessage(e?.message || "No se pudo eliminar el equipo.");
          return false;
        }
      },
      allowOutsideClick: () => !Swal.isLoading(),
    });

    if (result.isConfirmed) {
      Swal.fire({
        icon: "success",
        title: "Equipo eliminado",
        timer: 1400,
        showConfirmButton: false,
        buttonsStyling: false,
        customClass: { popup: "sw-popup" },
      });
    }
  };

  return (
    <div className="coach-page aqua-page">
      {/* HERO dentro de contenedor */}
      <div className="aqua-container">
        <section className="coach-hero">
          <div className="hero-col">
            <h2 className="hero-title">
              ¡Bienvenido coach, <strong>{user?.displayName || "Entrenador"}</strong>!
            </h2>
            <p className="hero-sub">Gestiona tus equipos y nadadores desde aquí.</p>
            <div className="hero-actions">
              <button className="btn-primary big" onClick={() => setOpenCreate(true)}>
                ＋ Crear equipo
              </button>
            </div>
          </div>
          <div className="hero-art" aria-hidden>
            <div className="bubble b1" />
            <div className="bubble b2" />
            <div className="bubble b3" />
            <div className="waves">
              <span className="wave w1" />
              <span className="wave w2" />
              <span className="wave w3" />
            </div>
          </div>
        </section>
      </div>

      {/* HEAD + GRID dentro de contenedor */}
      <div className="aqua-container">
        <div className="coach-head pretty-head">
          <h2>
            👥 Mis Equipos <span className="count-pill">{equipos.length}</span>
          </h2>
        </div>

        {loading ? (
          <div className="card skeleton">
            <div className="shimmer" />
          </div>
        ) : equipos.length === 0 ? (
          <div className="card empty aqua-glass">
            <div className="empty-icon" aria-hidden>
              🌊
            </div>
            <h3>No tienes equipos aún</h3>
            <p>Crea tu primer equipo para comenzar a gestionar nadadores</p>
            <button className="btn-primary" onClick={() => setOpenCreate(true)}>
              ＋ Crear Primer Equipo
            </button>
          </div>
        ) : (
          <div className="grid pretty-grid">
            {equipos.map((eq) => (
              <EquipoCard key={eq.id} equipo={eq} onDelete={eliminarEquipo} />
            ))}
          </div>
        )}
      </div>

      {/* Modal (portal) */}
      <Modal open={openCreate} title="Crear nuevo equipo" onClose={() => setOpenCreate(false)}>
        <label className="field">
          <span>Nombre del equipo</span>
          <input
            placeholder="Ej: Tiburones Juveniles"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && crearEquipo()}
          />
        </label>
        <div className="row-end">
          <button className="btn-ghost" onClick={() => setOpenCreate(false)}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={crearEquipo} disabled={!nuevoNombre.trim()}>
            Crear equipo
          </button>
        </div>
      </Modal>
    </div>
  );
}
