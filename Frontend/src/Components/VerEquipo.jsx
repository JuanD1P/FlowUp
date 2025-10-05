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
function pacePer100Sec(mins, meters) {
  if (!mins || !meters) return Infinity;
  const per100 = mins / (meters / 100);
  return per100 * 60; // segundos por 100m
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
function avg(nums) {
  const v = nums.map(Number).filter((x) => Number.isFinite(x));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}
function mode(vals) {
  const v = vals.filter(Boolean);
  if (!v.length) return null;
  const map = new Map();
  v.forEach((x) => map.set(x, (map.get(x) || 0) + 1));
  let best = null,
    max = -1;
  map.forEach((count, key) => {
    if (count > max) {
      max = count;
      best = key;
    }
  });
  return best;
}
function shortDate(ms) {
  return new Date(ms || 0).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
  });
}
function longDate(ms) {
  return new Date(ms || 0).toLocaleString("es-ES");
}

/* ===================== Tarjeta de miembro ===================== */
function MemberCard({ member, coachUid, onRemove, removing }) {
  const [sesiones, setSesiones] = useState(null);
  const [permiso, setPermiso] = useState(true);

  useEffect(() => {
    if (!member?.uid || !coachUid) return;
    const col = collection(db, "usuarios", member.uid, "entrenamientos");
    const qy = query(col, where("ownerIds", "array-contains", coachUid), limit(100));
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
    const now = Date.now();

    const dist7d = agua
      .filter((x) => (x.startMs ?? 0) >= now - 7 * 864e5)
      .reduce((a, b) => a + distOf(b), 0);
    const ses30d = s.filter((x) => (x.startMs ?? 0) >= now - 30 * 864e5).length;

    const totalDist = agua.reduce((a, b) => a + distOf(b), 0);
    const totalMin = s.reduce((a, b) => a + (Number(b.duracionMin) || 0), 0);

    const ritmoMedio =
      totalDist > 0 && totalMin > 0 ? pace100Str(totalMin, totalDist) : "";

    const rpeProm =
      s.slice(0, 10).reduce((a, b) => a + (Number(b.rpe) || 0), 0) /
      Math.max(1, Math.min(10, s.length));

    const fcProm = avg(
      s
        .slice(0, 10)
        .map((x) =>
          Number.isFinite(Number(x.frecuenciaCardiaca))
            ? Number(x.frecuenciaCardiaca)
            : NaN
        )
    );

    const fatigaModa = mode(s.slice(0, 15).map((x) => x.fatiga));

    // Mejor ritmo y sesión más larga
    let bestPaceSec = Infinity;
    let bestPaceStr = "";
    let longestDist = 0;
    let longestId = null;

    s.forEach((x) => {
      const d = distOf(x);
      const t = Number(x.duracionMin) || 0;
      if (d > 0 && t > 0) {
        const sec = pacePer100Sec(t, d);
        if (sec < bestPaceSec) {
          bestPaceSec = sec;
          bestPaceStr = pace100Str(t, d);
        }
      }
      if (d > longestDist) {
        longestDist = d;
        longestId = x.id;
      }
    });

    // Últimas 8 distancias / duraciones para minicharts
    const sorted = s
      .slice()
      .sort((a, b) => (a.startMs || 0) - (b.startMs || 0)); // ascendente
    const last8Dist = sorted
      .slice(-8)
      .map((h) => (h.tipo === "agua" ? distOf(h) : 0));
    const last8Dur = sorted.slice(-8).map((h) => Number(h.duracionMin) || 0);
    const maxD = Math.max(1, ...last8Dist);
    const maxT = Math.max(1, ...last8Dur);

    const recientes = s
      .slice()
      .sort((a, b) => (b.startMs || 0) - (a.startMs || 0))
      .slice(0, 5);

    return {
      dist7d,
      ses30d,
      totalDist,
      totalMin,
      ritmoMedio,
      rpeProm: Number.isFinite(rpeProm) ? rpeProm : 0,
      fcProm: fcProm != null ? Math.round(fcProm) : null,
      fatigaModa,
      bestPaceStr,
      longest: { meters: longestDist, id: longestId },
      recent8: { dist: last8Dist, dur: last8Dur, maxD, maxT },
      recientes,
    };
  }, [sesiones]);

  const showDist7d = Number(kpis.dist7d) > 0;
  const showSes30 = Number(kpis.ses30d) > 0;
  const showRpe = Number(kpis.rpeProm) > 0;
  const showTotalDist = Number(kpis.totalDist) > 0;
  const showRitmo = Boolean(kpis.ritmoMedio);
  const showDur30 = Number(kpis.totalMin) > 0;
  const showFc = kpis.fcProm != null;
  const showBest = Boolean(kpis.bestPaceStr);
  const showLongest = Number(kpis.longest?.meters) > 0;

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

        {/* Botón eliminar */}
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
        <div className="skeleton" style={{ height: 140, marginTop: 8 }}>
          <div className="shimmer" />
        </div>
      ) : sesiones.length === 0 ? (
        <div className="ath-empty">
          {permiso ? "Sin sesiones visibles." : "No tienes permiso para ver sus sesiones."}
        </div>
      ) : (
        <>
          {/* KPIs fila 1 */}
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
            {showDur30 && (
              <div className="metric violet">
                <div className="metric-label">Duración total</div>
                <div className="metric-value">
                  {fmtNum(kpis.totalMin)}
                  <span className="unit"> min</span>
                </div>
              </div>
            )}
          </div>

          {/* KPIs fila 2 */}
          {(showTotalDist || showRitmo || showFc || kpis.fatigaModa || showBest || showLongest) && (
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
              {showFc && (
                <div className="metric softpink">
                  <div className="metric-label">FC prom (ult. 10)</div>
                  <div className="metric-value">
                    {kpis.fcProm}
                    <span className="unit"> bpm</span>
                  </div>
                </div>
              )}
              {kpis.fatigaModa && (
                <div className="metric softgray">
                  <div className="metric-label">Fatiga más común</div>
                  <div className="metric-value">{kpis.fatigaModa}</div>
                </div>
              )}
              {showBest && (
                <div className="metric softlime">
                  <div className="metric-label">Mejor ritmo</div>
                  <div className="metric-value">{kpis.bestPaceStr}</div>
                </div>
              )}
              {showLongest && (
                <div className="metric softgold">
                  <div className="metric-label">Sesión más larga</div>
                  <div className="metric-value">
                    {fmtNum(kpis.longest.meters)}
                    <span className="unit"> m</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Minicharts: dist / duración últimas 8 */}
          {(kpis.recent8.dist.some((v) => v > 0) || kpis.recent8.dur.some((v) => v > 0)) && (
            <div className="ath-spark2">
              <div className="spark-block">
                <div className="spark-title">Distancia (últimas 8)</div>
                <div className="spark-bars">
                  {kpis.recent8.dist.map((v, i) => (
                    <div
                      key={i}
                      className="spark-bar"
                      style={{ height: `${Math.max(10, Math.round((v / kpis.recent8.maxD) * 100))}%` }}
                      title={`${v} m`}
                    />
                  ))}
                </div>
              </div>
              <div className="spark-block">
                <div className="spark-title">Duración (últimas 8)</div>
                <div className="spark-bars alt">
                  {kpis.recent8.dur.map((v, i) => (
                    <div
                      key={i}
                      className="spark-bar"
                      style={{ height: `${Math.max(10, Math.round((v / kpis.recent8.maxT) * 100))}%` }}
                      title={`${v} min`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Últimas sesiones detalladas */}
          {kpis.recientes.length > 0 && (
            <div className="ath-last">
              <div className="ath-last-title">Últimas sesiones</div>
              <div className="ath-session-list">
                {kpis.recientes.slice(0, 3).map((t) => {
                  const dist = t.tipo === "agua" ? distOf(t) : 0;
                  const ritmo =
                    t.tipo === "agua" && dist > 0 && Number(t.duracionMin)
                      ? pace100Str(Number(t.duracionMin), dist)
                      : t.ritmo100 || "";
                  const fat = t.fatiga || "";
                  const hasBlocks = Array.isArray(t.bloques) && t.bloques.length > 0;

                  return (
                    <div key={t.id} className="ath-session-card" title={longDate(t.startMs)}>
                      <div className="as-head">
                        <span className={`badge ${t.tipo || "otro"}`}>{t.tipo || "otro"}</span>
                        <span className="as-date">{shortDate(t.startMs)}</span>
                        {t.lugar ? <span className="as-place">• {t.lugar}</span> : null}
                      </div>

                      <div className="as-grid">
                        <div className="kv">
                          <span>Duración</span>
                          <strong>{t.duracionMin ? `${t.duracionMin} min` : "—"}</strong>
                        </div>
                        <div className="kv">
                          <span>Metros</span>
                          <strong>{t.tipo === "agua" ? `${fmtNum(dist)} m` : "—"}</strong>
                        </div>
                        <div className="kv">
                          <span>Ritmo</span>
                          <strong>{ritmo || "—"}</strong>
                        </div>
                        <div className="kv">
                          <span>RPE</span>
                          <strong>{Number(t.rpe) ? t.rpe : "—"}</strong>
                        </div>
                        <div className="kv">
                          <span>FC</span>
                          <strong>
                            {Number.isFinite(Number(t.frecuenciaCardiaca))
                              ? `${t.frecuenciaCardiaca} bpm`
                              : "—"}
                          </strong>
                        </div>
                        <div className="kv">
                          <span>Fatiga</span>
                          <strong>{fat || "—"}</strong>
                        </div>
                      </div>

                      {t.notas ? <div className="as-notes">📝 {t.notas}</div> : null}

                      {hasBlocks && (
                        <details className="as-blocks">
                          <summary>Ver bloques</summary>
                          <ul>
                            {t.bloques.slice(0, 6).map((b, ix) => {
                              const tot = b.metrosTotales ?? b.series * b.metrosSerie;
                              const extra = [
                                b.minutos ? `${b.minutos} min` : "",
                                b.ritmo100 ? b.ritmo100 : "",
                              ]
                                .filter(Boolean)
                                .join(" · ");
                              return (
                                <li key={ix}>
                                  {b.estilo}: {b.series}×{b.metrosSerie} m = {tot} m
                                  {extra ? ` · ${extra}` : ""}
                                </li>
                              );
                            })}
                            {t.bloques.length > 6 ? (
                              <li className="muted">… y {t.bloques.length - 6} bloque(s) más</li>
                            ) : null}
                          </ul>
                        </details>
                      )}
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
    </div>
  );
}
