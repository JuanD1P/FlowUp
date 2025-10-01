import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/client";
import { doc, getDoc, collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import "./DOCSS/Recomendaciones.css";

/* ============== Helpers ============== */
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
function fmtKm(m) {
  if (!m) return "0 m";
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${m} m`;
}
function fmtMin(min) {
  if (min === null || min === undefined) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}

/* ============== Componente ============== */
export default function Recomendaciones() {
  const [uid, setUid] = useState("");
  const [perfil, setPerfil] = useState(null);
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fondo sólo en esta vista (clase para CSS)
  useEffect(() => {
    document.body.classList.add("page-reco");
    return () => document.body.classList.remove("page-reco");
  }, []);

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
      try {
        const ref = doc(db, "usuarios", u.uid);
        const snap = await getDoc(ref);
        setPerfil(snap.exists() ? snap.data() : { perfilCompleto: false, nadador: {} });

        const col = collection(db, "usuarios", u.uid, "entrenamientos");
        const qy = query(col, orderBy("startMs", "desc"), limit(30));

        unsubTrainings = onSnapshot(
          qy,
          (s) => {
            setSesiones(s.docs.map((d) => ({ id: d.id, ...d.data() })));
            setLoading(false);
          },
          () => setLoading(false)
        );
      } catch {
        setLoading(false);
      }
    });

    return () => {
      detachAuth && detachAuth();
      unsubTrainings && unsubTrainings();
    };
  }, []);

  /* ============== Contexto calculado ============== */
  const ctx = useMemo(() => {
    const d = perfil || {};
    const n = d.nadador || {};
    const imc = toIMC(n.alturaCm, n.pesoKg);

    const ult = sesiones[0];
    const agua = sesiones.filter((s) => s.tipo === "agua");

    const d7 = agua
      .filter((s) => between(s.startMs || 0, 7))
      .reduce((a, b) => a + (b.distanciaTotal || 0), 0);

    const dPrev7 = agua
      .filter((s) => between(s.startMs || 0, 14) && !between(s.startMs || 0, 7))
      .reduce((a, b) => a + (b.distanciaTotal || 0), 0);

    const ses7 = sesiones.filter((s) => between(s.startMs || 0, 7)).length;
    const ses30 = sesiones.filter((s) => between(s.startMs || 0, 30)).length;

    const rpeProm =
      sesiones.slice(0, 10).reduce((a, b) => a + (Number(b.rpe) || 0), 0) /
      Math.max(1, Math.min(10, sesiones.length));

    const rpeUlt = Number(ult?.rpe || 0);
    const fatUlt = ult?.fatiga || "";
    const tipoUlt = ult?.tipo || "";
    const distUlt = Number(ult?.distanciaTotal || 0);
    const durUlt = Number(ult?.duracionMin || 0);

    const peso = Number(n.pesoKg || 0) || null;

    // “más info”
    const diarioAgua = peso ? Math.round(peso * 30) : null; // ml/día base
    const protMin = peso ? Math.round(peso * 1.4) : null;   // g/día
    const protMax = peso ? Math.round(peso * 1.8) : null;   // g/día
    const carbBase = peso ? `${Math.round(peso * 3)}–${Math.round(peso * 5)} g/día` : null;
    const cafeinaSug = peso ? Math.round(peso * 3) : null;  // mg (si aplica)

    // edad aprox
    const edadAprox = (() => {
      const iso = n.fechaNacimiento;
      if (!iso) return null;
      const hoy = new Date();
      const dd = new Date(iso + "T00:00:00");
      let e = hoy.getFullYear() - dd.getFullYear();
      const m = hoy.getMonth() - dd.getMonth();
      if (m < 0 || (m === 0 && hoy.getDate() < dd.getDate())) e--;
      return e >= 0 && e < 130 ? e : null;
    })();

    return {
      nombre: d.nombre || "",
      categoria: n.categoria || "",
      objetivo: n.objetivoGeneral || "",
      edadAprox,
      fcReposo: Number(n.fcReposo || 0) || null,
      condiciones: (n.condicionesMedicas || "").toLowerCase(),
      imc,
      peso,
      ult,
      tipoUlt,
      distUlt,
      durUlt,
      d7,
      ses7,
      ses30,
      rpeProm: Number.isFinite(rpeProm) ? Number(rpeProm.toFixed(1)) : 0,
      rpeUlt,
      fatUlt,
      trendD7: pct(d7, dPrev7),
      hasPrev: dPrev7 > 0,
      diarioAgua,
      protMin,
      protMax,
      carbBase,
      cafeinaSug
    };
  }, [perfil, sesiones]);

  /* ============== Recomendaciones (3 por área mínimo) ============== */
  const cards = useMemo(() => {
    const tips = [];

    const heavyWeek   = ctx.d7 >= 8000 || ctx.ses7 >= 4 || ctx.rpeProm >= 7;
    const hardLast    = ctx.rpeUlt >= 8 || ctx.fatUlt === "Alta" || ctx.durUlt >= 75 || ctx.distUlt >= 2500;
    const imcLow      = ctx.imc !== null && ctx.imc < 18.5;
    const imcHigh     = ctx.imc !== null && ctx.imc >= 25 && ctx.imc < 30;
    const imcVeryHigh = ctx.imc !== null && ctx.imc >= 30;
    const isCompet    = ["competitivo", "elite", "máster", "master"].includes((ctx.categoria || "").toLowerCase());

    // variables auxiliares (una sola vez)
    const hasCardioCond = (ctx.condiciones || "").includes("hipertens") || (ctx.condiciones || "").includes("cardi");
    const highRestHR    = ctx.fcReposo && ctx.fcReposo >= 80;

    const ids = new Set();
    const push = (tip) => { if (!ids.has(tip.id)) { tips.push(tip); ids.add(tip.id); } };

    /* --- Alimentación (antes) --- */
    if (hardLast || heavyWeek || isCompet) {
      push({
        id: "pre-carb",
        area: "Alimentación (antes)",
        title: "Carga de carbohidratos previa",
        body: "En días exigentes consume 2–3 g/kg 3–4 h antes. Si falta ~1 h, snack ligero (~1 g/kg).",
        why: hardLast ? "Última sesión intensa" : heavyWeek ? "Semana con alta carga" : "Categoría competitiva",
        severity: "alta", badges: ["Carbohidratos", "Rendimiento"]
      });
    } else {
      push({
        id: "pre-ligera",
        area: "Alimentación (antes)",
        title: "Pre-entreno ligero",
        body: "Sesión moderada: fruta + yogurt o tostada con mermelada 60–90 min antes.",
        why: "Sesión moderada/ligera",
        severity: "media", badges: ["Ligero", "Energía rápida"]
      });
    }
    // Tip 2: cafeína (si procede)
    if (!hasCardioCond && !highRestHR) {
      push({
        id: "cafeina",
        area: "Alimentación (antes)",
        title: "Cafeína opcional",
        body: ctx.cafeinaSug
          ? `Si la toleras, 3 mg/kg ~45–60 min antes (~${ctx.cafeinaSug} mg). Evita si te causa nerviosismo o si entrenas tarde.`
          : "Si la toleras, 3 mg/kg ~45–60 min antes. Evítala si te causa nerviosismo o entrenas tarde.",
        why: "Puede mejorar la percepción de esfuerzo",
        severity: "media", badges: ["Cafeína", "Focus"]
      });
    }
    // Tip 3: evitar fibra/grasas altas
    push({
      id: "pre-evitar",
      area: "Alimentación (antes)",
      title: "Evita fibra/grasas altas",
      body: "En pre-entreno inmediato, evita fritos, legumbres y fibra alta para prevenir malestar gástrico.",
      why: "Mejor tolerancia en el agua",
      severity: "baja", badges: ["Digestión"]
    });

    /* --- Alimentación (después) --- */
    push({
      id: "post-janela",
      area: "Alimentación (después)",
      title: "Recuperación 1–3 h post",
      body: "≈1.0–1.2 g/kg CHO + 20–30 g proteína (arroz + pollo / sándwich + leche).",
      why: "Recarga de glucógeno y reparación",
      severity: hardLast ? "alta" : "media", badges: ["Carbohidratos", "Proteína"]
    });
    push({
      id: "post-proteina-dosis",
      area: "Alimentación (después)",
      title: "Distribuye proteína",
      body: "Apunta a ~0.3 g/kg por comida y 3–4 tomas al día para optimizar síntesis muscular.",
      why: "Recuperación muscular",
      severity: "media", badges: ["Proteína", "Timing"]
    });
    push({
      id: "post-rehidratacion",
      area: "Alimentación (después)",
      title: "Rehidratación post",
      body: "Bebe líquidos con algo de sodio en las 2–4 h post. Si sudas mucho, considera 150% del peso perdido.",
      why: "Restituir pérdidas",
      severity: "media", badges: ["Hidratación"]
    });

    /* --- Alimentación (ajuste) --- */
    if (imcLow) {
      push({
        id: "calorico-up",
        area: "Alimentación (ajuste)",
        title: "Aumenta densidad calórica",
        body: "Frutos secos, aceite de oliva, lácteos enteros y 1 colación extra.",
        why: "IMC bajo",
        severity: "media", badges: ["Energía", "Peso saludable"]
      });
    }
    if (imcHigh || imcVeryHigh) {
      push({
        id: "calorico-down",
        area: "Alimentación (ajuste)",
        title: "Control de porciones y fibra",
        body: "Verduras, proteína magra, integrales; planea snacks para evitar picos de hambre.",
        why: imcVeryHigh ? "IMC muy alto" : "IMC alto",
        severity: imcVeryHigh ? "alta" : "media", badges: ["Saciación", "Peso saludable"]
      });
    }
    push({
      id: "fibra-5x",
      area: "Alimentación (ajuste)",
      title: "Fibra y micronutrientes",
      body: "Apunta a 25–35 g de fibra/día y 5 porciones de frutas/verduras.",
      why: "Salud digestiva y saciedad",
      severity: "baja", badges: ["Fibra", "Micros"]
    });

    /* --- Hidratación --- */
    push({
      id: "hidratacion-base",
      area: "Hidratación",
      title: "Plan básico de líquidos",
      body: "400–600 ml 2 h antes. Durante: 150–250 ml cada 15–20 min.",
      why: "Base para rendimiento",
      severity: heavyWeek ? "media" : "baja", badges: ["Agua", "Plan"]
    });
    if (hardLast || ctx.durUlt >= 60 || ctx.d7 >= 10000) {
      push({
        id: "electrolitos",
        area: "Hidratación",
        title: "Incluye electrolitos",
        body: "En sesiones ≥60 min o semana alta, bebida con sodio ≈300–600 mg/L.",
        why: hardLast ? "Sesión larga/intensa" : "Volumen semanal alto",
        severity: "alta", badges: ["Electrolitos", "Resistencia"]
      });
    }
    push({
      id: "prueba-sudor",
      area: "Hidratación",
      title: "Prueba de sudoración",
      body: "Pésate antes/después (sin ropa mojada). Pérdida de 1 kg ≈ 1 L. Usa ese dato para ajustar tu plan.",
      why: "Personalizar hidratación",
      severity: "media", badges: ["Sudor", "Personalizado"]
    });

    /* --- Recuperación --- */
    push({
      id: "sueno",
      area: "Recuperación",
      title: "Sueño como pilar",
      body: "7–9 h. Si RPE prom ≥7, añade siesta 20–30 min.",
      why: ctx.rpeProm >= 7 ? "Carga percibida alta" : "Higiene del sueño",
      severity: ctx.rpeProm >= 7 ? "alta" : "media", badges: ["Sueño", "Hormesis"]
    });
    if (hardLast || ctx.fatUlt === "Alta") {
      push({
        id: "descarga-activa",
        area: "Recuperación",
        title: "Descarga activa + movilidad",
        body: "Al día siguiente: 15–30 min suaves + 10 min movilidad (hombro, cadera, T-spine).",
        why: "Fatiga alta / sesión exigente",
        severity: "alta", badges: ["Active recovery", "Movilidad"]
      });
    } else {
      push({
        id: "estiramientos",
        area: "Recuperación",
        title: "Rutina breve post-sesión",
        body: "3–5 estiramientos (20–30 s) pectoral, dorsal, tríceps, flexores cadera, gemelos.",
        why: "Mantenimiento de rango",
        severity: "baja", badges: ["Flexibilidad"]
      });
    }
    push({
      id: "foam-roll",
      area: "Recuperación",
      title: "Foam rolling",
      body: "8–10 min en dorsales, glúteos y gemelos post-sesión o en días suaves.",
      why: "Alivio miofascial",
      severity: "baja", badges: ["Rodillo", "Tejido blando"]
    });

    /* --- Salud --- */
    if (hasCardioCond || highRestHR) {
      push({
        id: "control-fc",
        area: "Salud",
        title: "Monitorea FC y signos",
        body: "Mide FC reposo al despertar. Si sube ≥10% varios días, reduce carga y prioriza sueño/hidratación.",
        why: hasCardioCond ? "Antecedente cardiovascular" : "FC reposo elevada",
        severity: "alta", badges: ["Vigilancia", "Autoregulación"]
      });
    }
    push({
      id: "hombro-sano",
      area: "Salud",
      title: "Hombros felices",
      body: "2×/sem: Y/T/W con banda (2×10) + rotadores externos (2×12).",
      why: "Prevención de sobreuso",
      severity: "baja", badges: ["Prevención", "Hombro"]
    });
    push({
      id: "chequeo",
      area: "Salud",
      title: "Chequeo anual",
      body: "Si compites o tienes antecedentes, realiza revisión médica anual y ECG si te lo indican.",
      why: "Seguridad",
      severity: "media", badges: ["Control", "Médico"]
    });

    /* --- Plan semanal --- */
    if (ctx.trendD7 > 20) {
      push({
        id: "progresion",
        area: "Plan semanal",
        title: "Cuida la progresión",
        body: "Aumentos ≤10–20% por semana, alternando días duros/suaves.",
        why: "Salto de carga 7d",
        severity: "media", badges: ["Progresión", "Prevención"]
      });
    }
    if ((ctx.objetivo || "").toLowerCase().includes("compet")) {
      push({
        id: "competitivo-finura",
        area: "Plan semanal",
        title: "Afinación para competir",
        body: "En semana de competencia: -20–40% volumen, mantén algo de intensidad, cuida CHO + sueño.",
        why: "Objetivo competitivo",
        severity: "media", badges: ["Taper", "Rendimiento"]
      });
    }
    push({
      id: "tecnica-15",
      area: "Plan semanal",
      title: "Técnica recurrente",
      body: "Añade 15 min de técnica 2–3×/sem (patada, alineación, agarre).",
      why: "Eficiencia en el agua",
      severity: "baja", badges: ["Técnica"]
    });
    push({
      id: "fuerza-seca",
      area: "Plan semanal",
      title: "Fuerza fuera del agua",
      body: "20–30 min/sem (bisagra cadera, tracción, empuje, core anti-rotación).",
      why: "Transferencia al nado",
      severity: "media", badges: ["Fuerza", "Core"]
    });

    /* --- Garantizar 3 por área --- */
    const REQUIRED = 3;
    const library = {
      "Alimentación (antes)": [
        { id:"pre-hidra", area:"Alimentación (antes)", title:"Pre-hidratación", body:"Llega hidratado: agua o bebida ligera 2 h antes.", why:"Soporte volumen plasmático", severity:"baja", badges:["Agua"] },
      ],
      "Alimentación (después)": [
        { id:"post-colacion30", area:"Alimentación (después)", title:"Colación 30–60 min", body:"Si no puedes comer pronto, usa batido lácteo/soya + fruta.", why:"Mantener ventana anabólica", severity:"media", badges:["Snack"] },
      ],
      "Alimentación (ajuste)": [
        { id:"meal-prep", area:"Alimentación (ajuste)", title:"Meal prep simple", body:"Planifica 2–3 bases (arroz/quinoa, pollo/huevo, ensalada).", why:"Adherencia", severity:"baja", badges:["Plan"] },
      ],
      "Hidratación": [
        { id:"orina-check", area:"Hidratación", title:"Chequeo de orina", body:"Color 1–3 claro: hidratación ok; 4–6: aumenta ingesta.", why:"Auto-monitoreo", severity:"baja", badges:["Check"] },
      ],
      "Recuperación": [
        { id:"respiracion46", area:"Recuperación", title:"Respiración 4–6", body:"5 min de exhalación larga para bajar tono simpático.", why:"Downregulation", severity:"baja", badges:["Estrés"] },
      ],
      "Salud": [
        { id:"dolor-escala", area:"Salud", title:"Escala de dolor", body:"Si dolor ≥5/10 al nadar, reduce volumen y consulta.", why:"Prevención empeoramiento", severity:"alta", badges:["Dolor"] },
      ],
      "Plan semanal": [
        { id:"dia-off", area:"Plan semanal", title:"Día OFF real", body:"1 día/sem sin cargas: sueño, paseo suave, ocio.", why:"Supercompensación", severity:"baja", badges:["Descanso"] },
      ]
    };

    const ensureMinByArea = (area) => {
      const current = tips.filter(t => t.area === area).length;
      const extras = library[area] || [];
      let i = 0;
      while (tips.filter(t => t.area === area).length < REQUIRED && i < extras.length) {
        push(extras[i]); i++;
      }
    };

    Object.keys(library).forEach(ensureMinByArea);

    return tips;
  }, [ctx]);

  /* Agrupar por área */
  const groups = useMemo(() => {
    const by = new Map();
    for (const c of cards) {
      if (!by.has(c.area)) by.set(c.area, []);
      by.get(c.area).push(c);
    }
    return Array.from(by.entries());
  }, [cards]);

  /* ============== UI ============== */
  if (loading) {
    return (
      <div className="rc-page rc-page--bg">
        <div className="rc-wrap">
          <div className="rc-skel rc-head" />
          <div className="rc-skel rc-card" />
          <div className="rc-skel rc-card" />
        </div>
      </div>
    );
  }

  const trend = ctx.hasPrev ? Math.round(ctx.trendD7) : 0;
  const trendClass = trend > 0 ? "up" : trend < 0 ? "down" : "flat";

  return (
    <div className="rc-page rc-page--bg">
      <div className="rc-wrap">
        {/* HERO / HEADER */}
        <header className="rc-header glass">
          <div className="rc-title">
            <h1>Recomendaciones personalizadas</h1>
            <p>
              {ctx.nombre ? <strong>{ctx.nombre}</strong> : "Tu"} · {ctx.categoria || "—"}
              {ctx.objetivo ? <> · Objetivo: <em>{ctx.objetivo}</em></> : null}
              {ctx.edadAprox ? <> · {ctx.edadAprox} años</> : null}
            </p>
          </div>

          <div className="rc-stats">
            <div className="rc-kv glass-mini">
              <span>Volumen 7d</span>
              <strong>{fmtKm(ctx.d7)}</strong>
              {ctx.hasPrev && (
                <span className={`rc-trend ${trendClass}`}>
                  {trend > 0 ? `+${trend}%` : `${trend}%`}
                </span>
              )}
            </div>
            <div className="rc-kv glass-mini">
              <span>Sesiones 7d / 30d</span>
              <strong>{ctx.ses7} / {ctx.ses30}</strong>
            </div>
            <div className="rc-kv glass-mini">
              <span>RPE prom (10)</span>
              <strong>{ctx.rpeProm}</strong>
            </div>
            {ctx.imc !== null && (
              <div className="rc-kv glass-mini">
                <span>IMC</span>
                <strong>{ctx.imc}</strong>
              </div>
            )}
          </div>
        </header>

        {/* RESUMEN RÁPIDO */}
        <section className="rc-quick">
          <div className="rc-card rc-sum glass">
            <div className="rc-card-head">
              <h3>Última sesión</h3>
            </div>
            <div className="rc-sum-grid">
              <div><span>Tipo</span><strong>{ctx.tipoUlt || "—"}</strong></div>
              <div><span>Distancia</span><strong>{fmtKm(ctx.distUlt)}</strong></div>
              <div><span>Duración</span><strong>{fmtMin(ctx.durUlt)}</strong></div>
              <div><span>RPE</span><strong>{ctx.rpeUlt || "—"}</strong></div>
              <div><span>Fatiga</span><strong>{ctx.fatUlt || "—"}</strong></div>
            </div>
          </div>

          <div className="rc-card rc-sum glass">
            <div className="rc-card-head">
              <h3>Tu línea base</h3>
            </div>
            <div className="rc-sum-grid">
              <div><span>Peso</span><strong>{ctx.peso ? `${ctx.peso} kg` : "—"}</strong></div>
              <div><span>Hidratación diaria</span><strong>{ctx.diarioAgua ? `${ctx.diarioAgua} ml` : "—"}</strong></div>
              <div><span>Proteína</span><strong>{ctx.protMin && ctx.protMax ? `${ctx.protMin}–${ctx.protMax} g/día` : "—"}</strong></div>
              <div><span>Carbohidratos</span><strong>{ctx.carbBase || "—"}</strong></div>
              {!((ctx.condiciones||"").includes("hipertens") || (ctx.condiciones||"").includes("cardi")) && (
                <div><span>Cafeína (opcional)</span><strong>{ctx.cafeinaSug ? `${ctx.cafeinaSug} mg` : "≈3 mg/kg"}</strong></div>
              )}
            </div>
          </div>
        </section>

        {/* RECOMENDACIONES */}
        {groups.length === 0 ? (
          <div className="rc-empty glass">
            <p>No hay recomendaciones por ahora. Registra algunas sesiones para generarlas ✨</p>
          </div>
        ) : (
          groups.map(([area, arr]) => (
            <section key={area} className="rc-section">
              <h2 className="rc-area">{area}</h2>
              <div className="rc-grid">
                {arr.map((c) => (
                  <article key={c.id} className={`rc-card sev-${c.severity} glass`}>
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
          ))
        )}

        <footer className="rc-foot">
          <p className="rc-note">
            Estos consejos son generales y no sustituyen la guía de un profesional de salud o nutrición.
          </p>
        </footer>
      </div>
    </div>
  );
}
