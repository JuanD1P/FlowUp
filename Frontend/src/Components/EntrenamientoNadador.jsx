import React, { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/client";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import "./DOCSS/EntrenamientoNadador.css";

/* ================= Constantes ================= */
const TIPOS = [
  { value: "agua", label: "Natación en agua" },
  { value: "tierra", label: "Fuerza/estabilidad" },
  { value: "otro", label: "Otro" },
];
const ESTILOS = ["Libre", "Espalda", "Pecho", "Mariposa", "Combinado"];
const LUGARES = ["Piscina 25 m", "Piscina 50 m", "Aguas abiertas", "Gimnasio", "Otro"];
const MODAL_IMG = "/Pulso.png";

/* ================= Helpers ================= */
function isoFecha(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
    x.getDate()
  ).padStart(2, "0")}`;
}
function isoHora(d) {
  const x = new Date(d);
  return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
}
function fechaLarga(d) {
  const x = new Date(d);
  return x.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}
function fechaCortaES(input) {
  const d = input ? new Date(input) : new Date();
  const fmt = d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  return fmt.replaceAll(".", "");
}
function toMinutes(hhmm) {
  const [h, m] = (hhmm || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function between(ts, days) {
  const now = Date.now();
  return ts >= now - days * 86400000 && ts <= now + 1;
}
function pct(a, b) {
  if (!b) return 0;
  return ((a - b) / b) * 100;
}
function pace100Str(mins, meters) {
  if (!mins || !meters) return "";
  const per100 = mins / (meters / 100);
  const mm = Math.floor(per100);
  const ss = Math.round((per100 - mm) * 60);
  return `${mm}:${String(ss).padStart(2, "0")} /100m`;
}
function padSeries(arr, n) {
  const a = Array.isArray(arr) ? arr.slice(-n) : [];
  const pad = Math.max(0, n - a.length);
  return Array(pad).fill(0).concat(a);
}

function toCSV(rows) {
  const head = [
    "fecha",
    "horaInicio",
    "horaFin",
    "tipo",
    "lugar",
    "duracionMin",
    "distanciaTotal",
    "ritmo100",
    "rpe",
    "frecuenciaCardiaca",
    "fatiga",
    "notas",
    "bloques",
  ].join(",");
  const body = rows
    .map((r) => {
      const dist =
        r.distanciaTotal ??
        (Array.isArray(r.bloques)
          ? r.bloques.reduce(
              (a, b) => a + Number(b.series || 0) * Number(b.metrosSerie || 0),
              0
            )
          : 0);
      const bloquesCSV = Array.isArray(r.bloques)
        ? JSON.stringify(
            r.bloques.map((b) => ({
              estilo: b.estilo,
              series: b.series,
              metrosSerie: b.metrosSerie,
              minutos: b.minutos || null,
            }))
          )
        : "";
      return [
        r.fecha || "",
        r.horaInicio || "",
        r.horaFin || "",
        r.tipo || "",
        r.lugar || "",
        r.duracionMin || "",
        dist || "",
        r.ritmo100 || "",
        r.rpe || "",
        r.frecuenciaCardiaca ?? "",
        r.fatiga || "",
        String(r.notas || "").replace(/[\r\n,]+/g, " "),
        `"${bloquesCSV.replace(/"/g, '""')}"`,
      ].join(",");
    })
    .join("\n");
  return head + "\n" + body;
}

const PRISTINE = {
  fecha: "",
  horaInicio: "",
  horaFin: "",
  tipo: "",
  lugar: "",
  rpe: 5,
  frecuenciaCardiaca: "",
  fatiga: "",
  notas: "",
};

