import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { collection, doc, getDoc, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/client";

export default function VerEquipo() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const equipoId = params.get("equipo");
  const [miembros, setMiembros] = useState([]);
  const [ownerId, setOwnerId] = useState(null);   // ← guardamos el creador
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubUsuarios = null;

    const run = async () => {
      if (!equipoId) return;
      setLoading(true);

      // 1) Traer doc del equipo para obtener miembros y ownerId
      const equipoRef = doc(db, "equipos", equipoId);
      const equipoSnap = await getDoc(equipoRef);
      const data = equipoSnap.exists() ? equipoSnap.data() : null;
      const ids = Array.isArray(data?.miembros) ? data.miembros : [];
      setOwnerId(data?.ownerId || null);

      if (ids.length === 0) {
        setMiembros([]);
        setLoading(false);
        return;
      }

      // 2) Particionar por límite de 30 ids para 'in'
      const chunks = [];
      for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));

      const listeners = chunks.map((chunk) => {
        const q = query(collection(db, "usuarios"), where("__name__", "in", chunk));
        return onSnapshot(q, (snap) => {
          setMiembros((prev) => {
            const next = new Map(prev.map((u) => [u.id, u]));
            snap.forEach((d) => next.set(d.id, { id: d.id, ...d.data() }));
            return Array.from(next.values());
          });
          setLoading(false);
        });
      });

      unsubUsuarios = () => listeners.forEach((u) => u && u());
    };

    run();
    return () => unsubUsuarios && unsubUsuarios();
  }, [equipoId]);

  // Filtramos al coach/creador del equipo
  const miembrosVisibles = miembros.filter((m) => m.id !== ownerId);

  return (
    <div className="coach-page">
      <section className="coach-head">
        <h2>👥 Miembros del equipo</h2>
        <div className="row-end">
          <button className="btn-ghost" onClick={() => navigate(-1)}>← Volver</button>
          <button className="btn-primary" onClick={() => navigate(`/AñadirNadadores?equipo=${equipoId}`)}>
            ＋ Añadir Nadador
          </button>
        </div>
      </section>

      {loading ? (
        <div className="card skeleton"><div className="shimmer" /></div>
      ) : miembrosVisibles.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon" aria-hidden>🏊</div>
          <h3>Este equipo no tiene miembros aún</h3>
        </div>
      ) : (
        <div className="grid">
          {miembrosVisibles.map((m) => (
            <div className="card" key={m.id}>
              <div className="team-head">
                <h4>
                  {m.displayName || m.nombre || "Sin nombre"}
                  
                </h4>
                
              </div>
              <div className="team-meta"> {m.email || "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
