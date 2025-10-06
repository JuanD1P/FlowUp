import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/client";
import { FiEdit2, FiX, FiRefreshCw, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import multiavatar from "@multiavatar/multiavatar";
import "./DOCSS/PerfilNadador.css";
import ToastStack from "../Components/ToastStack";

const GENDER_OPTS = [
  { value: "", label: "Selecciona…" },
  { value: "femenino", label: "Femenino" },
  { value: "masculino", label: "Masculino" },
  { value: "no_binario", label: "No binario" },
  { value: "prefiero_no_decir", label: "Prefiero no decir" }
];

const CATEGORY_OPTS = [
  { value: "", label: "Selecciona…" },
  { value: "principiante", label: "Principiante" },
  { value: "medio", label: "Medio" },
  { value: "alto", label: "Alto" },
  { value: "altorendimiento", label: "Alto Rendimiento" }
];

const INITIAL = {
  nombre: "",
  email: "",
  fechaNacimiento: "",
  genero: "",
  alturaCm: "",
  pesoKg: "",
  fcReposo: "",
  categoria: "",
  club: "",
  telefono: "",
  objetivoGeneral: "",
  condicionesMedicas: "",
  fotoURL: "",
  avatarSeed: "",
  avatarProvider: "multiavatar"
};

function labelOf(options, value) {
  return options.find((o) => o.value === value)?.label || "";
}

function calcEdad(isoDate) {
  if (!isoDate) return "";
  const hoy = new Date();
  const d = new Date(isoDate + "T00:00:00");
  let e = hoy.getFullYear() - d.getFullYear();
  const m = hoy.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) e--;
  return e >= 0 && e < 130 ? String(e) : "";
}

function formatDateEs(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "long", year: "numeric" }).format(dt);
}

function svgToDataUrl(svgStr, size = 256) {
  const fixed = svgStr.replace("<svg ", `<svg width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" `);
  return `data:image/svg+xml;utf8,${encodeURIComponent(fixed)}`;
}

function buildAvatarDataUrl(seed, size = 256) {
  const svg = multiavatar(String(seed || "FlowUp"));
  return svgToDataUrl(svg, size);
}

function randInt(max) {
  return Math.floor(Math.random() * max);
}

function seedsFrom(base, total = 24) {
  const b = String(base || "FlowUp").replace(/\s+/g, "-");
  const salt = Date.now().toString(36).slice(-4);
  return Array.from({ length: total }, (_, i) => `${b}-${salt}-${i + 1}-${randInt(999)}`);
}

