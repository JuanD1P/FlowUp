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
  doc,
  setDoc,          
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

    unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setEquipos([]);
        setLoading(false);
        return;
      }

      setUser(u);
      setLoading(true);

      // ✅ Asegura que el COACH tenga su perfil con rol USEREN (tus reglas lo requieren)
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

      // 🔹 Trae solo equipos creados por este coach
      const q = query(
        collection(db, "equipos"),
        where("ownerId", "==", u.uid),
        orderBy("createdAt", "desc")
      );

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
      // Mantén ambos si quieres; la vista de VerEquipo usa `nombre` o `name`
      nombre: name,
      // Incluye al coach como miembro (importante para que los nadadores detecten su coach)
      miembros: [user.uid],
      // Si no llevas este contador, lo puedes calcular desde miembros en la tarjeta
      swimmersCount: 0,
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
          <div className="empty-icon" aria-hidden>👥</div>
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
        <div>
          <button
            className="btn-primary"
            onClick={crearEquipo}
            disabled={!nuevoNombre.trim()}
          >
            Crear Equipo
          </button>
        </div>
        </div>
      </Modal>
    </div>
  );
}

/** Tarjeta de Equipo */
function EquipoCard({ equipo }) {
  const navigate = useNavigate();

  // Si no mantienes swimmersCount, calcula desde `miembros` (resta 1 por el coach)
  const miembrosCount =
    typeof equipo.swimmersCount === "number"
      ? equipo.swimmersCount
      : Math.max(0, (equipo.miembros?.length || 0) - 1);

  return (
    <div className="card team">
      <div className="team-head">
        <h4>{equipo.name || equipo.nombre || "Equipo"}</h4>
        <span className="pill">👥 {miembrosCount}</span>
      </div>
      <div className="team-accion">
        <button
          className="btn-add"
          onClick={() => navigate(`/AñadirNadadores?equipo=${equipo.id}`)}
        >
          ＋ Añadir Nadador
        </button>
        <button
          className="btn-view"
          onClick={() => navigate(`/VerEquipo?equipo=${equipo.id}`)}
        >
          Ver Equipo
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
    </div>
  );
}
