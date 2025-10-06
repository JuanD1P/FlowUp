import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/client";
import { doc, getDoc, collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import "./DOCSS/Recomendaciones.css";
import { FiCoffee, FiClock, FiSliders, FiDroplet, FiMoon, FiHeart, FiCalendar } from "react-icons/fi";

/* ================= Helpers ================= */
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

/* ================= UI por área ================= */
const AREA_UI = {
  "Alimentación (antes)":   { icon: <FiCoffee/>,  theme: "area-food-before" },
  "Alimentación (después)": { icon: <FiClock/>,   theme: "area-food-after" },
  "Alimentación (ajuste)":  { icon: <FiSliders/>, theme: "area-food-adjust" },
  "Hidratación":            { icon: <FiDroplet/>, theme: "area-hydration" },
  "Recuperación":           { icon: <FiMoon/>,    theme: "area-recovery" },
  "Salud":                  { icon: <FiHeart/>,   theme: "area-health" },
  "Plan semanal":           { icon: <FiCalendar/>,theme: "area-plan" }
};
const uiFor = (area) => AREA_UI[area] || { icon: <FiCalendar/>, theme: "area-default" };

/* ================= Componente ================= */
export default function Recomendaciones() {
  const [uid, setUid] = useState("");
  const [perfil, setPerfil] = useState(null);
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fondo sólo en esta vista
  useEffect(() => {
    document.body.classList.add("page-reco");
    return () => document.body.classList.remove("page-reco");
  }, []);

  // Cargar perfil + entrenos
  useEffect(() => {
    let unsubTrainings = null;

    const detachAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUid("");
        setPerfil(null);
        setSesiones([]);
        setLoading(false);
        if (unsubTrainings) { unsubTrainings(); unsubTrainings = null; }
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

  /* ================= Contexto calculado ================= */
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

    const diarioAgua = peso ? Math.round(peso * 30) : null;
    const protMin = peso ? Math.round(peso * 1.4) : null;
    const protMax = peso ? Math.round(peso * 1.8) : null;
    const carbBase = peso ? `${Math.round(peso * 3)}–${Math.round(peso * 5)} g/día` : null;
    const cafeinaSug = peso ? Math.round(peso * 3) : null;

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

  /* ================= Reglas -> Personalizadas vs Generales ================= */
  const { personalCards, generalCards } = useMemo(() => {
    const personals = [];
    const generals = [];
    const tips = [];

    const heavyWeek   = ctx.d7 >= 8000 || ctx.ses7 >= 4 || ctx.rpeProm >= 7;
    const hardLast    = ctx.rpeUlt >= 8 || ctx.fatUlt === "Alta" || ctx.durUlt >= 75 || ctx.distUlt >= 2500;
    const imcLow      = ctx.imc !== null && ctx.imc < 18.5;
    const imcHigh     = ctx.imc !== null && ctx.imc >= 25 && ctx.imc < 30;
    const imcVeryHigh = ctx.imc !== null && ctx.imc >= 30;
    const isCompet    = ["competitivo", "elite", "máster", "master", "alto", "altorendimiento"].includes((ctx.categoria || "").toLowerCase());

    const cond = (ctx.condiciones || "").toLowerCase();
    const hasCardioCond = cond.includes("hipertens") || cond.includes("cardi");
    const highRestHR    = ctx.fcReposo && ctx.fcReposo >= 80;

    const hasHombro  = cond.includes("hombro") || cond.includes("manguito") || cond.includes("tendinitis");
    const hasEspalda = cond.includes("espalda") || cond.includes("lumbar")  || cond.includes("cintura");
    const hasRodilla = cond.includes("rodilla") || cond.includes("menisco") || cond.includes("ligamento");

    const ids = new Set();
    const push = (tip, personalized = false) => {
      if (ids.has(tip.id)) return;
      ids.add(tip.id);
      (personalized ? personals : generals).push(tip);
      tips.push(tip);
    };

    /* ---- Personalizadas ---- */
    if ((ctx.objetivo || "").toLowerCase().includes("bajar peso")) {
      push({ id:"objetivo-peso", area:"Alimentación (ajuste)", title:"Enfoque para bajar peso",
        body:"Verduras y proteína magra como base, +fibra y control de porciones. Evita bebidas azucaradas y ultraprocesados.",
        why:"Objetivo: bajar peso", severity:"alta", badges:["Peso","Nutrición"] }, true);
    }
    if ((ctx.objetivo || "").toLowerCase().includes("mejorar resistencia")) {
      push({ id:"objetivo-resistencia", area:"Plan semanal", title:"Mejora tu resistencia",
        body:"Incluye 1 sesión larga progresiva semanal. Aumenta volumen gradualmente y cuida la técnica.",
        why:"Objetivo: mejorar resistencia", severity:"media", badges:["Resistencia","Progresión"] }, true);
    }
    if ((ctx.objetivo || "").toLowerCase().includes("compet")) {
      push({ id:"objetivo-competir", area:"Plan semanal", title:"Preparación para competir",
        body:"En semanas previas, baja volumen manteniendo algo de intensidad. Prioriza descanso y nutrición.",
        why:"Objetivo: competir", severity:"alta", badges:["Competencia","Taper"] }, true);
    }

    if (ctx.edadAprox && ctx.edadAprox >= 40) {
      push({ id:"edad-mayor", area:"Salud", title:"Cuida tus articulaciones",
        body:"Movilidad + fuerza 2×/sem. Prioriza recuperación y chequeos regulares.",
        why:"Edad ≥40 años", severity:"media", badges:["Articulaciones","Prevención"] }, true);
    }
    if (ctx.edadAprox && ctx.edadAprox <= 18) {
      push({ id:"edad-joven", area:"Plan semanal", title:"Desarrollo integral",
        body:"Enfócate en técnica y variedad; evita sobrecarga. Mantén la diversión.",
        why:"Edad ≤18 años", severity:"media", badges:["Juvenil","Técnica"] }, true);
    }

    if (ctx.hasPrev && ctx.trendD7 < -15) {
      push({ id:"progresion-negativa", area:"Plan semanal", title:"Detecta retrocesos",
        body:"Si tu volumen baja >15%, revisa descanso/motivación/salud. Ajusta el plan y consulta si persiste.",
        why:"Retroceso en progresión", severity:"alta", badges:["Progresión","Prevención"] }, true);
    }
    if (ctx.hasPrev && ctx.trendD7 > 20) {
      push({ id:"progresion-positiva", area:"Plan semanal", title:"Aumentos controlados",
        body:"Si aumentas >20%, alterna días suaves y monitorea fatiga.",
        why:"Aumento rápido de carga", severity:"media", badges:["Progresión","Carga"] }, true);
    }

    if (hasHombro) {
      push({ id:"lesion-hombro", area:"Salud", title:"Cuida tus hombros",
        body:"Reduce volumen de crol si duele. Técnica de agarre, evita empujes por encima de la cabeza; rotadores externos (2×12).",
        why:"Antecedente de hombro", severity:"alta", badges:["Hombro","Prevención"] }, true);
    }
    if (hasEspalda) {
      push({ id:"lesion-espalda", area:"Salud", title:"Zona media protegida",
        body:"Evita hiperextensiones prolongadas (mariposa intensa). Core anti-extensión/anti-rotación 2×/sem; movilidad T-spine.",
        why:"Antecedente lumbar/dorsal", severity:"media", badges:["Espalda","Core"] }, true);
    }
    if (hasRodilla) {
      push({ id:"lesion-rodilla", area:"Salud", title:"Patada con criterio",
        body:"Modera braza si molesta. Aletas suaves con énfasis en cadera. Fortalece glúteo medio.",
        why:"Antecedente en rodilla", severity:"media", badges:["Rodilla","Técnica"] }, true);
    }
    if (hasCardioCond || highRestHR) {
      push({ id:"control-fc", area:"Salud", title:"Monitorea FC y signos",
        body:"Mide FC de reposo al despertar. Si sube ≥10% varios días, reduce carga y prioriza sueño/hidratación.",
        why: hasCardioCond ? "Antecedente cardiovascular" : "FC reposo elevada",
        severity:"alta", badges:["Vigilancia","Autoregulación"] }, true);
    }

    if (imcLow) {
      push({ id:"calorico-up", area:"Alimentación (ajuste)", title:"Aumenta densidad calórica",
        body:"Frutos secos, aceite de oliva, lácteos enteros y 1 colación extra.",
        why:"IMC bajo", severity:"media", badges:["Energía","Peso saludable"] }, true);
    }
    if (imcHigh || imcVeryHigh) {
      push({ id:"calorico-down", area:"Alimentación (ajuste)", title:"Control de porciones y fibra",
        body:"Verduras, proteína magra, integrales; planea snacks para evitar picos de hambre.",
        why: imcVeryHigh ? "IMC muy alto" : "IMC alto",
        severity: imcVeryHigh ? "alta" : "media", badges:["Saciación","Peso saludable"] }, true);
    }

    /* ---- Generales ---- */
    if (hardLast || heavyWeek || isCompet) {
      push({ id:"pre-carb", area:"Alimentación (antes)", title:"Carga de carbohidratos previa",
        body:"Días exigentes: 2–3 g/kg 3–4 h antes (o ~1 g/kg si falta ~1 h).",
        why: hardLast ? "Última sesión intensa" : (heavyWeek ? "Semana con alta carga" : "Categoría competitiva"),
        severity:"alta", badges:["Carbohidratos","Rendimiento"] });
    } else {
      push({ id:"pre-ligera", area:"Alimentación (antes)", title:"Pre-entreno ligero",
        body:"Fruta + yogurt o tostada con mermelada 60–90 min antes.",
        why:"Sesión moderada/ligera", severity:"media", badges:["Ligero","Energía rápida"] });
    }
    if (!hasCardioCond && !highRestHR) {
      push({ id:"cafeina", area:"Alimentación (antes)", title:"Cafeína opcional",
        body: ctx.cafeinaSug
          ? `Si la toleras, 3 mg/kg ~45–60 min antes (~${ctx.cafeinaSug} mg). Evítala si te altera o entrenas tarde.`
          : "Si la toleras, 3 mg/kg ~45–60 min antes. Evítala si te altera o entrenas tarde.",
        why:"Puede mejorar la percepción de esfuerzo", severity:"media", badges:["Cafeína","Focus"] });
    }
    push({ id:"pre-evitar", area:"Alimentación (antes)", title:"Evita fibra/grasas altas",
      body:"En el pre inmediato, evita fritos/legumbres/fibra alta para prevenir malestar gástrico.",
      why:"Mejor tolerancia en el agua", severity:"baja", badges:["Digestión"] });

    push({ id:"post-janela", area:"Alimentación (después)", title:"Recuperación 1–3 h post",
      body:"≈1.0–1.2 g/kg CHO + 20–30 g proteína (arroz+pollo / sándwich+leche).",
      why:"Recarga de glucógeno y reparación", severity: hardLast ? "alta" : "media", badges:["Carbohidratos","Proteína"] });
    push({ id:"post-proteina-dosis", area:"Alimentación (después)", title:"Distribuye proteína",
      body:"≈0.3 g/kg por comida, 3–4 tomas al día.",
      why:"Recuperación", severity:"media", badges:["Proteína","Timing"] });
    push({ id:"post-rehidratacion", area:"Alimentación (después)", title:"Rehidratación post",
      body:"Líquidos con sodio en 2–4 h post. Si sudas mucho, considera 150% del peso perdido.",
      why:"Restituir pérdidas", severity:"media", badges:["Hidratación"] });

    push({ id:"hidratacion-base", area:"Hidratación", title:"Plan básico de líquidos",
      body:"400–600 ml 2 h antes. Durante: 150–250 ml cada 15–20 min.",
      why:"Base para rendimiento", severity: heavyWeek ? "media" : "baja", badges:["Agua","Plan"] });
    if (hardLast || ctx.durUlt >= 60 || ctx.d7 >= 10000) {
      push({ id:"electrolitos", area:"Hidratación", title:"Incluye electrolitos",
        body:"Sesiones ≥60 min o semana alta: bebida con sodio ≈300–600 mg/L.",
        why: hardLast ? "Sesión larga/intensa" : "Volumen semanal alto",
        severity:"alta", badges:["Electrolitos","Resistencia"] });
    }
    push({ id:"prueba-sudor", area:"Hidratación", title:"Prueba de sudoración",
      body:"Pésate antes/después (sin ropa mojada). 1 kg ≈ 1 L. Ajusta con ese dato.",
      why:"Personalizar hidratación", severity:"media", badges:["Sudor","Personalizado"] });

    push({ id:"sueno", area:"Recuperación", title:"Sueño como pilar",
      body:"7–9 h. Si RPE prom ≥7, añade siesta 20–30 min.",
      why: ctx.rpeProm >= 7 ? "Carga percibida alta" : "Higiene del sueño",
      severity: ctx.rpeProm >= 7 ? "alta" : "media", badges:["Sueño","Hormesis"] });
    if (hardLast || ctx.fatUlt === "Alta") {
      push({ id:"descarga-activa", area:"Recuperación", title:"Descarga activa + movilidad",
        body:"Al día siguiente: 15–30 min suaves + 10 min movilidad (hombro, cadera, T-spine).",
        why:"Fatiga alta / sesión exigente", severity:"alta", badges:["Active recovery","Movilidad"] });
    } else {
      push({ id:"estiramientos", area:"Recuperación", title:"Rutina breve post-sesión",
        body:"3–5 estiramientos (20–30 s) pectoral, dorsal, tríceps, flexores cadera, gemelos.",
        why:"Mantenimiento de rango", severity:"baja", badges:["Flexibilidad"] });
    }
    push({ id:"foam-roll", area:"Recuperación", title:"Foam rolling",
      body:"8–10 min en dorsales, glúteos y gemelos post-sesión o en días suaves.",
      why:"Alivio miofascial", severity:"baja", badges:["Rodillo","Tejido blando"] });

    push({ id:"hombro-sano", area:"Salud", title:"Hombros felices",
      body:"2×/sem: Y/T/W con banda (2×10) + rotadores externos (2×12).",
      why:"Prevención de sobreuso", severity:"baja", badges:["Prevención","Hombro"] });
    push({ id:"chequeo", area:"Salud", title:"Chequeo anual",
      body:"Si compites o tienes antecedentes, revisión médica anual y ECG si te lo indican.",
      why:"Seguridad", severity:"media", badges:["Control","Médico"] });

    /* ---- Garantizar mínimo por área (en ambos bloques) ---- */
    const REQUIRED = 3;
    const library = {
      "Alimentación (antes)": [
        { id:"pre-hidra", area:"Alimentación (antes)", title:"Pre-hidratación", body:"Llega hidratado: agua o bebida ligera 2 h antes.", why:"Soporte volumen plasmático", severity:"baja", badges:["Agua"] },
      ],
      "Alimentación (después)": [
        { id:"post-colacion30", area:"Alimentación (después)", title:"Colación 30–60 min", body:"Si no puedes comer pronto, batido lácteo/soya + fruta.", why:"Mantener ventana anabólica", severity:"media", badges:["Snack"] },
      ],
      "Alimentación (ajuste)": [
        { id:"meal-prep", area:"Alimentación (ajuste)", title:"Meal prep simple", body:"Planifica 2–3 bases (arroz/quinoa, pollo/huevo, ensalada).", why:"Adherencia", severity:"baja", badges:["Plan"] },
      ],
      "Hidratación": [
        { id:"orina-check", area:"Hidratación", title:"Chequeo de orina", body:"Color 1–3 claro ok; 4–6 sube ingesta.", why:"Auto-monitoreo", severity:"baja", badges:["Check"] },
      ],
      "Recuperación": [
        { id:"respiracion46", area:"Recuperación", title:"Respiración 4–6", body:"5 min de exhalación larga para bajar tono simpático.", why:"Downregulation", severity:"baja", badges:["Estrés"] },
      ],
      "Salud": [
        { id:"dolor-escala", area:"Salud", title:"Escala de dolor", body:"Si dolor ≥5/10 al nadar, reduce volumen y consulta.", why:"Evitar empeoramiento", severity:"alta", badges:["Dolor"] },
      ],
      "Plan semanal": [
        { id:"dia-off", area:"Plan semanal", title:"Día OFF real", body:"1 día/sem sin cargas: sueño, paseo suave, ocio.", why:"Supercompensación", severity:"baja", badges:["Descanso"] },
      ]
    };

    const ensureMinByArea = (arr) => (area) => {
      const extras = library[area] || [];
      let i = 0;
      while (arr.filter(t => t.area === area).length < REQUIRED && i < extras.length) {
        const tip = extras[i++];
        const clone = { ...tip, id: `${tip.id}-${area}-${arr===personals?'P':'G'}` };
        arr.push(clone);
        tips.push(clone);
      }
    };
    const allAreas = Object.keys(library);
    allAreas.forEach(ensureMinByArea(personals));
    allAreas.forEach(ensureMinByArea(generals));

    return { personalCards: personals, generalCards: generals };
  }, [ctx]);

  /* ================= Agrupar por área ================= */
  const groupsPersonal = useMemo(() => {
    const by = new Map();
    for (const c of personalCards) {
      if (!by.has(c.area)) by.set(c.area, []);
      by.get(c.area).push(c);
    }
    return Array.from(by.entries());
  }, [personalCards]);

  const groupsGeneral = useMemo(() => {
    const by = new Map();
    for (const c of generalCards) {
      if (!by.has(c.area)) by.set(c.area, []);
      by.get(c.area).push(c);
    }
    return Array.from(by.entries());
  }, [generalCards]);

  /* ================= DEBUG (consola) ================= */
  useEffect(() => {
    window.__recoCtx = ctx;
    window.testUserReco = () => {
      const cond = (ctx.condiciones || "").toLowerCase();
      const hasCardioCond = cond.includes("hipertens") || cond.includes("cardi");
      const highRestHR    = ctx.fcReposo && ctx.fcReposo >= 80;
      const hasHombro  = cond.includes("hombro") || cond.includes("manguito") || cond.includes("tendinitis");
      const hasEspalda = cond.includes("espalda") || cond.includes("lumbar")  || cond.includes("cintura");
      const hasRodilla = cond.includes("rodilla") || cond.includes("menisco") || cond.includes("ligamento");
      const imcLow      = ctx.imc !== null && ctx.imc < 18.5;
      const imcHigh     = ctx.imc !== null && ctx.imc >= 25 && ctx.imc < 30;
      const imcVeryHigh = ctx.imc !== null && ctx.imc >= 30;

      console.clear();
      console.log("== Estado usuario (ctx) ==");
      console.table({
        nombre: ctx.nombre, objetivo: ctx.objetivo, edadAprox: ctx.edadAprox, fcReposo: ctx.fcReposo,
        imc: ctx.imc, d7: ctx.d7, ses7: ctx.ses7, ses30: ctx.ses30, rpeProm: ctx.rpeProm, trendD7: ctx.trendD7
      });
      console.log("== Flags lesiones/condiciones ==");
      console.table({ hasHombro, hasEspalda, hasRodilla, hasCardioCond, highRestHR, imcLow, imcHigh, imcVeryHigh });

      console.log("== Tips PERSONALIZADOS activados ==");
      console.table(personalCards.map(t => ({ id:t.id, area:t.area, title:t.title })));

      console.log("== Tips GENERALES (base) ==");
      console.table(generalCards.map(t => ({ id:t.id, area:t.area, title:t.title })));

      return { ctx, flags:{ hasHombro, hasEspalda, hasRodilla, hasCardioCond, highRestHR, imcLow, imcHigh, imcVeryHigh }, personalCards, generalCards };
    };
  }, [ctx, personalCards, generalCards]);

  /* ================= UI ================= */
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

        {/* HERO / HEADER (neo) */}
        <header className="rc-header rc-neo">
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

        {/* RESUMEN */}
        <section className="rc-quick">
          <div className="rc-card rc-sum rc-card--neo">
            <div className="rc-card-head"><h3>Última sesión</h3></div>
            <div className="rc-sum-grid">
              <div className="kv"><span>Tipo</span><strong>{ctx.tipoUlt || "—"}</strong></div>
              <div className="kv"><span>Distancia</span><strong>{fmtKm(ctx.distUlt)}</strong></div>
              <div className="kv"><span>Duración</span><strong>{fmtMin(ctx.durUlt)}</strong></div>
              <div className="kv"><span>RPE</span><strong>{ctx.rpeUlt || "—"}</strong></div>
              <div className="kv"><span>Fatiga</span><strong>{ctx.fatUlt || "—"}</strong></div>
            </div>
          </div>

          <div className="rc-card rc-sum rc-card--neo">
            <div className="rc-card-head"><h3>Tu línea base</h3></div>
            <div className="rc-sum-grid">
              <div className="kv"><span>Peso</span><strong>{ctx.peso ? `${ctx.peso} kg` : "—"}</strong></div>
              <div className="kv"><span>Hidratación diaria</span><strong>{ctx.diarioAgua ? `${ctx.diarioAgua} ml` : "—"}</strong></div>
              <div className="kv"><span>Proteína</span><strong>{ctx.protMin && ctx.protMax ? `${ctx.protMin}–${ctx.protMax} g/día` : "—"}</strong></div>
              <div className="kv"><span>Carbohidratos</span><strong>{ctx.carbBase || "—"}</strong></div>
              {!((ctx.condiciones||"").includes("hipertens") || (ctx.condiciones||"").includes("cardi")) && (
                <div className="kv"><span>Cafeína (opcional)</span><strong>{ctx.cafeinaSug ? `${ctx.cafeinaSug} mg` : "≈3 mg/kg"}</strong></div>
              )}
            </div>
          </div>
        </section>

        {/* PERSONALIZADAS */}
        {groupsPersonal.length > 0 && (
          <section className="rc-section">
            <h2 className="rc-area">Recomendaciones personalizadas</h2>
            {groupsPersonal.map(([area, arr]) => (
              <div key={area} className="rc-subsection">
                <h3 className="rc-area rc-area--sub">{area}</h3>
                <div className="rc-grid">
                  {arr.map((c) => {
                    const { icon, theme } = uiFor(c.area);
                    return (
                      <article key={c.id} className={`rc-card rc-card--neo ${theme} sev-${c.severity}`}>
                        <div className="rc-stamp" aria-hidden="true">{icon}</div>
                        <div className="rc-card-head">
                          <h3>{c.title}</h3>
                          <div className="rc-badges">
                            {c.badges?.map((b) => <span key={b} className="rc-badge">{b}</span>)}
                          </div>
                        </div>
                        <p className="rc-body">{c.body}</p>
                        <div className="rc-why"><span className="rc-dot" /><em>{c.why}</em></div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* GENERALES */}
        <section className="rc-section">
          <h2 className="rc-area">Recomendaciones generales</h2>
          {groupsGeneral.length === 0 ? (
            <div className="rc-empty rc-card--neo"><p>No hay recomendaciones por ahora. Registra algunas sesiones para generarlas ✨</p></div>
          ) : (
            groupsGeneral.map(([area, arr]) => (
              <div key={area} className="rc-subsection">
                <h3 className="rc-area rc-area--sub">{area}</h3>
                <div className="rc-grid">
                  {arr.map((c) => {
                    const { icon, theme } = uiFor(c.area);
                    return (
                      <article key={c.id} className={`rc-card rc-card--neo ${theme} sev-${c.severity}`}>
                        <div className="rc-stamp" aria-hidden="true">{icon}</div>
                        <div className="rc-card-head">
                          <h3>{c.title}</h3>
                          <div className="rc-badges">
                            {c.badges?.map((b) => <span key={b} className="rc-badge">{b}</span>)}
                          </div>
                        </div>
                        <p className="rc-body">{c.body}</p>
                        <div className="rc-why"><span className="rc-dot" /><em>{c.why}</em></div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>

        <footer className="rc-foot">
          <p className="rc-note">
            Estos consejos son generales y no sustituyen la guía de un profesional de salud o nutrición.
          </p>
        </footer>
      </div>
    </div>
  );
}