function SelectFluid({ label, name, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, []);
  const setVal = (val) => {
    onChange({ target: { name, value: val } });
    setOpen(false);
  };
  return (
    <div className={`sf ${open ? "open" : ""}`} ref={ref}>
      <button type="button" className="sf-btn" onClick={() => setOpen(v=>!v)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="sf-text">{value ? (options.find(o=>o.value===value)?.label || label) : label}</span>
        <i className="sf-caret" />
      </button>
      {open && (
        <ul className="sf-menu" role="listbox">
          {options.map(o=>(
            <li key={o.value} role="option" aria-selected={o.value===value}
                className={`sf-opt ${o.value===value?"sel":""}`}
                onClick={()=>setVal(o.value)}>
              {o.label}
            </li>
          ))}
        </ul>
      )}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

export default function PerfilNadador() {
  const [uid, setUid] = useState(null);
  const [values, setValues] = useState(INITIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarSeeds, setAvatarSeeds] = useState([]);
  const [toasts, setToasts] = useState([]);
  const navigate = useNavigate();
  const avRef = useRef(null);

  const showToast = (message, variant = "info", title = "", icon = "", duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, message, variant, title, icon, duration }]);
  };

  const removeToast = (id) => setToasts((ts) => ts.filter((t) => t.id !== id));

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (avatarOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = prev; };
  }, [avatarOpen]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate("/userlogin"); return; }
      setUid(user.uid);
      try {
        const refDoc = doc(db, "usuarios", user.uid);
        const snap = await getDoc(refDoc);
        const base = { ...INITIAL, nombre: user.displayName || "", email: user.email || "" };
        if (snap.exists()) {
          const d = snap.data() || {};
          const n = d.nadador || {};
          const v = {
            ...base,
            fechaNacimiento: n.fechaNacimiento || "",
            genero: n.genero || "",
            alturaCm: n.alturaCm ?? "",
            pesoKg: n.pesoKg ?? "",
            fcReposo: n.fcReposo ?? "",
            categoria: n.categoria || "",
            club: n.club || "",
            telefono: n.telefono || "",
            objetivoGeneral: n.objetivoGeneral || "",
            condicionesMedicas: n.condicionesMedicas || "",
            fotoURL: n.fotoURL || d.fotoURL || "",
            avatarSeed: n.avatarSeed || d.avatarSeed || (user.displayName || user.uid || "FlowUp")
          };
          setValues(v);
          setHasProfile(true);
          setEditMode(false);
        } else {
          const seed = user.displayName || user.uid || "FlowUp";
          setValues({ ...base, avatarSeed: seed, fotoURL: buildAvatarDataUrl(seed, 256) });
          setHasProfile(false);
          setEditMode(false);
        }
      } catch {
        showToast("No se pudo cargar tu perfil.", "warning", "Atención", "⚠");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [navigate]);

  const edad = useMemo(() => calcEdad(values.fechaNacimiento), [values.fechaNacimiento]);
  const fechaLarga = useMemo(() => formatDateEs(values.fechaNacimiento), [values.fechaNacimiento]);
  const imc = useMemo(() => {
    const h = parseFloat(values.alturaCm);
    const p = parseFloat(values.pesoKg);
    if (!h || !p) return "";
    const m = h / 100;
    const val = p / (m * m);
    return Number.isFinite(val) ? val.toFixed(1) : "";
  }, [values.alturaCm, values.pesoKg]);

  const currentAvatar = useMemo(() => {
    const seed = values.avatarSeed || values.nombre || uid || "FlowUp";
    return values.fotoURL || buildAvatarDataUrl(seed, 256);
  }, [values.avatarSeed, values.fotoURL, values.nombre, uid]);

  const seedBase = useMemo(() => values.nombre || uid || "FlowUp", [values.nombre, uid]);

  const handleNum = (name) => (e) => {
    const v = e.target.value.replace(",", ".");
    if (v === "" || /^(\d+(\.\d*)?)$/.test(v)) {
      setValues((s) => ({ ...s, [name]: v }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((s) => ({ ...s, [name]: value }));
  };

  const validate = () => null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) return showToast(err, "error", "Revisa los datos", "✖");
    try {
      setSaving(true);
      const seed = values.avatarSeed || values.nombre || uid || "FlowUp";
      const fotoURL = buildAvatarDataUrl(seed, 256);
      if (auth.currentUser && values.nombre && auth.currentUser.displayName !== values.nombre) {
        await updateProfile(auth.currentUser, { displayName: values.nombre, photoURL: fotoURL });
      }
      const refDoc = doc(db, "usuarios", uid);
      await setDoc(refDoc, {
        nombre: values.nombre,
        email: values.email,
        fotoURL,
        perfilCompleto: true,
        actualizadoEn: serverTimestamp(),
        avatarSeed: seed,
        nadador: {
          fechaNacimiento: values.fechaNacimiento || null,
          genero: values.genero || null,
          alturaCm: values.alturaCm === "" ? null : Number(values.alturaCm),
          pesoKg: values.pesoKg === "" ? null : Number(values.pesoKg),
          imc: imc === "" ? null : Number(imc),
          fcReposo: values.fcReposo === "" ? null : Number(values.fcReposo),
          categoria: values.categoria || null,
          club: values.club || null,
          telefono: values.telefono || null,
          objetivoGeneral: values.objetivoGeneral || null,
          condicionesMedicas: values.condicionesMedicas || null,
          fotoURL,
          avatarSeed: seed,
          actualizadoEn: serverTimestamp()
        }
      }, { merge: true });
      setValues((s) => ({ ...s, fotoURL }));
      setHasProfile(true);
      setEditMode(false);
      setAvatarOpen(false);
      showToast("Perfil guardado correctamente", "success", "Listo", "✔");
    } catch {
      showToast("Error al guardar el perfil.", "error", "Ups", "✖");
    } finally {
      setSaving(false);
    }
  };

  const openAvatar = () => {
    setAvatarSeeds(seedsFrom(seedBase, 24));
    setAvatarOpen(true);
  };

  const closeAvatar = () => setAvatarOpen(false);
  const refreshAvatars = () => setAvatarSeeds(seedsFrom(seedBase, 24));

  const pickAvatar = (seed) => {
    const url = buildAvatarDataUrl(seed, 256);
    setValues((s) => ({ ...s, avatarSeed: seed, fotoURL: url }));
    closeAvatar();
    showToast("Avatar actualizado", "info", "¡Genial!", "ℹ");
  };

  const slideAvatars = (dir) => {
    const el = avRef.current;
    if (!el) return;
    const tile = el.querySelector(".pf-avatar-tile");
    const step = tile ? tile.clientWidth + 12 : 180;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  if (loading) return <div className="pf-loading">Cargando perfil…</div>;

  return (
    <div className="pf-page">
      <header className="pf-header">
        <div className="pf-headleft">
          <h2>Perfil del Nadador</h2>
          <p>Información básica</p>
        </div>
        <div className="pf-actions">
          {!editMode && (
            <button className="pf-iconbtn" onClick={() => setEditMode(true)} aria-label="Editar perfil" title="Editar perfil">
              <FiEdit2 />
              <span>Editar</span>
            </button>
          )}
          {editMode && (
            <>
              <button form="pf-form" className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => { setEditMode(false); setAvatarOpen(false); }} disabled={saving}>
                Cancelar
              </button>
            </>
          )}
        </div>
      </header>

      {!editMode ? (
        <div className="pf-static">
          <section className="pf-card pf-hero">
            <div className="pf-hero-left">
              <div className="pf-avatar lg"><img src={currentAvatar} alt="Avatar" /></div>
              <div className="pf-static-title">
                <h4>{values.nombre || "—"}</h4>
                <p>{values.email || "—"}</p>
              </div>
            </div>
            <div className="pf-hero-badges">
              <div className="pf-badge"><span>Género</span><strong>{labelOf(GENDER_OPTS, values.genero) || "—"}</strong></div>
              <div className="pf-badge"><span>Categoría</span><strong>{labelOf(CATEGORY_OPTS, values.categoria) || "—"}</strong></div>
              <div className="pf-badge"><span>Edad</span><strong>{edad || "—"}</strong></div>
            </div>
          </section>

          <section className="pf-card">
            <h3>Identidad</h3>
            <div className="pf-static-grid">
              <div><span>Fecha de nacimiento</span><strong>{fechaLarga || "—"}</strong></div>
              <div><span>Edad</span><strong>{edad || "—"}</strong></div>
              <div><span>Género</span><strong>{labelOf(GENDER_OPTS, values.genero) || "—"}</strong></div>
              <div><span>Club / Equipo</span><strong>{values.club || "—"}</strong></div>
            </div>
          </section>

          <section className="pf-card">
            <h3>Estado físico</h3>
            <div className="pf-static-grid">
              <div><span>Altura (cm)</span><strong>{values.alturaCm || "—"}</strong></div>
              <div><span>Peso (kg)</span><strong>{values.pesoKg || "—"}</strong></div>
              <div><span>IMC</span><strong>{imc || "—"}</strong></div>
              <div><span>FC reposo (bpm)</span><strong>{values.fcReposo || "—"}</strong></div>
            </div>
          </section>

          <section className="pf-card">
            <h3>Contexto</h3>
            <div className="pf-static-grid">
              <div><span>Categoría</span><strong>{labelOf(CATEGORY_OPTS, values.categoria) || "—"}</strong></div>
              <div><span>Teléfono</span><strong>{values.telefono || "—"}</strong></div>
              <div className="pf-col-2"><span>Objetivo general</span><strong>{values.objetivoGeneral || "—"}</strong></div>
              <div className="pf-col-2"><span>Condiciones médicas</span><strong>{values.condicionesMedicas || "—"}</strong></div>
            </div>
          </section>
        </div>
      ) : (
        <form id="pf-form" className="pf-form" onSubmit={handleSubmit} noValidate>
          <section className="pf-card">
            <h3>Perfil</h3>
            <div className="pf-avatar-row">
              <div className="pf-avatar"><img src={currentAvatar} alt="Avatar" /></div>
              <div className="pf-avatar-ctrls">
                <label className="pf-field">
                  <span>Nombre completo</span>
                  <input name="nombre" type="text" value={values.nombre} onChange={handleChange} autoComplete="name" required />
                </label>
                <label className="pf-field">
                  <span>Correo</span>
                  <input name="email" type="email" value={values.email} readOnly disabled />
                </label>
                <button type="button" className="pf-iconbtn" onClick={openAvatar}>Cambiar avatar</button>
              </div>
            </div>
          </section>

          <section className="pf-card">
            <h3>Identidad</h3>
            <div className="pf-grid">
              <label className="pf-field">
                <span>Fecha de nacimiento</span>
                <input name="fechaNacimiento" type="date" value={values.fechaNacimiento} onChange={handleChange} />
                <span className="pf-hint">{fechaLarga || "Ej. 27 septiembre 2025"}</span>
              </label>
              <label className="pf-field">
                <span>Edad</span>
                <input value={edad} readOnly disabled />
              </label>
              <label className="pf-field">
                <span>Género</span>
                <SelectFluid label="Selecciona…" name="genero" options={GENDER_OPTS} value={values.genero} onChange={handleChange}/>
              </label>
            </div>
          </section>

          <section className="pf-card">
            <h3>Estado físico</h3>
            <div className="pf-grid">
              <label className="pf-field">
                <span>Altura (cm)</span>
                <input name="alturaCm" inputMode="decimal" value={values.alturaCm} onChange={handleNum("alturaCm")} placeholder="Ej. 170" />
              </label>
              <label className="pf-field">
                <span>Peso (kg)</span>
                <input name="pesoKg" inputMode="decimal" value={values.pesoKg} onChange={handleNum("pesoKg")} placeholder="Ej. 65.5" />
              </label>
              <label className="pf-field">
                <span>IMC</span>
                <input value={imc} readOnly disabled />
              </label>
              <label className="pf-field">
                <span>FC en reposo (bpm)</span>
                <input name="fcReposo" inputMode="numeric" value={values.fcReposo} onChange={handleNum("fcReposo")} placeholder="Opcional" />
              </label>
            </div>
          </section>

          <section className="pf-card">
            <h3>Contexto</h3>
            <div className="pf-grid">
              <label className="pf-field">
                <span>Categoría</span>
                <SelectFluid label="Selecciona…" name="categoria" options={CATEGORY_OPTS} value={values.categoria} onChange={handleChange}/>
              </label>
              <label className="pf-field">
                <span>Club / Equipo</span>
                <input name="club" type="text" value={values.club} onChange={handleChange} placeholder="Opcional" />
              </label>
              <label className="pf-field">
                <span>Teléfono</span>
                <input name="telefono" type="tel" value={values.telefono} onChange={handleChange} placeholder="Opcional" autoComplete="tel" />
              </label>
              <label className="pf-field pf-span-2">
                <span>Objetivo general</span>
                <input name="objetivoGeneral" type="text" value={values.objetivoGeneral} onChange={handleChange} placeholder='Ej. "Bajar peso y mejorar resistencia"; "Prepararme para competir en 100m libre"' />
              </label>
              <label className="pf-field pf-span-2">
                <span>Condiciones médicas / lesiones</span>
                <textarea name="condicionesMedicas" rows={3} value={values.condicionesMedicas} onChange={handleChange} placeholder="Ej.: tendinitis de hombro, lumbar, menisco, cardiopatía leve, hipertensión controlada" />
              </label>
            </div>
          </section>
        </form>
      )}

      {avatarOpen && (
        <div className="pf-modal" role="dialog" aria-modal="true">
          <div className="pf-modal__backdrop" onClick={closeAvatar} />
          <div className="pf-modal__panel">
            <div className="pf-modal__head">
              <div className="pf-modal__title">
                <div className="pf-avatar sm"><img src={currentAvatar} alt="" /></div>
                <div>
                  <h4>Elige tu avatar</h4>
                  <p>Basado en {seedBase}</p>
                </div>
              </div>
              <div className="pf-modal__actions">
                <button className="pf-iconbtn" onClick={refreshAvatars}><FiRefreshCw /><span>Ver más</span></button>
                <button className="pf-iconbtn" onClick={closeAvatar}><FiX /><span>Cerrar</span></button>
              </div>
            </div>

            <div className="pf-carousel">
              <button className="pf-car-btn left" onClick={() => slideAvatars(-1)} aria-label="Anterior"><FiChevronLeft /></button>
              <div className="pf-av-row" ref={avRef}>
                {avatarSeeds.map((s) => {
                  const url = buildAvatarDataUrl(s, 256);
                  return (
                    <button type="button" key={s} className="pf-avatar-tile" onClick={() => pickAvatar(s)} aria-label="Seleccionar avatar">
                      <img src={url} alt="" />
                    </button>
                  );
                })}
              </div>
              <button className="pf-car-btn right" onClick={() => slideAvatars(1)} aria-label="Siguiente"><FiChevronRight /></button>
            </div>
          </div>
        </div>
      )}

      <ToastStack toasts={toasts} onClose={removeToast} />
    </div>
  );
}
