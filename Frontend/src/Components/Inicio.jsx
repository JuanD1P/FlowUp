import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { auth, db } from "../firebase/client";
import multiavatar from "@multiavatar/multiavatar";
import "./DOCSS/InicioNadador.css";

const CAMPOS_REQUERIDOS=["nombre","fechaNacimiento","genero","alturaCm","pesoKg","categoria"];
const LABELS={nombre:"Nombre",fechaNacimiento:"Fecha de nacimiento",genero:"Género",alturaCm:"Altura (cm)",pesoKg:"Peso (kg)",categoria:"Categoría"};

function svgToDataUrl(svgStr,size=96){const fixed=svgStr.replace("<svg ",`<svg width="${size}" height="${size}" `);return`data:image/svg+xml;utf8,${encodeURIComponent(fixed)}`}
function padSeries(arr,n){const a=arr.slice(-n);const pad=Math.max(0,n-a.length);return Array(pad).fill(0).concat(a)}
function fechaLarga(d){const x=new Date(d);return x.toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})}

export default function Inicio(){
  const [perfil,setPerfil]=useState(null);
  const [loading,setLoading]=useState(true);
  const [uid,setUid]=useState("");
  const [sesiones,setSesiones]=useState([]);
  const navigate=useNavigate();

  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async(user)=>{
      if(!user){navigate("/userlogin");return}
      setUid(user.uid);
      try{
        const ref=doc(db,"usuarios",user.uid);
        const snap=await getDoc(ref);
        if(snap.exists()) setPerfil(snap.data()); else setPerfil({perfilCompleto:false,nadador:{}});
      }finally{setLoading(false)}
    });
    return()=>unsub();
  },[navigate]);

  useEffect(()=>{
    if(!uid) return;
    const col=collection(db,"usuarios",uid,"entrenamientos");
    const q=query(col,orderBy("startMs","desc"));
    const off=onSnapshot(q,(snap)=>{setSesiones(snap.docs.map(d=>({id:d.id,...d.data()})))});
    return()=>off();
  },[uid]);

  const data=perfil||{};
  const avatarSrc=useMemo(()=>{
    if(loading) return "";
    if(data.fotoURL) return data.fotoURL;
    try{ const seed=data.avatarSeed||data.nombre||"FlowUp"; return svgToDataUrl(multiavatar(seed),96) }catch{ return "" }
  },[loading,data.avatarSeed,data.nombre,data.fotoURL]);

  if(loading){
    return(
      <div className="in-page">
        <section className="in-hero skeleton"><div className="shimmer"/></section>
        <section className="in-card in-welcome">
          <div className="skeleton-line" style={{width:"40%"}}/>
          <div className="skeleton-line" style={{width:"80%"}}/>
        </section>
        <section className="in-card in-train"><div className="skeleton-line" style={{width:"30%"}}/><div className="skeleton-line" style={{width:"90%"}}/></section>
      </div>
    )
  }

  const nad=data.nadador||{};
  const filled=CAMPOS_REQUERIDOS.filter((k)=>!!nad[k]||!!data[k]).length;
  const total=CAMPOS_REQUERIDOS.length;
  const progreso=Math.max(0,Math.min(100,Math.round((filled/total)*100)));
  const faltantes=CAMPOS_REQUERIDOS.filter((k)=>!(nad[k]||data[k]));
  const incompleto=!data.perfilCompleto||progreso<100;

  const ultima=sesiones[0];
  const agua=sesiones.filter(s=>s.tipo==="agua");
  const distSeries=padSeries(agua.map(s=>s.distanciaTotal||0),8);
  const durSeries=padSeries(sesiones.map(s=>s.duracionMin||0),8);
  const maxD=Math.max(1,...distSeries);
  const maxT=Math.max(1,...durSeries);

  return(
    <div className="in-page">
      <section className="in-card in-welcome">
        <h2>¡Bienvenido, <strong>{data.nombre||"nadador"}</strong>!</h2>
      </section>

      {incompleto&&(
        <section className="in-hero">
          <div className="in-hero-waves" aria-hidden="true"><div className="wave wave-1"/><div className="wave wave-2"/></div>
          <div className="in-hero-left">
            <div className="in-hero-avatar">{avatarSrc?<img src={avatarSrc} alt="Avatar"/>:<div className="in-hero-avatar__ph"/>}</div>
            <div className="in-hero-texts">
              <h3>¡Tu perfil está casi listo!</h3>
              <p>Has completado <strong>{progreso}%</strong>. Un perfil completo personaliza tus metas y la carga de entrenamiento.</p>
              <div className="in-checklist">
                {faltantes.length>0?faltantes.map((k)=>(<span key={k} className="in-chip"><span className="dot"/>{LABELS[k]}</span>))
                :(<span className="in-chip ok"><span className="tick">✓</span> Todo al día</span>)}
              </div>
              <div className="in-cta-row">
                <button className="in-btn-primary" onClick={()=>navigate("/PerfilNadador")}>Completar perfil</button>
                <span className="in-small-hint">{filled}/{total} campos clave</span>
              </div>
            </div>
          </div>
          <div className="in-hero-ring" aria-label={`Progreso ${progreso}%`}>
            <svg viewBox="0 0 120 120" className="ring">
              <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#2e5aa7"/><stop offset="100%" stopColor="#1aa1ff"/></linearGradient></defs>
              <circle className="ring-bg" cx="60" cy="60" r="52"/>
              <circle className="ring-fg" cx="60" cy="60" r="52" style={{strokeDasharray:`${(326*progreso)/100} 326`}}/>
              <text x="60" y="66" textAnchor="middle" className="ring-text">{progreso}%</text>
            </svg>
            <div className="swimmer" aria-hidden="true"></div>
          </div>
        </section>
      )}

      <section className="in-card in-train">
        <div className="in-tr-head">
          <h3>Tus entrenamientos</h3>
          <div className="in-tr-actions">
            <button className="in-btn-primary" onClick={()=>navigate("/EntrenamientoNadador")}>Registrar sesión</button>
            <button className="in-btn-ghost" onClick={()=>navigate("/EntrenamientoNadador")}>Abrir historial</button>
          </div>
        </div>

        {sesiones.length===0&&(
          <div className="in-tr-empty">
            <p>Aún no has registrado sesiones.</p>
            <button className="in-btn-primary" onClick={()=>navigate("/EntrenamientoNadador")}>Comenzar ahora</button>
          </div>
        )}

        {sesiones.length>0&&(
          <div className="in-tr-grid">
            <div className="in-tr-last">
              <div className="in-tr-kv"><span>Fecha</span><strong>{ultima.fechaLegible||fechaLarga(ultima.fecha)}</strong></div>
              <div className="in-tr-kv"><span>Tipo</span><strong>{ultima.tipo}</strong></div>
              <div className="in-tr-kv"><span>Duración</span><strong>{ultima.duracionMin?`${ultima.duracionMin} min`:"—"}</strong></div>
              <div className="in-tr-kv"><span>Distancia</span><strong>{ultima.tipo==="agua"?`${ultima.distanciaTotal||0} m`:"—"}</strong></div>
              <div className="in-tr-note">{ultima.notas||"Sin notas"}</div>
            </div>

            <div className="in-tr-charts">
              <div className="in-tr-chart">
                <div className="in-tr-title">Distancia últimas 8</div>
                <div className="in-tr-bars">
                  {distSeries.map((v,i)=>(
                    <div key={i} className="in-tr-bar">
                      <div className="in-tr-bar-fill" style={{height:`${Math.max(8,Math.round((v/maxD)*100))}%`}}/>
                      <div className="in-tr-cap">{v?`${v>=1000?(v/1000).toFixed(1)+'k':v}`:""}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="in-tr-chart">
                <div className="in-tr-title">Duración últimas 8</div>
                <div className="in-tr-bars">
                  {durSeries.map((v,i)=>(
                    <div key={i} className="in-tr-bar">
                      <div className="in-tr-bar-fill alt" style={{height:`${Math.max(8,Math.round((v/maxT)*100))}%`}}/>
                      <div className="in-tr-cap">{v?`${v}m`:""}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
