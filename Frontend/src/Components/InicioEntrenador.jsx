
import React, { useEffect, useState } from "react";
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
} from "firebase/firestore";
import { auth, db } from "../firebase/client";
import "./DOCSS/InicioEntrenador.css";

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="md-backdrop" role="dialog" aria-modal="true">
      <div className="md-card">
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
}

export default function InicioEntrenador() {
  const [user, setUser] = useState(null);
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal Crear Equipo
  const [openCreate, setOpenCreate] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");

  useEffect(() => {
    let unsubAuth = null;
    let unsubEquipos = null;

    unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setUser(null);
        setEquipos([]);
        setLoading(false);
        return;
      }

      setUser(u);
      setLoading(true);

      // 🔹 Solo traemos los equipos que el usuario ha creado (ownerId == uid)
      const q = query(
        collection(db, "equipos"),
        where("ownerId", "==", u.uid),
        orderBy("createdAt", "desc")
      );

      unsubEquipos = onSnapshot(
        q,
        (snap) => {
          const rows = [];
          snap.forEach((d) => {
            const data = d.data();
            if (data.ownerId === u.uid) {
              rows.push({ id: d.id, ...data });
            }
          });
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
      swimmersCount: 0,
      miembros: [user.uid],
    });

    setOpenCreate(false);
    setNuevoNombre("");
  };

  return (
    <div className="coach-page">
      <section className="coach-card-coach-welcome">
        <h2>
          ¡Bienvenido coach, <strong>{user?.displayName || "Entrenador"}</strong>!
        </h2>
        <p>Gestiona tus equipos y nadadores desde aquí.</p>
      </section>

      <div className="coach-head">
        <h2>👥 Mis Equipos ({equipos.length})</h2>
        <button className="btn-añadir" onClick={() => setOpenCreate(true)}>
          ＋ Crear Equipo
        </button>
      </div>

      {loading ? (
        <div className="card skeleton">
          <div className="shimmer" />
        </div>
      ) : equipos.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon" aria-hidden>
            👥
          </div>
          <h3>No tienes equipos aún</h3>
          <p>Crea tu primer equipo para comenzar a gestionar nadadores</p>
          <button className="btn-primary" onClick={() => setOpenCreate(true)}>
            ＋ Crear Primer Equipo
          </button>
        </div>
      ) : (
        <div className="grid">
          {equipos.map((eq) => (
            <EquipoCard key={eq.id} equipo={eq} />
          ))}
        </div>
      )}

      <Modal
        open={openCreate}
        title="Crear Nuevo Equipo"
        onClose={() => setOpenCreate(false)}
      >
        <label className="field">
          <span>Nombre del Equipo</span>
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
          <button
            className="btn-primary"
            onClick={crearEquipo}
            disabled={!nuevoNombre.trim()}
          >
            Crear Equipo
          </button>
        </div>
      </Modal>
    </div>
  );
}

/** Tarjeta de Equipo */
function EquipoCard({ equipo }) {
  const navigate = useNavigate();
  return (
    <div className="card team">
      <div className="team-head">
        <h4>{equipo.name}</h4>
        <span className="pill">👥 {equipo.swimmersCount ?? 0}</span>
      </div>
      <div className="team-accion">
        <button className="btn-add"
        onClick={() => navigate(`/AñadirNadadores?equipo=${equipo.id}`)}>＋ Añadir Nadador</button>
        <button className="btn-view" 
        onClick={() => navigate(`/VerEquipo?equipo=${equipo.id}`)}> Ver Equipo</button>
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
    </div>
  );
}
