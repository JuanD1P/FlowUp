import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/client";
import multiavatar from "@multiavatar/multiavatar";
import "./DOCSS/InicioNadador.css";

const CAMPOS_REQUERIDOS = ["nombre","fechaNacimiento","genero","alturaCm","pesoKg","categoria"];

const LABELS = {
  nombre: "Nombre",
  fechaNacimiento: "Fecha de nacimiento",
  genero: "Género",
  alturaCm: "Altura (cm)",
  pesoKg: "Peso (kg)",
  categoria: "Categoría"
};

function svgToDataUrl(svgStr, size = 96) {
  const fixed = svgStr.replace("<svg ", `<svg width="${size}" height="${size}" `);
  return `data:image/svg+xml;utf8,${encodeURIComponent(fixed)}`;
}

export default function Inicio() {
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/userlogin");
        return;
      }
      try {
        const ref = doc(db, "usuarios", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) setPerfil(snap.data());
        else setPerfil({ perfilCompleto: false, nadador: {} });
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [navigate]);

  const data = perfil || {};
  const avatarSrc = useMemo(() => {
    if (loading) return "";
    if (data.fotoURL) return data.fotoURL;
    try {
      const seed = data.avatarSeed || data.nombre || "FlowUp";
      return svgToDataUrl(multiavatar(seed), 96);
    } catch { return ""; }
  }, [loading, data.avatarSeed, data.nombre, data.fotoURL]);

  if (loading) {
    return (
      <div className="in-page">
        <section className="in-hero skeleton">
          <div className="shimmer" />
        </section>
        <section className="in-card in-welcome">
          <div className="skeleton-line" style={{ width: "40%" }} />
          <div className="skeleton-line" style={{ width: "80%" }} />
        </section>
      </div>
    );
  }

  const nad = data.nadador || {};
  const filled = CAMPOS_REQUERIDOS.filter((k) => !!nad[k] || !!data[k]).length;
  const total = CAMPOS_REQUERIDOS.length;
  const progreso = Math.max(0, Math.min(100, Math.round((filled / total) * 100)));
  const faltantes = CAMPOS_REQUERIDOS.filter((k) => !(nad[k] || data[k]));
  const incompleto = !data.perfilCompleto || progreso < 100;

  return (
    <div className="in-page">
      {incompleto && (
        <section className="in-hero">
          <div className="in-hero-waves" aria-hidden="true">
            <div className="wave wave-1" />
            <div className="wave wave-2" />
          </div>

          <div className="in-hero-left">
            <div className="in-hero-avatar">
              {avatarSrc ? <img src={avatarSrc} alt="Avatar" /> : <div className="in-hero-avatar__ph" />}
            </div>
            <div className="in-hero-texts">
              <h3>¡Tu perfil está casi listo!</h3>
              <p>
                Has completado <strong>{progreso}%</strong>. Un perfil completo
                personaliza tus metas y la carga de entrenamiento.
              </p>

              <div className="in-checklist">
                {faltantes.length > 0 ? (
                  faltantes.map((k) => (
                    <span key={k} className="in-chip">
                      <span className="dot" /> {LABELS[k]}
                    </span>
                  ))
                ) : (
                  <span className="in-chip ok">
                    <span className="tick">✓</span> Todo al día
                  </span>
                )}
              </div>

              <div className="in-cta-row">
                <button
                  className="in-btn-primary"
                  onClick={() => navigate("/PerfilNadador")}
                >
                  Completar perfil
                </button>
                <span className="in-small-hint">
                  {filled}/{total} campos clave
                </span>
              </div>
            </div>
          </div>

          <div className="in-hero-ring" aria-label={`Progreso ${progreso}%`}>
            <svg viewBox="0 0 120 120" className="ring">
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#2e5aa7" />
                  <stop offset="100%" stopColor="#1aa1ff" />
                </linearGradient>
              </defs>
              <circle className="ring-bg" cx="60" cy="60" r="52" />
              <circle
                className="ring-fg"
                cx="60"
                cy="60"
                r="52"
                style={{ strokeDasharray: `${(326 * progreso) / 100} 326` }}
              />
              <text x="60" y="66" textAnchor="middle" className="ring-text">
                {progreso}%
              </text>
            </svg>
            <div className="swimmer" aria-hidden="true"></div>
          </div>
        </section>
      )}

      <section className="in-card in-welcome">
        <h2>Inicio del Nadador</h2>
        <p>
          ¡Bienvenido, <strong>{data.nombre || "nadador"}</strong>! Aquí podrás
          seguir tu progreso, tus entrenamientos y tus logros.
        </p>
      </section>
    </div>
  );
}