/* ================= Componente ================= */
export default function EntrenamientoNadador() {
  const now = new Date();

  // Estado base
  const [uid, setUid] = useState("");
  const [historial, setHistorial] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  // Modal pulso
  const [showPulso, setShowPulso] = useState(false);
  const [pulseSecs, setPulseSecs] = useState(15);
  const [timer, setTimer] = useState(0);
  const tRef = useRef(null);

  // Historial navegación
  const [verMas, setVerMas] = useState(false);
  const [idx, setIdx] = useState(0);

  // Layout
  const [vw, setVw] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1200));
  const isNarrow = vw < 860;
  const isTiny = vw < 520;

  // Formulario
  const [form, setForm] = useState({
    fecha: isoFecha(now),
    horaInicio: isoHora(now),
    horaFin: isoHora(new Date(now.getTime() + 60 * 60 * 1000)),
    tipo: "agua",
    lugar: "Piscina 25 m",
    rpe: 5,
    frecuenciaCardiaca: "",
    fatiga: "Media",
    notas: "",
  });

  // Bloques de natación
  const [bloques, setBloques] = useState([{ estilo: "Libre", series: 1, metrosSerie: 100, minutos: "" }]);

  /* ====== Efectos ====== */
  useEffect(() => {
    let offAuth = null;
    let offSnap = null;

    offAuth = onAuthStateChanged(auth, (u) => {
      if (offSnap) offSnap();

      if (u?.uid) {
        setUid(u.uid);
        const col = collection(db, "usuarios", u.uid, "entrenamientos");
        const qy = query(col, orderBy("startMs", "desc"));
        offSnap = onSnapshot(qy, (snap) =>
          setHistorial(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        );
      } else {
        setUid("");
        setHistorial([]);
      }
    });

    const onKey = (e) => e.key === "Escape" && setShowPulso(false);
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);

    return () => {
      offAuth && offAuth();
      offSnap && offSnap();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => setIdx(0), [historial.length]);

  /* ====== Derivados ====== */
  const duracionMin = useMemo(() => {
    if (!form.horaInicio || !form.horaFin) return "";
    const diff = toMinutes(form.horaFin) - toMinutes(form.horaInicio);
    return diff > 0 ? diff : "";
  }, [form.horaInicio, form.horaFin]);

  const distanciaTotal = useMemo(() => {
    if (form.tipo !== "agua") return 0;
    return bloques.reduce(
      (acc, b) => acc + Number(b.series || 0) * Number(b.metrosSerie || 0),
      0
    );
  }, [form.tipo, bloques]);

  const ritmo100 = useMemo(() => {
    if (form.tipo !== "agua") return "";
    const t = parseFloat(duracionMin || "0");
    if (!distanciaTotal || !t) return "";
    return pace100Str(t, distanciaTotal);
  }, [form.tipo, duracionMin, distanciaTotal]);

  const bloquesConCalculados = useMemo(
    () =>
      bloques.map((b) => {
        const metros = (Number(b.series || 0) * Number(b.metrosSerie || 0)) || 0;
        const min = Number(b.minutos || 0);
        return { ...b, metrosTotales: metros, ritmo100: pace100Str(min, metros) };
      }),
    [bloques]
  );

  // KPIs
  const kpis = useMemo(() => {
    const agua = historial.filter((h) => h.tipo === "agua");
    const distOf = (h) =>
      typeof h.distanciaTotal === "number"
        ? h.distanciaTotal
        : Array.isArray(h.bloques)
        ? h.bloques.reduce(
            (a, b) => a + Number(b.series || 0) * Number(b.metrosSerie || 0),
            0
          )
        : 0;

    const winA = agua.filter((h) => between(h.startMs || 0, 7)).reduce((a, b) => a + distOf(b), 0);
    const prevA = agua
      .filter((h) => between(h.startMs || 0, 14) && !between(h.startMs || 0, 7))
      .reduce((a, b) => a + distOf(b), 0);
    const ses30 = historial.filter((h) => between(h.startMs || 0, 30)).length;
    const prevSes = historial.filter((h) => between(h.startMs || 0, 60) && !between(h.startMs || 0, 30)).length;
    const rpeProm =
      historial.slice(0, 10).reduce((a, b) => a + (b.rpe || 0), 0) /
      Math.max(1, Math.min(10, historial.length));
    const distSeries = padSeries(agua.map((h) => distOf(h) || 0), 8);
    const durSeries = padSeries(historial.map((h) => h.duracionMin || 0), 8);
    const maxD = Math.max(1, ...distSeries);
    const maxT = Math.max(1, ...durSeries);

    return {
      dist7d: winA,
      distTrend: pct(winA, prevA),
      ses30d: ses30,
      sesTrend: pct(ses30, prevSes),
      rpeProm: isFinite(rpeProm) ? rpeProm : 0,
      distSeries,
      durSeries,
      maxD,
      maxT,
    };
  }, [historial]);

  const rpeHue = 140 - Math.min(10, Math.max(1, Number(form.rpe || 5))) * 10;

  // Navegación de 1-a-1 en historial
  const canPrev = !verMas && idx > 0;
  const canNext = !verMas && idx < Math.max(0, historial.length - 1);
  const goPrev = () => canPrev && setIdx((i) => Math.max(0, i - 1));
  const goNext = () => canNext && setIdx((i) => Math.min(historial.length - 1, i + 1));

  /* ====== Charts (SVG simple) ====== */
  const distChart = (values, max) => {
    const n = Math.max(1, values.length || 8);
    const safeMax = Math.max(1, max || 1);
    return (
      <svg className="en-svg" viewBox="0 0 320 160" preserveAspectRatio="none" aria-label="Distancia últimas 8 sesiones">
        {values.map((v, i) => {
          const x = i * (320 / n);
          const bw = (320 / n) - 6;
          const h = Math.max(8, (v / safeMax) * 140);
          return (
            <g key={i} transform={`translate(${x + 3},${160 - h - 10})`}>
              <rect width={bw} height={h} rx="6" fill="url(#grad1)" />
              <text x={bw / 2} y={h + 12} textAnchor="middle" className="en-bar-lbl">
                {v ? (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v) : ""}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  const durChart = (values, max) => {
    const n = Math.max(1, values.length || 8);
    const safeMax = Math.max(1, max || 1);
    return (
      <svg className="en-svg" viewBox="0 0 320 160" preserveAspectRatio="none" aria-label="Duración últimas 8 sesiones">
        {values.map((v, i) => {
          const x = i * (320 / n);
          const bw = (320 / n) - 6;
          const h = Math.max(8, (v / safeMax) * 140);
          return (
            <g key={i} transform={`translate(${x + 3},${160 - h - 10})`}>
              <rect width={bw} height={h} rx="6" fill="url(#grad2)" />
              <text x={bw / 2} y={h + 12} textAnchor="middle" className="en-bar-lbl">
                {v ? `${v}m` : ""}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  /* ====== Handlers ====== */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };
  const setAhoraInicio = () => setForm((p) => ({ ...p, horaInicio: isoHora(new Date()) }));
  const setAhoraFin = () => setForm((p) => ({ ...p, horaFin: isoHora(new Date()) }));

  const addBloque = () =>
    setBloques((b) => [...b, { estilo: "Libre", series: 1, metrosSerie: 100, minutos: "" }]);
  const updateBloque = (i, field, val) =>
    setBloques((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], [field]: val };
      return copy;
    });
  const removeBloque = (i) => setBloques((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!uid) {
      setErr("Inicia sesión para guardar entrenamientos.");
      return;
    }
    if (!form.fecha || !form.horaInicio || !form.horaFin) {
      setErr("Completa fecha y horas.");
      return;
    }
    if (duracionMin === "" || duracionMin <= 0) {
      setErr("La hora fin debe ser mayor a la de inicio.");
      return;
    }
    if (form.tipo === "agua" && (!bloques.length || distanciaTotal <= 0)) {
      setErr("Agrega al menos un bloque con metros.");
      return;
    }

    setGuardando(true);
    try {
      const startDate = new Date(`${form.fecha}T${form.horaInicio}:00`);
      const endDate = new Date(`${form.fecha}T${form.horaFin}:00`);

      const bloquesClean =
        form.tipo === "agua"
          ? bloquesConCalculados.map((b) => ({
              estilo: b.estilo,
              series: Number(b.series || 0),
              metrosSerie: Number(b.metrosSerie || 0),
              metrosTotales: Number(b.metrosTotales || 0),
              minutos: b.minutos !== "" ? Number(b.minutos) : null,
              ritmo100: b.ritmo100 || "",
            }))
          : [];

      const payload = {
        fecha: form.fecha,
        fechaLegible: fechaLarga(form.fecha),
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
        startMs: startDate.getTime(),
        endMs: endDate.getTime(),
        duracionMin,
        tipo: form.tipo,
        lugar: form.lugar,
        bloques: form.tipo === "agua" ? bloquesClean : [],
        distanciaTotal: form.tipo === "agua" ? distanciaTotal : 0,
        ritmo100: form.tipo === "agua" ? ritmo100 : "",
        // legado
        series: 0,
        repeticiones: 0,
        estilo: "",
        rpe: Number(form.rpe || 0),
        frecuenciaCardiaca: Number(form.frecuenciaCardiaca || 0) || null,
        fatiga: form.fatiga,
        notas: form.notas?.trim() || "",
        createdAt: serverTimestamp(),
      };

      const col = collection(db, "usuarios", uid, "entrenamientos");
      await addDoc(col, payload);

      setForm({
        ...PRISTINE,
        fecha: isoFecha(new Date()),
        horaInicio: isoHora(new Date()),
        horaFin: isoHora(new Date(new Date().getTime() + 60 * 60 * 1000)),
        tipo: "agua",
        lugar: "Piscina 25 m",
        rpe: 5,
        fatiga: "Media",
      });
      setBloques([{ estilo: "Libre", series: 1, metrosSerie: 100, minutos: "" }]);
      setToast("Sesión guardada");
      setTimeout(() => setToast(""), 2200);
    } catch (e2) {
      setErr("No se pudo guardar. Intenta de nuevo.");
      console.error(e2);
    } finally {
      setGuardando(false);
    }
  };

  const exportarCSV = () => {
    if (!historial.length) return;
    const csv = toCSV(historial);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "entrenamientos.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setToast("Exportado como CSV");
    setTimeout(() => setToast(""), 1800);
  };

  const exportarPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf"); // dinámico
      if (!historial.length) {
        setToast("No hay datos para exportar");
        setTimeout(() => setToast(""), 1800);
        return;
      }

      const distOf = (s) =>
        typeof s.distanciaTotal === "number"
          ? s.distanciaTotal
          : Array.isArray(s.bloques)
          ? s.bloques.reduce(
              (a, b) => a + Number(b.series || 0) * Number(b.metrosSerie || 0),
              0
            )
          : 0;

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const L = 48, R = 48, TOP = 60, BOT = 64;
      let y = TOP;

      // Título
      doc.setFont("helvetica","bold").setFontSize(22).setTextColor("#10223e");
      doc.text("Reporte de Entrenamientos — FlowUp", L, y);
      y += 22;
      doc.setFont("helvetica","normal").setFontSize(11).setTextColor("#5b6b8a");
      doc.text(new Date().toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"}), L, y);
      doc.setTextColor("#10223e");

      // KPIs
      y += 20;
      const kH = 56, kGap = 10;
      const kW = (W - L - R - kGap*3) / 4;
      const KPIS = [
        ["Metros (7 días)", `${kpis.dist7d} m`],
        ["Tendencia semana", `${kpis.distTrend>=0?"+":""}${Math.abs(kpis.distTrend).toFixed(0)}%`],
        ["Sesiones (30 días)", `${kpis.ses30d}`],
        ["RPE prom (10)", `${kpis.rpeProm.toFixed(1)}`],
      ];
      KPIS.forEach(([lbl,val],i)=>{
        const x = L + i*(kW + kGap);
        doc.setDrawColor(226,233,246).setFillColor(255,255,255);
        doc.roundedRect(x, y, kW, kH, 10, 10, "FD");
        doc.setFontSize(10).setTextColor("#5b6b8a").text(lbl, x+12, y+18);
        doc.setFont("helvetica","bold").setFontSize(16).setTextColor("#10223e").text(val, x+12, y+38);
        doc.setFont("helvetica","normal");
      });
      y += kH + 26;

      // Encabezado
      const cols = ["Fecha","Horario","Lugar","Durac.","Metros","Ritmo","RPE"];
      const widths = [120,86,150,50,58,70,34];
      const lineH = 15;
      const rowPadY = 8;

      const drawHeader = () => {
        doc.setFontSize(10).setTextColor("#5b6b8a");
        let x = L;
        cols.forEach((c, i) => { doc.text(c, x, y); x += widths[i]; });
        doc.setDrawColor(226,233,246);
        doc.line(L, y+6, W-R, y+6);
        y += 16;
        doc.setTextColor("#10223e");
      };
      drawHeader();

      // Cuerpo
      for (const s of historial) {
        const fechaTxt = s.fechaLegible ? s.fechaLegible : (s.fecha ? fechaCortaES(s.fecha) : "");
        const distTxt = s.tipo==="agua" ? `${distOf(s)||0} m` : "—";
        const ritmoTxt = s.ritmo100 ? s.ritmo100.replace(" /100m","") : "—";

        const row = [
          fechaTxt,
          `${s.horaInicio}–${s.horaFin}`,
          s.lugar || "—",
          s.duracionMin ? `${s.duracionMin}m` : "—",
          distTxt,
          ritmoTxt,
          s.rpe ? `${s.rpe}` : "—",
        ];

        const cellLines = row.map((txt, i) => {
          const maxW = widths[i] - 6;
          return doc.splitTextToSize(String(txt), maxW);
        });
        const maxLines = Math.max(...cellLines.map((ls) => ls.length));
        let rowH = maxLines * lineH + rowPadY;

        let extraText = "";
        if (Array.isArray(s.bloques) && s.bloques.length) {
          const t = s.bloques
            .map((b) => {
              const tot = b.metrosTotales ?? (b.series * b.metrosSerie);
              const m = b.minutos ? ` · ${b.minutos} min` : "";
              const r = b.ritmo100 ? ` · ${b.ritmo100}` : "";
              return `• ${b.estilo}: ${b.series}×${b.metrosSerie} m = ${tot} m${m}${r}`;
            })
            .join("\n");
          extraText += t;
        }
        if (s.notas) extraText += (extraText ? "\n" : "") + `Notas: ${s.notas}`;

        const extraLines = extraText ? doc.splitTextToSize(extraText, W - L - R) : [];
        const extraH = extraLines.length ? extraLines.length * 13 + 10 : 0;

        if (y + rowH + (extraH ? extraH + 8 : 0) > H - BOT) {
          doc.addPage();
          y = TOP;
          drawHeader();
        }

        let x = L;
        doc.setFontSize(11);
        cellLines.forEach((lines, i) => {
          doc.text(lines, x, y + 12);
          x += widths[i];
        });
        y += rowH;

        if (extraLines.length) {
          doc.setDrawColor(219,231,255).setFillColor(247,251,255);
          doc.roundedRect(L, y, W - L - R, extraH, 6, 6, "FD");
          doc.setFontSize(10).setTextColor("#0f1e3a");
          doc.text(extraLines, L + 8, y + 14);
          doc.setTextColor("#10223e");
          y += extraH;
        }

        doc.setDrawColor(233,238,250);
        doc.line(L, y + 4, W - R, y + 4);
        y += 10;
      }

      doc.save("entrenamientos.pdf");
    } catch (e) {
      setToast("Falta instalar jspdf: npm i jspdf");
      setTimeout(() => setToast(""), 2200);
      console.error(e);
    }
  };

  const startTimer = (secs) => {
    clearInterval(tRef.current);
    setTimer(secs);
    tRef.current = setInterval(() => {
      setTimer((s) => {
        if (s <= 1) {
          clearInterval(tRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  /* ====== Render ====== */
  return (
    <div className="en-wrap">
      {/* Gradientes para charts */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a6dff" stopOpacity="1" />
            <stop offset="100%" stopColor="#00d4ff" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#84d8ff" stopOpacity="1" />
            <stop offset="100%" stopColor="#8bafff" stopOpacity="1" />
          </linearGradient>
        </defs>
      </svg>

      <header className="en-header">
        <div className="en-hero">
          <h1>Registro de entrenamiento</h1>
          <p>Registra tu sesión y revisa el resumen de los días anteriores</p>
        </div>
        <div className="en-water"></div>
        <div className="en-bubbles"></div>
      </header>

      <div className="en-layout">
        {/* ====== Form ====== */}
        <form className="en-card en-card-glass en-form" onSubmit={handleSubmit}>
          <section className="en-section">
            <h2>Datos generales</h2>
            <div className="en-grid">
              <label className="en-field">
                <span>Fecha</span>
                <input type="date" name="fecha" value={form.fecha} onChange={handleChange} />
                {form.fecha && <small className="en-hint">{fechaLarga(form.fecha)}</small>}
              </label>

              <label className="en-field en-icon">
                <span>Hora inicio</span>
                <input type="time" name="horaInicio" value={form.horaInicio} onChange={handleChange} />
                <i className="en-ico clock" />
                <div className="en-quick">
                  <button type="button" className="en-chip" onClick={setAhoraInicio}>Ahora</button>
                </div>
              </label>

              <label className="en-field en-icon">
                <span>Hora fin</span>
                <input type="time" name="horaFin" value={form.horaFin} onChange={handleChange} />
                <i className="en-ico clock" />
                <div className="en-quick">
                  <button type="button" className="en-chip" onClick={setAhoraFin}>Ahora</button>
                </div>
              </label>

              <div className="en-field">
                <span>Tipo</span>
                <div className="en-segment">
                  {TIPOS.map((t) => (
                    <label key={t.value} className={`en-seg ${form.tipo === t.value ? "on" : ""}`}>
                      <input type="radio" name="tipo" value={t.value} checked={form.tipo === t.value} onChange={handleChange} />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="en-field">
                <span>Lugar</span>
                <select name="lugar" value={form.lugar} onChange={handleChange}>
                  <option value="">Selecciona…</option>
                  {LUGARES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </label>

              <div className="en-field">
                <span>Duración</span>
                <div className="en-static">{duracionMin ? `${duracionMin} min` : "—"}</div>
              </div>
            </div>
          </section>

          {form.tipo === "agua" && (
            <section className="en-section">
              <h2>Natación</h2>

              {bloquesConCalculados.map((b, i) => (
                <div key={i} className="en-block">
                  <label className="en-field">
                    <span>Estilo</span>
                    <select value={b.estilo} onChange={(e) => updateBloque(i, "estilo", e.target.value)}>
                      {ESTILOS.map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </label>

                  <label className="en-field">
                    <span>Series</span>
                    <input type="number" inputMode="numeric" value={b.series} onChange={(e) => updateBloque(i, "series", Number(e.target.value))} />
                  </label>

                  <label className="en-field en-with-unit">
                    <span>Metros por serie</span>
                    <input type="number" inputMode="numeric" value={b.metrosSerie} onChange={(e)=>updateBloque(i,"metrosSerie",Number(e.target.value))}/>
                  </label>

                  <label className="en-field en-with-unit">
                    <span>Minutos (opcional)</span>
                    <input type="number" inputMode="numeric" placeholder="p.ej. 10" value={b.minutos} onChange={(e)=>updateBloque(i,"minutos",e.target.value)}/>
                  </label>

                  <div className="en-field">
                    <span>Bloque</span>
                    <div className="en-static"><strong>{b.metrosTotales} m</strong></div>
                  </div>

                  <div className="en-field">
                    <span>Ritmo bloque</span>
                    <div className="en-static">{b.ritmo100 || "—"}</div>
                  </div>

                  <div className="en-field" style={{ alignSelf: "end" }}>
                    <button type="button" className="en-btn" onClick={() => removeBloque(i)} disabled={bloques.length === 1}>
                      Quitar
                    </button>
                  </div>
                </div>
              ))}

              <div className="en-block-actions">
                <button type="button" className="en-btn en-ghost" onClick={addBloque}>
                  + Añadir estilo
                </button>
              </div>

              <div className="en-grid">
                <div className="en-field">
                  <span>Distancia Total</span>
                  <div className="en-static"><strong>{distanciaTotal} m</strong></div>
                </div>
                <div className="en-field">
                  <span>Ritmo medio</span>
                  <div className="en-static">{ritmo100 ? ritmo100 : "—"}</div>
                </div>
              </div>
            </section>
          )}

          <section className="en-section">
            <h2>Salud y sensaciones</h2>
            <div className="en-grid">
              <label className="en-field">
                <span>Intensidad percibida</span>
                <input style={{ accentColor: `hsl(${rpeHue} 90% 45%)` }} type="range" min="1" max="10" name="rpe" value={form.rpe} onChange={handleChange} />
                <div className="en-gauge mini">
                  <div className="en-gauge-fill" style={{ width: `${(Number(form.rpe) / 10) * 100}%` }} />
                </div>
                <small className="en-hint">RPE: {form.rpe}/10</small>
              </label>

              <label className="en-field en-icon">
                <span>Frecuencia cardiaca (bpm)</span>
                <input type="number" inputMode="numeric" name="frecuenciaCardiaca" value={form.frecuenciaCardiaca} onChange={handleChange} placeholder="ej. 145" />
                <i className="en-ico heart" />
                <div className="en-quick">
                  <button type="button" className="en-chip" onClick={() => { setShowPulso(true); setTimer(0); }}>
                    Cómo medir
                  </button>
                </div>
              </label>

              <div className="en-field">
                <span>Fatiga</span>
                <div className="en-segment skinny">
                  {["Baja", "Media", "Alta"].map((f) => (
                    <label key={f} className={`en-seg ${form.fatiga === f ? "on" : ""}`}>
                      <input type="radio" name="fatiga" value={f} checked={form.fatiga === f} onChange={handleChange} />
                      <span>{f}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <label className="en-field en-notas">
              <span>Notas</span>
              <textarea name="notas" rows={4} value={form.notas} onChange={handleChange} placeholder="Ej. Últimos 400 m fuertes, técnica estable." />
            </label>
          </section>

          {err && <div className="en-error">{err}</div>}

          <div className="en-actions">
            <button className="en-btn en-primary" type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar sesión"}
            </button>
            <button
              className="en-btn en-ghost"
              type="button"
              onClick={() => {
                setForm({
                  ...PRISTINE,
                  fecha: isoFecha(new Date()),
                  horaInicio: isoHora(new Date()),
                  horaFin: isoHora(new Date(new Date().getTime() + 60 * 60 * 1000)),
                  tipo: "agua",
                  lugar: "Piscina 25 m",
                  rpe: 5,
                  fatiga: "Media",
                });
                setBloques([{ estilo: "Libre", series: 1, metrosSerie: 100, minutos: "" }]);
              }}
            >
              Limpiar
            </button>
          </div>
        </form>

        {/* ====== Aside ====== */}
        <aside className="en-aside">
          <div className="en-kpi-card">
            <div className="en-kpi-head"><h3>Resumen</h3></div>

            <div className="en-kpi-grid">
              <div className="en-kpi-item">
                <span className="en-kpi-label">Metros 7 días</span>
                <div className="en-kpi-val">{kpis.dist7d} m</div>
                <div className={`en-trend ${kpis.distTrend >= 0 ? "up" : "down"}`}>
                  {kpis.distTrend >= 0 ? "▲" : "▼"} {Math.abs(kpis.distTrend).toFixed(0)}%
                </div>
              </div>
              <div className="en-kpi-item">
                <span className="en-kpi-label">Sesiones 30 días</span>
                <div className="en-kpi-val">{kpis.ses30d}</div>
                <div className={`en-trend ${kpis.sesTrend >= 0 ? "up" : "down"}`}>
                  {kpis.sesTrend >= 0 ? "▲" : "▼"} {Math.abs(kpis.sesTrend).toFixed(0)}%
                </div>
              </div>
              <div className="en-kpi-item">
                <span className="en-kpi-label">RPE prom (10)</span>
                <div className="en-kpi-val">{kpis.rpeProm.toFixed(1)}</div>
                <div className="en-gauge mini">
                  <div className="en-gauge-fill" style={{ width: `${(kpis.rpeProm / 10) * 100}%` }} />
                </div>
              </div>
            </div>

            <div className="en-charts">
              <div className="en-chart">
                <div className="en-chart-title">Distancia últimas 8 sesiones</div>
                {distChart(kpis.distSeries, kpis.maxD)}
              </div>
              <div className="en-chart">
                <div className="en-chart-title">Duración últimas 8 sesiones</div>
                {durChart(kpis.durSeries, kpis.maxT)}
              </div>
            </div>
          </div>

          <div className="en-card en-resumen en-card-glass">
            <div className="en-resumen-head">
              <h2>Historial</h2>
              <div className="en-head-actions" style={{ gap: 6 }}>
                {historial.length > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button className="en-btn" type="button" onClick={goPrev} disabled={!canPrev} style={{ padding: "6px 10px" }}>‹</button>
                    <span className="en-badge">{historial.length ? idx + 1 : 0} / {historial.length}</span>
                    <button className="en-btn" type="button" onClick={goNext} disabled={!canNext} style={{ padding: "6px 10px" }}>›</button>
                  </div>
                )}
                <button className="en-btn" type="button" onClick={() => setVerMas((v) => !v)} disabled={!historial.length}>
                  {verMas ? "Ver 1" : "Ver más"}
                </button>
                <button className="en-btn" type="button" onClick={exportarCSV} disabled={!historial.length}>Exportar CSV</button>
                <button className="en-btn en-primary" type="button" onClick={exportarPDF} disabled={!historial.length}>Exportar PDF</button>
              </div>
            </div>

            {historial.length === 0 && <p className="en-empty">Aún no hay entrenamientos.</p>}

            {historial.length > 0 && (
              <div
                className="en-timeline"
                style={
                  verMas
                    ? { maxHeight: isNarrow ? "44vh" : "40vh", overflowY: "auto", paddingRight: 4, overscrollBehavior: "contain" }
                    : { maxHeight: "unset", overflow: "visible", paddingRight: 0 }
                }
              >
                {(verMas ? historial : historial.slice(idx, idx + 1)).map((s) => {
                  const distOf =
                    typeof s.distanciaTotal === "number"
                      ? s.distanciaTotal
                      : Array.isArray(s.bloques)
                      ? s.bloques.reduce(
                          (a, b) => a + Number(b.series || 0) * Number(b.metrosSerie || 0),
                          0
                        )
                      : 0;

                  return (
                    <div key={s.id} className="en-tl-item" style={{ padding: 10 }}>
                      <div className="en-tl-head">
                        <div className="en-tl-date">{s.fechaLegible || fechaLarga(s.fecha)}</div>
                        <div className={`en-dot ${s.tipo === "agua" ? "blue" : s.tipo === "tierra" ? "green" : "gray"}`} />
                      </div>
                      <div className="en-tl-row">
                        <div className="en-tl-kv"><span>Horario</span><strong>{s.horaInicio}–{s.horaFin}</strong></div>
                        <div className="en-tl-kv"><span>Lugar</span><strong>{s.lugar}</strong></div>
                        <div className="en-tl-kv"><span>Duración</span><strong>{s.duracionMin ? `${s.duracionMin} min` : "—"}</strong></div>
                        <div className="en-tl-kv"><span>Metros</span><strong>{s.tipo === "agua" ? `${distOf || 0} m` : "—"}</strong></div>
                        <div className="en-tl-kv"><span>Ritmo</span><strong>{s.ritmo100 || "—"}</strong></div>
                        <div className="en-tl-kv"><span>RPE</span><strong>{s.rpe ? `${s.rpe}/10` : "—"}</strong></div>
                      </div>

                      {Array.isArray(s.bloques) && s.bloques.length > 0 && (
                        <div className="en-tl-nota" style={{ marginTop: 8 }}>
                          <div style={{ fontWeight: 700, marginBottom: 6 }}>Bloques:</div>
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {s.bloques.map((b, ix) => (
                              <li key={ix}>
                                {b.estilo}: {b.series}×{b.metrosSerie} m = {b.metrosTotales ?? b.series * b.metrosSerie} m
                                {b.minutos ? ` · ${b.minutos} min` : ""}
                                {b.ritmo100 ? ` · ${b.ritmo100}` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {s.notas && <div className="en-tl-nota">{s.notas}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Modal de pulso */}
      {showPulso && (
        <div className="en-modal" onClick={() => setShowPulso(false)}>
          <div
            className="en-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: isTiny ? "100%" : "min(920px,100%)",
              height: isTiny ? "100dvh" : "auto",
              maxHeight: isTiny ? "100dvh" : "calc(100dvh - 32px)",
              borderRadius: isTiny ? 0 : 18,
              overflow: "auto",
            }}
          >
            <div className="en-modal-head">
              <h3>Medir frecuencia cardiaca</h3>
              <button className="en-x" onClick={() => setShowPulso(false)}>×</button>
            </div>
            <div
              className="en-modal-body2"
              style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "320px 1fr", gap: 16, alignItems: "start" }}
            >
              <div className="en-modal-col">
                <img className="en-modal-img" src={MODAL_IMG} alt="Guía para medir el pulso" />
                <div className="en-timer">
                  <div className="en-timer-display">
                    {String(Math.floor(timer / 60)).padStart(2, "0")}:{String(timer % 60).padStart(2, "0")}
                  </div>
                  <div className="en-timer-ctrls">
                    <button className={`en-btn ${pulseSecs === 15 ? "en-primary" : ""}`} onClick={() => setPulseSecs(15)} type="button">15 s</button>
                    <button className={`en-btn ${pulseSecs === 30 ? "en-primary" : ""}`} onClick={() => setPulseSecs(30)} type="button">30 s</button>
                    <button className="en-btn" type="button" onClick={() => startTimer(pulseSecs)}>Iniciar</button>
                    <button className="en-btn" type="button" onClick={() => { clearInterval(tRef.current); setTimer(0); }}>Reiniciar</button>
                  </div>
                  <div className="en-timer-hint">Cuenta los latidos y multiplica por {pulseSecs === 15 ? 4 : 2}.</div>
                </div>
              </div>
              <div className="en-modal-col">
                <div className="en-steps2">
                  <div className="en-step-card"><div className="en-step-title">Ubica el pulso</div><div className="en-step-text">Muñeca (radial) o cuello (carótida).</div></div>
                  <div className="en-step-card"><div className="en-step-title">Cuenta latidos</div><div className="en-step-text">Presión suave. No uses el pulgar.</div></div>
                  <div className="en-step-card"><div className="en-step-title">Calcula bpm</div><div className="en-step-text">Registra el valor en el formulario.</div></div>
                </div>
                <div className="en-zones">
                  <div className="en-zone">
                    <div className="en-zone-title">Zonas guía</div>
                    <div className="en-zone-bars">
                      <div className="en-zone-bar z1"><span>Suave</span></div>
                      <div className="en-zone-bar z2"><span>Aeróbica</span></div>
                      <div className="en-zone-bar z3"><span>Tempo</span></div>
                      <div className="en-zone-bar z4"><span>Umbral</span></div>
                      <div className="en-zone-bar z5"><span>Alta</span></div>
                    </div>
                    <div className="en-zone-note">Los rangos varían según edad y condición.</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="en-actions" style={{ marginTop: 8 }}>
              <button className="en-btn en-primary" onClick={() => setShowPulso(false)}>Listo</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="en-toast">{toast}</div>}
    </div>
  );
}
