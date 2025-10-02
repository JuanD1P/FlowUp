import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  limit,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase/client";

// Helpers
function pace100Str(mins, meters) {
  if (!mins || !meters) return "";
  const per100 = mins / (meters / 100);
  const mm = Math.floor(per100);
  const ss = Math.round((per100 - mm) * 60);
  return `${mm}:${String(ss).padStart(2, "0")} /100m`;
}
function between(ts, days) {
  const now = Date.now();
  return ts >= now - days * 86400000 && ts <= now + 1;
}
function distOf(s) {
  if (typeof s?.distanciaTotal === "number") return s.distanciaTotal;
  if (Array.isArray(s?.bloques))
    return s.bloques.reduce(
      (a, b) => a + (Number(b.series || 0) * Number(b.metrosSerie || 0)),
      0
    );
  return 0;
}

// ===== Tarjeta de miembro (con estadísticas) =====
function MemberCard({ member, coachUid }) {
  const [sesiones, setSesiones] = useState(null); // null = cargando
  const [permiso, setPermiso] = useState(true);

  useEffect(() => {
    if (!member?.uid || !coachUid) return;
    const col = collection(db, "usuarios", member.uid, "entrenamientos");
    // Solo ver entrenos donde el coach esté en ownerIds
    const qy = query(col, where("ownerIds", "array-contains", coachUid), limit(40));

    const off = onSnapshot(
      qy,
      (snap) => {
        setPermiso(true);
        setSesiones(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("[VerEquipo] No se pudieron leer entrenamientos de", member.uid, err);
        setPermiso(false);
        setSesiones([]);
      }
    );
    return () => off();
  }, [member?.uid, coachUid]);

  const kpis = useMemo(() => {
    const s = sesiones || [];
    const agua = s.filter((x) => x.tipo === "agua");

    const dist7d = agua
      .filter((x) => (x.startMs ?? 0) >= Date.now() - 7 * 864e5)
      .reduce((a, b) => a + distOf(b), 0);

    const ses30d = s.filter((x) => (x.startMs ?? 0) >= Date.now() - 30 * 864e5).length;

    const totalDist = agua.reduce((a, b) => a + distOf(b), 0);
    const totalMin = s.reduce((a, b) => a + (Number(b.duracionMin) || 0), 0);

    const ritmoMedio =
      totalDist > 0 && totalMin > 0 ? pace100Str(totalMin, totalDist) : "";

    const rpeProm =
      s.slice(0, 10).reduce((a, b) => a + (Number(b.rpe) || 0), 0) /
      Math.max(1, Math.min(10, s.length));

    // últimas 3-4 sesiones para lista
    const recientes = s
      .slice() // clonar
      .sort((a, b) => (b.startMs || 0) - (a.startMs || 0))
      .slice(0, 4);

    return {
      dist7d,
      ses30d,
      totalDist,
      ritmoMedio,
      rpeProm: isFinite(rpeProm) ? rpeProm : 0,
      recientes,
    };
  }, [sesiones]);

  return (
    <div className="card" style={{ minWidth: 280 }}>
      <div className="team-head">
        <h4>{member.nombre || "Sin nombre"}</h4>
      </div>
      <div className="team-meta">{member.email || "—"}</div>

      {sesiones === null ? (
        <div className="skeleton" style={{ height: 96, marginTop: 8 }}>
          <div className="shimmer" />
        </div>
      ) : sesiones.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 10 }}>
          {permiso ? "Sin sesiones visibles." : "No tienes permiso para ver sus sesiones."}
        </div>
      ) : (
        <div className="stats" style={{ marginTop: 10 }}>
          <div
            className="stats-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}
          >
            <div className="stat-tile">
              <div className="stat-label">Metros (7d)</div>
              <div className="stat-value">{kpis.dist7d} m</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Sesiones (30d)</div>
              <div className="stat-value">{kpis.ses30d}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">RPE prom</div>
              <div className="stat-value">{kpis.rpeProm.toFixed(1)}</div>
              <div
                className="bar"
                style={{
                  height: 6,
                  background: "rgba(0,0,0,.08)",
                  borderRadius: 999,
                  overflow: "hidden",
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    width: `${(kpis.rpeProm / 10) * 100}%`,
                    height: "100%",
                    background: "linear-gradient(90deg,#7dd3fc,#60a5fa,#3b82f6)",
                  }}
                />
              </div>
            </div>
          </div>

          <div
            className="stat-row"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}
          >
            <div className="stat-tile soft">
              <div className="stat-label">Distancia tot.</div>
              <div className="stat-value">{kpis.totalDist} m</div>
            </div>
            <div className="stat-tile soft">
              <div className="stat-label">Ritmo medio</div>
              <div className="stat-value">{kpis.ritmoMedio || "—"}</div>
            </div>
          </div>

          <div className="last-list" style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6, fontWeight: 600 }}>
              Últimas sesiones
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: 6,
                fontSize: 13,
              }}
            >
              {kpis.recientes.map((t) => (
                <li
                  key={t.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    background: "rgba(0,0,0,.035)",
                    borderRadius: 10,
                    padding: "8px 10px",
                  }}
                >
                  <span>{new Date(t.startMs || 0).toLocaleDateString("es-ES")}</span>
                  <span style={{ opacity: 0.8 }}>
                    {t.tipo === "agua"
                      ? `${distOf(t)} m${t.ritmo100 ? ` · ${t.ritmo100}` : ""}`
                      : t.tipo}
                  </span>
                  <span style={{ opacity: 0.7 }}>RPE {t.rpe ?? "—"}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Vista principal =====
export default function VerEquipo() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const equipoId = params.get("equipo");

  const [coachUid, setCoachUid] = useState(null);
  const [miembros, setMiembros] = useState([]);
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(true);
  const [permisoEquipo, setPermisoEquipo] = useState(true);

  // Coach actual
  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => setCoachUid(u?.uid || null));
    return () => off();
  }, []);

  // Cargar equipo + subcolección de nadadores (NO usuarios/)
  useEffect(() => {
    if (!equipoId) return;

    setLoading(true);
    setPermisoEquipo(true);

    // 1) nombre del equipo (doc principal)
    (async () => {
      try {
        const ref = doc(db, "equipos", equipoId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setTeamName(snap.data()?.name || "");
        } else {
          setTeamName("");
        }
      } catch (e) {
        // Si no es owner, reglas lo bloquean
        setPermisoEquipo(false);
        setTeamName("");
      }
    })();

    // 2) Miembros desde subcolección: equipos/{equipoId}/nadadores
    const qy = query(collection(db, "equipos", equipoId, "nadadores"));
    const off = onSnapshot(
      qy,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            uid: data.uid || d.id,
            nombre: data.nombre || "(Sin nombre)",
            email: data.email || "",
            rolUsuario: data.rolUsuario || "USER",
          };
        });
        setMiembros(rows);
        setLoading(false);
      },
      (err) => {
        console.error("[VerEquipo] Error cargando miembros:", err);
        setPermisoEquipo(false);
        setMiembros([]);
        setLoading(false);
      }
    );

    return () => off();
  }, [equipoId]);

  return (
    <div className="coach-page">
      <section className="coach-head">
        <h2>👥 Miembros del equipo • {teamName || equipoId}</h2>
        <div className="row-end">
          <button className="btn-ghost" onClick={() => navigate(-1)}>
            ← Volver
          </button>
          <button
            className="btn-primary"
            onClick={() => navigate(`/AñadirNadadores?equipo=${equipoId}`)}
          >
            ＋ Añadir Nadador
          </button>
        </div>
      </section>

      {!permisoEquipo ? (
        <div className="card empty">
          <div className="empty-icon" aria-hidden>🔒</div>
          <h3>No tienes permiso para ver este equipo</h3>
        </div>
      ) : loading ? (
        <div className="card skeleton"><div className="shimmer" /></div>
      ) : miembros.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon" aria-hidden>🏊</div>
          <h3>Este equipo no tiene miembros aún</h3>
        </div>
      ) : (
        <div className="grid">
          {miembros.map((m) => (
            <MemberCard key={m.uid} member={m} coachUid={coachUid} />
          ))}
        </div>
      )}
    </div>
  );
}
