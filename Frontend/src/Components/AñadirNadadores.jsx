import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  increment,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase/client";
import ToastStack from "./ToastStack";
import "./DOCSS/AñadirNadadores.css";

// ===== Helpers =====
function initialsOf(nameOrEmail = "") {
  const src = (nameOrEmail || "").trim();
  if (!src) return "🙂";
  const parts = src.includes("@")
    ? src.split("@")[0].split(/[.\-_]/g)
    : src.split(/\s+/g);
  const first = (parts[0] || "").charAt(0);
  const second = (parts[1] || "").charAt(0);
  return (first + second).toUpperCase() || src.charAt(0).toUpperCase();
}

export default function AñadirNadadores() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const equipoId = searchParams.get("equipo");

  const [nadadores, setNadadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState({});
  const [filtro, setFiltro] = useState("");

  const [toasts, setToasts] = useState([]);
  const pushToast = (t) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, duration: 3500, ...t }]);
  };
  const closeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  useEffect(() => {
    setLoading(true);
    setErr("");
    const q = query(collection(db, "usuarios"), where("rol", "==", "USER"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            uid: data.uid || d.id,
            nombre: data.nombre ?? data.displayName ?? "(Sin nombre)",
            email: data.email ?? "",
            rol: data.rol ?? "USER",
          };
        });
        rows.sort((a, b) =>
          a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
        );
        setNadadores(rows);
        setLoading(false);
      },
      (e) => {
        console.error("[AñadirNadadores] onSnapshot error:", e);
        setErr(e?.message || "No se pudieron cargar los nadadores.");
        setNadadores([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const listaFiltrada = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    // 🔎 Cambio clave: si no hay filtro, NO mostrar ningún nadador
    if (!f) return [];
    return nadadores.filter(
      (n) =>
        n.nombre.toLowerCase().includes(f) ||
        (n.email && n.email.toLowerCase().includes(f))
    );
  }, [nadadores, filtro]);

  async function backfillOwnerIdsForSwimmer(swimmerUid, coachUid) {
    try {
      await updateDoc(doc(db, "usuarios", swimmerUid), {
        ownerIds: arrayUnion(coachUid),
      });
    } catch (e) {
      console.warn("[backfill] perfil.ownerIds:", e?.code || e?.message);
    }

    const entrenosCol = collection(db, "usuarios", swimmerUid, "entrenamientos");
    const snap = await getDocs(entrenosCol);

    let total = 0;
    let ops = 0;
    let batch = writeBatch(db);

    for (const d of snap.docs) {
      batch.update(d.ref, { ownerIds: arrayUnion(coachUid) });
      ops++;
      total++;
      if (ops === 400) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();
    return total;
  }

  const addNadadorToEquipo = async (n) => {
    const uid = n?.uid;
    const coachUid = auth.currentUser?.uid || null;

    if (!equipoId) {
      pushToast({
        variant: "error",
        icon: "⚠️",
        title: "Falta equipo",
        message: "Agrega ?equipo=EQUIPO_ID en la URL.",
      });
      return;
    }
    if (!uid) {
      pushToast({
        variant: "error",
        icon: "⚠️",
        title: "UID inválido",
        message: "El usuario no tiene un UID válido.",
      });
      return;
    }

    try {
      setAdding((s) => ({ ...s, [uid]: true }));

      const equipoRef = doc(db, "equipos", equipoId);
      const teamSnap = await getDoc(equipoRef);
      if (!teamSnap.exists()) {
        pushToast({
          variant: "error",
          icon: "❌",
          title: "Equipo no encontrado",
          message: "El equipo no existe.",
        });
        return;
      }
      const ownerId = teamSnap.data()?.ownerId;
      if (!coachUid || ownerId !== coachUid) {
        pushToast({
          variant: "error",
          icon: "🔒",
          title: "Sin permiso",
          message: "Solo el dueño del equipo puede añadir miembros.",
        });
        return;
      }

      const nadadorRef = doc(db, "equipos", equipoId, "nadadores", uid);
      const memberSnap = await getDoc(nadadorRef);
      if (memberSnap.exists()) {
        pushToast({
          variant: "info",
          icon: "ℹ️",
          title: "Ya estaba en el equipo",
          message: `${n.nombre} ya es miembro.`,
        });
        navigate(`/VerEquipo?equipo=${equipoId}`);
      } else {
        const batch = writeBatch(db);
        batch.set(nadadorRef, {
          uid,
          nombre: n?.nombre ?? null,
          email: n?.email ?? null,
          rolUsuario: n?.rol ?? "USER",
          addedAt: serverTimestamp(),
        });
        batch.update(equipoRef, {
          swimmersCount: increment(1),
          miembros: arrayUnion(uid),
        });
        await batch.commit();

        pushToast({
          variant: "success",
          icon: "✅",
          title: "Agregado",
          message: `${n.nombre} se agregó al equipo.`,
        });

        try {
          const marked = await backfillOwnerIdsForSwimmer(uid, coachUid);
          pushToast({
            variant: "success",
            icon: "🏷️",
            title: "Sesiones marcadas",
            message: `Se añadieron permisos a ${marked} sesión(es).`,
          });
        } catch (e) {
          console.error("[AñadirNadadores] backfill error:", e);
          const msg =
            e?.code === "permission-denied"
              ? "No se pudieron marcar las sesiones (revisa que tu rol sea USEREN/ADMIN)."
              : e?.message || "No se pudieron marcar las sesiones.";
          pushToast({
            variant: "error",
            icon: "❌",
            title: "Backfill incompleto",
            message: msg,
          });
        }

        navigate(`/VerEquipo?equipo=${equipoId}`);
      }
    } catch (e) {
      console.error("[AñadirNadadores] addNadadorToEquipo error:", e);
      const msg =
        e?.code === "permission-denied"
          ? "No tienes permisos para escribir en este equipo."
          : e?.message || "No se agregó exitosamente.";
      pushToast({ variant: "error", icon: "❌", title: "Fallo al agregar", message: msg });
    } finally {
      setAdding((s) => {
        const { [uid]: _, ...rest } = s;
        return rest;
      });
    }
  };

  const hayFiltro = filtro.trim().length > 0;

  return (
    <div className="coach-page aqua-page">
      <div className="aqua-container slim swimmers-one-col">
        <div className="coach-head pretty-head">
          <div>
            <h2>🏊‍♂️ Añadir Nadadores</h2>
            <p className="sub">
              {hayFiltro
                ? (loading
                    ? "Buscando…"
                    : `(${listaFiltrada.length} coincidencia${listaFiltrada.length === 1 ? "" : "s"})`)
                : "Escribe para buscar por nombre o email"}
            </p>
          </div>

          <div className="row-end">
            <button
              className="btn-ghost"
              onClick={() => navigate(`/VerEquipo?equipo=${equipoId}`)}
              title="Volver al equipo"
            >
              ← Volver
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="swim-search">
          <input
            className="swim-input"
            placeholder="Buscar por nombre o email…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>

        {!equipoId && (
          <div className="card empty aqua-glass" style={{ marginTop: 12 }}>
            <div className="empty-icon" aria-hidden>
              ⚠️
            </div>
            <h3>Falta el equipo</h3>
            <p>
              Agrega <code>?equipo=EQUIPO_ID</code> en la URL para poder añadir.
            </p>
          </div>
        )}

        {err && <div className="error-banner">Error: {err}</div>}

        {/* Estado vacío inicial sin lista */}
        {!hayFiltro ? (
          <div className="card empty aqua-glass" style={{ marginTop: 12 }}>
            <div className="empty-icon" aria-hidden>🔎</div>
            <h3>Empieza a buscar</h3>
            <p>Escribe el nombre o el correo del nadador.</p>
          </div>
        ) : loading ? (
          <div className="grid pretty-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="swimmer-card skeleton" key={i}>
                <div className="shimmer" />
              </div>
            ))}
          </div>
        ) : listaFiltrada.length === 0 ? (
          <div className="card empty aqua-glass">
            <div className="empty-icon" aria-hidden>🌊</div>
            <h3>Sin coincidencias</h3>
            <p>Intenta con otro término de búsqueda.</p>
          </div>
        ) : (
          <div className="grid pretty-grid">
            {listaFiltrada.map((n) => {
              const disabled = !!adding[n.uid];
              return (
                <div className="aqua-card swimmer-card" key={n.uid}>
                  <div className="swimmer-top">
                    <div className="swimmer-avatar" aria-hidden>
                      {initialsOf(n.nombre || n.email)}
                    </div>
                    <div className="swimmer-head">
                      <strong className="name" title={n.nombre || ""}>
                        {n.nombre}
                      </strong>
                      <span className="email" title={n.email || ""}>
                        {n.email || <span style={{ opacity: 0.6 }}>(sin correo)</span>}
                      </span>
                    </div>
                  </div>

                  <div className="swimmer-actions">
                    <button
                      className={`btn-primary ${disabled ? "is-disabled" : ""}`}
                      disabled={disabled || !equipoId}
                      onClick={() => addNadadorToEquipo(n)}
                      title={equipoId ? "Añadir al equipo" : "Falta ?equipo=EQUIPO_ID"}
                    >
                      {disabled ? "Añadiendo…" : "＋ Añadir"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ToastStack toasts={toasts} onClose={closeToast} />
    </div>
  );
}
