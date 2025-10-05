// src/components/VerEquipo.jsx
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
  deleteDoc,
  getDocs,
  arrayRemove,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase/client";
import Swal from "sweetalert2";
import "@sweetalert2/themes/borderless/borderless.css";
import "./DOCSS/VerEquipo.css";

/* ===================== Helpers ===================== */
function pace100Str(mins, meters) {
  if (!mins || !meters) return "";
  const per100 = mins / (meters / 100);
  const mm = Math.floor(per100);
  const ss = Math.round((per100 - mm) * 60);
  return `${mm}:${String(ss).padStart(2, "0")} /100m`;
}
function distOf(s) {
  if (typeof s?.distanciaTotal === "number") return s.distanciaTotal;
  if (Array.isArray(s?.bloques))
    return s.bloques.reduce(
      (a, b) => a + Number(b.series || 0) * Number(b.metrosSerie || 0),
      0
    );
  return 0;
}
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
function fmtNum(n) {
  if (!Number.isFinite(n)) return "";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/* ===================== Tarjeta de miembro ===================== */
function MemberCard({ member, coachUid, onRemove, removing }) {
  const [sesiones, setSesiones] = useState(null);
  const [permiso, setPermiso] = useState(true);

  useEffect(() => {
    if (!member?.uid || !coachUid) return;
    const col = collection(db, "usuarios", member.uid, "entrenamientos");
    const qy = query(col, where("ownerIds", "array-contains", coachUid), limit(60));
    const off = onSnapshot(
      qy,
      (snap) => {
        setPermiso(true);
        setSesiones(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => {
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
    const ritmoMedio = totalDist > 0 && totalMin > 0 ? pace100Str(totalMin, totalDist) : "";
    const rpeProm =
      s.slice(0, 10).reduce((a, b) => a + (Number(b.rpe) || 0), 0) /
      Math.max(1, Math.min(10, s.length));

    const recientes = s
      .slice()
      .sort((a, b) => (b.startMs || 0) - (a.startMs || 0))
      .slice(0, 5);

    const last10 = agua
      .slice()
      .sort((a, b) => (b.startMs || 0) - (a.startMs || 0))
      .slice(0, 10)
      .map((x) => distOf(x));
    const maxSpark = Math.max(1, ...last10);
    return {
      dist7d,
      ses30d,
      totalDist,
      ritmoMedio,
      rpeProm: isFinite(rpeProm) ? rpeProm : 0,
      recientes,
      spark: last10.reverse(),
      maxSpark,
    };
  }, [sesiones]);

  const showDist7d = Number(kpis.dist7d) > 0;
  const showSes30 = Number(kpis.ses30d) > 0;
  const showRpe = Number(kpis.rpeProm) > 0;
  const showTotalDist = Number(kpis.totalDist) > 0;
  const showRitmo = Boolean(kpis.ritmoMedio);
  const showSpark = (kpis.spark || []).some((v) => v > 0);

  return (
    <div className="ath-card swim-float">
      <div className="ath-ribbon" aria-hidden />
      <div className="ath-bubbles" aria-hidden />
      {/* Header */}
      <div className="ath-header">
        <div className="ath-id">
          <div className="ath-avatar">{initialsOf(member.nombre || member.email)}</div>
          <div className="ath-meta">
            <div className="ath-name" title={member.nombre || ""}>
              {member.nombre || "Sin nombre"}
            </div>
            {member.email ? <div className="ath-mail">{member.email}</div> : null}
          </div>
        </div>

        {/* Botón eliminar bonito */}
        <button
          onClick={() => onRemove?.(member)}
          disabled={removing}
          className={`ath-trashbtn ${removing ? "is-loading" : ""}`}
          title="Eliminar nadador"
          aria-label={`Quitar a ${member.nombre || member.email}`}
        >
          <span className="trash-ico" aria-hidden />
        </button>
      </div>

      {sesiones === null ? (
        <div className="skeleton" style={{ height: 120, marginTop: 8 }}>
          <div className="shimmer" />
        </div>
      ) : sesiones.length === 0 ? (
        <div className="ath-empty">
          {permiso ? "Sin sesiones visibles." : "No tienes permiso para ver sus sesiones."}
        </div>
      ) : (
        <>
          <div className="ath-metrics">
            {showDist7d && (
              <div className="metric aqua">
                <div className="metric-label">Metros (7d)</div>
                <div className="metric-value">
                  {fmtNum(kpis.dist7d)}
                  <span className="unit"> m</span>
                </div>
              </div>
            )}
            {showSes30 && (
              <div className="metric blue">
                <div className="metric-label">Sesiones (30d)</div>
                <div className="metric-value">{kpis.ses30d}</div>
              </div>
            )}
            {showRpe && (
              <div className="metric teal">
                <div className="metric-label">RPE prom</div>
                <div className="metric-value">{kpis.rpeProm.toFixed(1)}</div>
                <div className="rpe-bar">
                  <div className="rpe-fill" style={{ width: `${(kpis.rpeProm / 10) * 100}%` }} />
                </div>
              </div>
            )}
          </div>

          {(showTotalDist || showRitmo) && (
            <div className="ath-metrics soft">
              {showTotalDist && (
                <div className="metric softblue">
                  <div className="metric-label">Distancia total</div>
                  <div className="metric-value">
                    {fmtNum(kpis.totalDist)}
                    <span className="unit"> m</span>
                  </div>
                </div>
              )}
              {showRitmo && (
                <div className="metric softteal">
                  <div className="metric-label">Ritmo medio</div>
                  <div className="metric-value">{kpis.ritmoMedio}</div>
                </div>
              )}
            </div>
          )}

          {showSpark && (
            <div className="ath-spark">
              {kpis.spark.map((v, i) => (
                <div
                  key={i}
                  className="spark-bar"
                  style={{ height: `${Math.max(10, Math.round((v / kpis.maxSpark) * 100))}%` }}
                  title={`${v} m`}
                />
              ))}
              <div className="spark-caption">Últimas sesiones</div>
            </div>
          )}

          {kpis.recientes.length > 0 && (
            <div className="ath-last">
              <div className="ath-last-title">Últimas sesiones</div>
              <div className="ath-chips">
                {kpis.recientes.map((t) => {
                  const dist = t.tipo === "agua" ? distOf(t) : 0;
                  const label =
                    t.tipo === "agua"
                      ? `${fmtNum(dist)} m${t.ritmo100 ? ` · ${t.ritmo100}` : ""}`
                      : t.tipo || "sesión";
                  return (
                    <div key={t.id} className="chip" title={new Date(t.startMs || 0).toLocaleString("es-ES")}>
                      <span className="chip-date">
                        {new Date(t.startMs || 0).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })}
                      </span>
                      <span className="chip-label">{label}</span>
                      {Number(t.rpe) ? <span className="chip-rpe">RPE {t.rpe}</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ===================== Vista principal ===================== */
export default function VerEquipo() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const equipoId = params.get("equipo");

  const [coachUid, setCoachUid] = useState(null);
  const [miembros, setMiembros] = useState([]);
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(true);
  const [permisoEquipo, setPermisoEquipo] = useState(true);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => setCoachUid(u?.uid || null));
    return () => off();
  }, []);

  useEffect(() => {
    if (!equipoId) return;
    setLoading(true);
    setPermisoEquipo(true);

    (async () => {
      try {
        const ref = doc(db, "equipos", equipoId);
        const snap = await getDoc(ref);
        if (snap.exists()) setTeamName(snap.data()?.name || "");
        else setTeamName("");
      } catch {
        setPermisoEquipo(false);
        setTeamName("");
      }
    })();

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
      () => {
        setPermisoEquipo(false);
        setMiembros([]);
        setLoading(false);
      }
    );

    return () => off();
  }, [equipoId]);

  async function handleRemove(member) {
    if (!equipoId || !member?.uid) return;

    const result = await Swal.fire({
      title: "¿Eliminar nadador?",
      html: `¿Estás seguro de eliminar a "<b>${member.nombre || member.email}</b>" del equipo?
             <br><small>También se intentará quitar tu acceso a sus sesiones previas.</small>`,
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
        const docId = member.id || member.uid;
        try {
          setRemovingId(docId);
          await deleteDoc(doc(db, "equipos", equipoId, "nadadores", docId));

          try {
            if (coachUid) {
              const qy = query(
                collection(db, "usuarios", member.uid, "entrenamientos"),
                where("ownerIds", "array-contains", coachUid),
                limit(450)
              );
              const snap = await getDocs(qy);
              if (!snap.empty) {
                const batch = writeBatch(db);
                snap.forEach((d) => batch.update(d.ref, { ownerIds: arrayRemove(coachUid) }));
                await batch.commit();
              }
            }
          } catch (e) {
            console.warn("Revocar ownerIds falló:", e);
          }
        } catch {
          Swal.showValidationMessage("No se pudo completar la eliminación. Intenta de nuevo.");
          return false;
        } finally {
          setRemovingId(null);
        }
      },
      allowOutsideClick: () => !Swal.isLoading(),
    });

    if (result.isConfirmed) {
      Swal.fire({
        icon: "success",
        title: "Nadador eliminado",
        timer: 1600,
        showConfirmButton: false,
        buttonsStyling: false,
        customClass: { popup: "sw-popup" },
      });
    }
  }

  return (
    <div className="coach-page ocean-bg">
      {/* ⬇️ Contenedor centrado */}
      <div className="ocean-container">
        <section className="coach-head pretty-head">
          <div>
            <h2>👥 Miembros del equipo • {teamName || equipoId}</h2>
            <p className="sub">Vista general de rendimiento y últimas sesiones</p>
          </div>
          <div className="row-end">
            <button className="btn-ghost" onClick={() => navigate(`/InicioEntrenador?equipo=${equipoId}`)}>← Volver</button>
            <button className="btn-primary" onClick={() => navigate(`/AñadirNadadores?equipo=${equipoId}`)}>
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
          <div className="grid pretty-gridie">
            {miembros.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                coachUid={coachUid}
                onRemove={handleRemove}
                removing={removingId === m.id}
              />
            ))}
          </div>
        )}
      </div>
      {/* ⬆️ fin ocean-container */}
    </div>
  );
}
