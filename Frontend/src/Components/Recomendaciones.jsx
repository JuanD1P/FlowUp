import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/client";
import { doc, getDoc, collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import "./DOCSS/Recomendaciones.css";

function between(ts, days) {
  const now = Date.now();
  return ts >= now - days * 86400000 && ts <= now + 1;
}
function toIMC(alturaCm, pesoKg) {
  const h = parseFloat(alturaCm);
  const p = parseFloat(pesoKg);
  if (!h || !p) return null;
  const m = h / 100;
  const val = p / (m * m);
  return Number.isFinite(val) ? Number(val.toFixed(1)) : null;
}
function pct(a, b) {
  if (!b) return 0;
  return ((a - b) / b) * 100;
}

export default function Recomendaciones() {
  const [uid, setUid] = useState("");
  const [perfil, setPerfil] = useState(null);
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubTrainings = null;
    const detachAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUid("");
        setPerfil(null);
        setSesiones([]);
        setLoading(false);
        if (unsubTrainings) {
          unsubTrainings();
          unsubTrainings = null;
        }
        return;
      }
      setUid(u.uid);
      const ref = doc(db, "usuarios", u.uid);
      const snap = await getDoc(ref);
      setPerfil(snap.exists() ? snap.data() : { perfilCompleto: false, nadador: {} });
      const col = collection(db, "usuarios", u.uid, "entrenamientos");
      const qy = query(col, orderBy("startMs", "desc"), limit(30));
      unsubTrainings = onSnapshot(qy, (s) => {
        setSesiones(s.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });
    });
    return () => {
      detachAuth && detachAuth();
      unsubTrainings && unsubTrainings();
    };
  }, []);

  const ctx = useMemo(() => {
    const d = perfil || {};
    const n = d.nadador || {};
    const imc = toIMC(n.alturaCm, n.pesoKg);
    const ult = sesiones[0];
    const agua = sesiones.filter((s) => s.tipo === "agua");
    const d7 = agua.filter((s) => between(s.startMs || 0, 7)).reduce((a, b) => a + (b.distanciaTotal || 0), 0);
    const dPrev7 = agua.filter((s) => between(s.startMs || 0, 14) && !between(s.startMs || 0, 7)).reduce((a, b) => a + (b.distanciaTotal || 0), 0);
    const ses7 = sesiones.filter((s) => between(s.startMs || 0, 7)).length;
    const ses30 = sesiones.filter((s) => between(s.startMs || 0, 30)).length;
    const rpeProm = sesiones.slice(0, 10).reduce((a, b) => a + (Number(b.rpe) || 0), 0) / Math.max(1, Math.min(10, sesiones.length));
    const rpeUlt = Number(ult?.rpe || 0);
    const fatUlt = ult?.fatiga || "";
    const tipoUlt = ult?.tipo || "";
    const distUlt = Number(ult?.distanciaTotal || 0);
    const durUlt = Number(ult?.duracionMin || 0);
    return {
      nombre: d.nombre || "",
      categoria: n.categoria || "",
      edadAprox: (() => {
        const iso = n.fechaNacimiento;
        if (!iso) return null;
        const hoy = new Date();
        const dd = new Date(iso + "T00:00:00");
        let e = hoy.getFullYear() - dd.getFullYear();
        const m = hoy.getMonth() - dd.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < dd.getDate())) e--;
        return e >= 0 && e < 130 ? e : null;
      })(),
      fcReposo: Number(n.fcReposo || 0) || null,
      condiciones: (n.condicionesMedicas || "").toLowerCase(),
      objetivo: n.objetivoGeneral || "",
      imc,
      ult,
      d7,
      ses7,
      ses30,
      rpeProm: Number.isFinite(rpeProm) ? Number(rpeProm.toFixed(1)) : 0,
      rpeUlt,
      fatUlt,
      tipoUlt,
      distUlt,
      durUlt,
      trendD7: pct(d7, dPrev7)
    };
  }, [perfil, sesiones]);

  const cards = useMemo(() => {
    const tips = [];
    const heavyWeek = ctx.d7 >= 8000 || ctx.ses7 >= 4 || ctx.rpeProm >= 7;
    const hardLast = ctx.rpeUlt >= 8 || ctx.fatUlt === "Alta" || ctx.durUlt >= 75 || ctx.distUlt >= 2500;
    const imcLow = ctx.imc !== null && ctx.imc < 18.5;
    const imcHigh = ctx.imc !== null && ctx.imc >= 25 && ctx.imc < 30;
    const imcVeryHigh = ctx.imc !== null && ctx.imc >= 30;
    const isCompet = ["competitivo", "elite", "máster", "master"].includes((ctx.categoria || "").toLowerCase());
    const hasCardioCond = ctx.condiciones.includes("hipertens") || ctx.condiciones.includes("cardi");
    const highRestHR = ctx.fcReposo && ctx.fcReposo >= 80;
    if (hardLast || heavyWeek || isCompet) {
      tips.push({ id: "pre-carb", area: "Alimentación (antes)", title: "Carga de carbohidratos previa", body: "En días exigentes consume 2–3 g/kg de carbohidratos entre 3–4 h antes. Si falta 1 h, toma un snack ligero (~1 g/kg) de fácil digestión.", why: hardLast ? "Última sesión intensa" : heavyWeek ? "Semana con alta carga" : "Categoría competitiva", severity: "alta", badges: ["Carbohidratos", "Rendimiento"] });
    } else {
      tips.push({ id: "pre-ligera", area: "Alimentación (antes)", title: "Pre-entreno ligero", body: "Si tu sesión es moderada, opta por fruta + yogurt o tostada con mermelada 60–90 min antes para llegar con energía, sin pesadez.", why: "Sesión moderada/ligera", severity: "media", badges: ["Ligero", "Energía rápida"] });
    }
    tips.push({ id: "post-janela", area: "Alimentación (después)", title: "Recuperación 1–3 h post", body: "Apunta a ~1.0–1.2 g/kg de carbohidratos + 20–30 g de proteína en las 1–3 h posteriores (ej. arroz + pollo, sándwich de pavo + leche).", why: "Optimiza recarga de glucógeno y reparación muscular", severity: hardLast ? "alta" : "media", badges: ["Carbohidratos", "Proteína"] });
    if (imcLow) {
      tips.push({ id: "calorico-up", area: "Alimentación (ajuste)", title: "Aumenta densidad calórica", body: "Añade frutos secos, aceite de oliva, lácteos enteros y 1 colación extra al día para sostener la carga sin perder peso.", why: "IMC bajo", severity: "media", badges: ["Energía", "Peso saludable"] });
    }
    if (imcHigh || imcVeryHigh) {
      tips.push({ id: "calorico-down", area: "Alimentación (ajuste)", title: "Control de porciones y fibra", body: "Prioriza verduras, proteína magra y cereales integrales; planifica snacks para evitar picos de hambre post-entreno.", why: imcVeryHigh ? "IMC muy alto" : "IMC alto", severity: imcVeryHigh ? "alta" : "media", badges: ["Saciación", "Peso saludable"] });
    }
    tips.push({ id: "hidratacion-base", area: "Hidratación", title: "Plan básico de líquidos", body: "Bebe 400–600 ml 2 h antes. Durante la sesión, 150–250 ml cada 15–20 min (ajusta según sudoración y duración).", why: "Requisito base para rendimiento", severity: heavyWeek ? "media" : "baja", badges: ["Agua", "Plan"] });
    if (hardLast || ctx.durUlt >= 60 || ctx.d7 >= 10000) {
      tips.push({ id: "electrolitos", area: "Hidratación", title: "Incluye sodio/electrolitos", body: "En sesiones ≥60 min o semanas altas, usa bebida con sodio (≈300–600 mg/L). Ayuda a sostener ritmo y evita calambres.", why: hardLast ? "Última sesión larga/intensa" : "Volumen semanal alto", severity: "alta", badges: ["Electrolitos", "Resistencia"] });
    }
    tips.push({ id: "sueno", area: "Recuperación", title: "Sueño como pilar", body: "Apunta a 7–9 h. Si tu RPE promedio ≥7, agrega siesta breve (20–30 min) o tiempo de relax para bajar la carga sistémica.", why: ctx.rpeProm >= 7 ? "Carga percibida alta sostenida" : "Higiene del sueño", severity: ctx.rpeProm >= 7 ? "alta" : "media", badges: ["Sueño", "Hormesis"] });
    if (hardLast || ctx.fatUlt === "Alta") {
      tips.push({ id: "descarga-activa", area: "Recuperación", title: "Descarga activa + movilidad", body: "Al día siguiente, 15–30 min suaves (caminar/bici ligera) + 10 min de movilidad de hombro, cadera y columna torácica.", why: "Fatiga alta / sesión exigente", severity: "alta", badges: ["Active recovery", "Movilidad"] });
    } else {
      tips.push({ id: "estiramientos", area: "Recuperación", title: "Rutina breve post-sesión", body: "3–5 estiramientos sostenidos (20–30 s) para pectoral, dorsal, tríceps, flexores de cadera y gastrocnemios.", why: "Mantenimiento de rango funcional", severity: "baja", badges: ["Flexibilidad"] });
    }
    if (hasCardioCond || highRestHR) {
      tips.push({ id: "control-fc", area: "Salud", title: "Monitorea FC y signos", body: "Registra tu FC en reposo al despertar. Si aumenta ≥10% varios días, reduce carga y prioriza sueño/hidratación.", why: hasCardioCond ? "Antecedente cardiovascular" : "FC en reposo elevada", severity: "alta", badges: ["Vigilancia", "Autoregulación"] });
    }
    if (ctx.trendD7 > 20) {
      tips.push({ id: "progresion", area: "Plan semanal", title: "Cuida la progresión", body: "Tu volumen de 7d subió rápido. Mantén aumentos ≤10–20% por semana y alterna días duros/suaves.", why: "Salto de carga semanal", severity: "media", badges: ["Progresión", "Prevención"] });
    }
    if ((ctx.objetivo || "").toLowerCase().includes("compet")) {
      tips.push({ id: "competitivo-finura", area: "Plan semanal", title: "Afinación para competir", body: "En semanas de competencia, reduce volumen 20–40%, mantén algo de intensidad, y cuida carbohidratos + sueño.", why: "Objetivo competitivo", severity: "media", badges: ["Taper", "Rendimiento"] });
    }
    return tips;
  }, [ctx]);

  const groups = useMemo(() => {
    const by = new Map();
    for (const c of cards) {
      if (!by.has(c.area)) by.set(c.area, []);
      by.get(c.area).push(c);
    }
    return Array.from(by.entries());
  }, [cards]);

  if (loading) {
    return (
      <div className="rc-wrap">
        <div className="rc-skel rc-head" />
        <div className="rc-skel rc-card" />
        <div className="rc-skel rc-card" />
      </div>
    );
  }

  return (
    <div className="rc-wrap">
      <header className="rc-header">
        <div>
          <h1>LAURAAAAAAAAAAAAAAAAAAAAAA</h1>
          <p>ESTA PARTE QUE DIOS TE VENDIGA SJDJASDJSDJ AHI HICE UN POQUITO PERO SI ES MALUQUITA ME AVSAS CUALQUIER COSA</p>
        </div>
        <div className="rc-stats">
          <div className="rc-kv">
            <span>Metros 7 días</span>
            <strong>{ctx.d7} m</strong>
          </div>
          <div className="rc-kv">
            <span>Sesiones 7d / 30d</span>
            <strong>{ctx.ses7} / {ctx.ses30}</strong>
          </div>
          <div className="rc-kv">
            <span>RPE prom (10)</span>
            <strong>{ctx.rpeProm}</strong>
          </div>
          {ctx.imc !== null && (
            <div className="rc-kv">
              <span>IMC</span>
              <strong>{ctx.imc}</strong>
            </div>
          )}
        </div>
      </header>
      {groups.map(([area, arr]) => (
        <section key={area} className="rc-section">
          <h2 className="rc-area">{area}</h2>
          <div className="rc-grid">
            {arr.map((c) => (
              <article key={c.id} className={`rc-card sev-${c.severity}`}>
                <div className="rc-card-head">
                  <h3>{c.title}</h3>
                  <div className="rc-badges">
                    {c.badges?.map((b) => <span key={b} className="rc-badge">{b}</span>)}
                  </div>
                </div>
                <p className="rc-body">{c.body}</p>
                <div className="rc-why"><span className="rc-dot" /><em>{c.why}</em></div>
              </article>
            ))}
          </div>
        </section>
      ))}
      <footer className="rc-foot">
        <p className="rc-note">Estos consejos son de carácter general y no sustituyen la guía de un profesional de salud o nutrición.</p>
      </footer>
    </div>
  );
}
