import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  runTransaction,
  arrayUnion,
  increment,
} from "firebase/firestore";
import { db } from "../firebase/client";
import ToastStack from "./ToastStack"; // <-- ajusta la ruta si es distinta

export default function AñadirNadadores() {
  const [searchParams] = useSearchParams();
  const equipoId = searchParams.get("equipo"); // ?equipo=TEAM_ID

  const [nadadores, setNadadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState({});
  const [filtro, setFiltro] = useState("");

  // ---- TOASTS ----
  const [toasts, setToasts] = useState([]);
  const pushToast = (t) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, duration: 3000, ...t }]);
  };
  const closeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  useEffect(() => {
    setLoading(true);
    setErr("");

    const q = query(collection(db, "usuarios"), where("rol", "==", "USER"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = [];
        snap.forEach((d) => {
          const data = d.data() || {};
          rows.push({
            uid: data.uid || d.id,
            nombre: data.nombre ?? data.displayName ?? "(Sin nombre)",
            email: data.email ?? "",
            rol: data.rol ?? "USER",
          });
        });
        rows.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
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
    if (!f) return nadadores;
    return nadadores.filter(
      (n) =>
        n.nombre.toLowerCase().includes(f) ||
        (n.email && n.email.toLowerCase().includes(f))
    );
  }, [nadadores, filtro]);

  const addNadadorToEquipo = async (n) => {
    const uid = n?.uid;

    try {
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

      setAdding((s) => ({ ...s, [uid]: true }));

      const nadadorRef = doc(db, "equipos", equipoId, "nadadores", uid);
      const equipoRef = doc(db, "equipos", equipoId);

      let yaExistia = false;

      await runTransaction(db, async (tx) => {
        const existente = await tx.get(nadadorRef);
        yaExistia = existente.exists();

        if (!yaExistia) {
          tx.set(
            nadadorRef,
            {
              uid,
              nombre: n?.nombre ?? null,
              email: n?.email ?? null,
              rolUsuario: n?.rol ?? "USER",
              addedAt: serverTimestamp(),
            },
            { merge: true }
          );

          tx.update(equipoRef, {
            swimmersCount: increment(1),
            miembros: arrayUnion(uid),
          });
        }
      });

      if (yaExistia) {
        pushToast({
          variant: "info",
          icon: "ℹ️",
          title: "Ya estaba en el equipo",
          message: `${n.nombre} ya es miembro.`,
        });
      } else {
        pushToast({
          variant: "success",
          icon: "✅",
          title: "Agregado exitosamente",
          message: `${n.nombre} se agregó al equipo.`,
        });
      }
    } catch (e) {
      console.error("[AñadirNadadores] addNadadorToEquipo error:", e);
      pushToast({
        variant: "error",
        icon: "❌",
        title: "Fallo al agregar",
        message: e?.message || "No se agregó exitosamente.",
      });
    } finally {
      setAdding((s) => {
        const { [uid]: _, ...rest } = s;
        return rest;
      });
    }
  };

  return (
    <div className="perfil-page" style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Añadir Nadadores</h2>
        <span style={{ opacity: 0.8 }}>
          {loading ? "Cargando…" : `(${nadadores.length} encontrados)`}
        </span>
      </div>

      {!equipoId && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: "#fff3cd",
            border: "1px solid #ffeeba",
            color: "#856404",
          }}
        >
          ⚠️ Agrega <code>?equipo=EQUIPO_ID</code> en la URL para poder añadir.
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <input
          placeholder="Buscar por nombre o email…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            outline: "none",
          }}
        />
      </div>

      {err && (
        <div style={{ color: "crimson", marginTop: 16 }}>
          Error: {err}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 16 }}>Cargando lista de nadadores…</div>
      ) : listaFiltrada.length === 0 ? (
        <div style={{ marginTop: 16 }}>No hay nadadores para mostrar.</div>
      ) : (
        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e5e5" }}>
                <th style={{ padding: "10px 8px" }}>Nombre</th>
                <th style={{ padding: "10px 8px" }}>Correo</th>
                <th style={{ padding: "10px 8px" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map((n) => {
                const disabled = !!adding[n.uid];
                return (
                  <tr key={n.uid} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "10px 8px" }}>{n.nombre}</td>
                    <td style={{ padding: "10px 8px" }}>
                      {n.email || <span style={{ opacity: 0.6 }}>(sin correo)</span>}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <button
                        className="btn-primary"
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #0d6efd",
                          background: disabled ? "#a3c3ff" : "#0d6efd",
                          color: "white",
                          cursor: disabled ? "not-allowed" : "pointer",
                        }}
                        disabled={disabled}
                        onClick={() => addNadadorToEquipo(n)}
                        title={equipoId ? "Añadir al equipo" : "Falta ?equipo=EQUIPO_ID"}
                      >
                        {disabled ? "Añadiendo…" : "Añadir"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TOASTS */}
      <ToastStack toasts={toasts} onClose={closeToast} />
    </div>
  );
}
