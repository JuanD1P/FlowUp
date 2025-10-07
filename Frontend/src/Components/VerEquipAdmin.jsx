// src/components/VerEquipo.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query } from "firebase/firestore";
import { db, auth } from "../firebase/client";
import logo from "/image.png";
import "./DOCSS/Admin.css"; // tu CSS

export default function VerEquipAdmin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // Acepta ?equipo= o ?id=
  const equipoId = params.get("equipo") || params.get("id");

  const [uid, setUid] = useState(null);
  const [teamName, setTeamName] = useState("");
  const [miembros, setMiembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [permisoEquipo, setPermisoEquipo] = useState(true);

  // Sesión
  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => setUid(u?.uid || null));
    return () => off();
  }, []);

  useEffect(() => {
    if (!equipoId || !uid) return;

    setLoading(true);
    setErr("");
    setPermisoEquipo(true);

    // 1) Intentar leer el documento del equipo (si reglas lo permiten)
    let unsub = null;
    (async () => {
      try {
        const ref = doc(db, "equipos", equipoId);
        const snap = await getDoc(ref); // permitido para owner y, con tus reglas, ADMIN (o USEREN si lo añadiste)
        if (!snap.exists()) {
          setErr("El equipo no existe.");
          setPermisoEquipo(false);
          setTeamName("");
          setLoading(false);
          return;
        }
        const data = snap.data() || {};
        setTeamName(data.name || "");

        // *** IMPORTANTE: NO verificar ownerId aquí ***
        // Antes comparabas data.ownerId !== uid y bloqueabas.
        // Ahora dejamos que las reglas decidan.

        // 2) Suscripción a la subcolección 'nadadores'
        const qy = query(collection(db, "equipos", equipoId, "nadadores"));
        unsub = onSnapshot(
          qy,
          (ss) => {
            const rows = ss.docs
              .map((d) => {
                const m = d.data() || {};
                return {
                  id: d.id,
                  nombre: m.nombre || "(Sin nombre)",
                  email: m.email || "",
                };
              })
              .sort((a, b) => a.nombre.localeCompare(b.nombre));
            setMiembros(rows);
            setLoading(false);
          },
          (e) => {
            console.error(e);
            setErr("No fue posible cargar los miembros del equipo.");
            setPermisoEquipo(false);
            setMiembros([]);
            setLoading(false);
          }
        );
      } catch (e) {
        // permission-denied u otros
        console.error(e);
        setErr("No tienes permiso para ver este equipo.");
        setPermisoEquipo(false);
        setTeamName("");
        setLoading(false);
      }
    })();

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [equipoId, uid]);

  if (!equipoId) {
    return (
      <div className="admin-page">
        <div className="admin-overlay" />
        <header className="admin-header glass-strong">
          <div className="admin-header-left">
            <img src={logo} alt="Logo" className="admin-logo" />
            <div>
              <h1 className="admin-title">MIEMBROS DEL EQUIPO</h1>
              <p className="admin-subtitle">Falta el parámetro <code>equipo</code> o <code>id</code></p>
            </div>
          </div>
          <div className="admin-header-actions">
            <button className="btn accent" onClick={() => navigate(-1)}>← Volver</button>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-overlay" />

      <header className="admin-header glass-strong">
        <div className="admin-header-left">
          <img src={logo} alt="Logo" className="admin-logo" />
          <div>
            <h1 className="admin-title">MIEMBROS DEL EQUIPO</h1>
            <p className="admin-subtitle">{teamName || equipoId}</p>
          </div>
        </div>
        <div className="admin-header-actions">
          <button className="btn accent" onClick={() => navigate(-1)}>← Volver</button>
        </div>
      </header>

      <main className="admin-content">
        <section className="card glass-strong">
          <div className="card-head">
            <h2>Lista de miembros</h2>
            <div className="chip">{loading ? "Cargando..." : `${miembros.length} miembro(s)`}</div>
          </div>

          {err && <div className="alert error">{err}</div>}

          {!permisoEquipo ? (
            <div className="cell-empty">No tienes permiso para ver este equipo.</div>
          ) : loading ? (
            <>
              <div className="skeleton-row" />
              <div className="skeleton-row" />
              <div className="skeleton-row" />
            </>
          ) : miembros.length === 0 ? (
            <div className="cell-empty">Este equipo no tiene miembros aún.</div>
          ) : (
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {miembros.map((m) => (
                    <tr key={m.id}>
                      <td className="cell-strong">{m.nombre}</td>
                      <td className="col-email">{m.email || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
