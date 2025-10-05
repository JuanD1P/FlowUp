import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { auth, db } from "../firebase/client";
import multiavatar from "@multiavatar/multiavatar";
import "./DOCSS/InicioNadador.css";

const CAMPOS_REQUERIDOS = ["nombre","fechaNacimiento","genero","alturaCm","pesoKg","categoria"];
const LABELS = { nombre:"Nombre", fechaNacimiento:"Fecha de nacimiento", genero:"Género", alturaCm:"Altura (cm)", pesoKg:"Peso (kg)", categoria:"Categoría" };

function svgToDataUrl(svgStr){
  const fixed = svgStr.replace("<svg ",`<svg preserveAspectRatio="xMidYMid meet" `);
  return `data:image/svg+xml;utf8,${encodeURIComponent(fixed)}`;
}
function padSeries(arr, n){
  const a = arr.slice(-n);
  const pad = Math.max(0, n - a.length);
  return Array(pad).fill(0).concat(a);
}
function fechaLarga(d){
  if(!d) return "—";
  const x = new Date(d);
  return isNaN(x) ? "—" : x.toLocaleDateString("es-ES",{ day:"numeric", month:"long", year:"numeric" });
}
function kmFormat(m){
  if(!m) return "0";
  return m >= 1000 ? (m/1000).toFixed(1)+"k" : String(m);
}
function startOfDay(ts){
  const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime();
}
function useCountUp(target=0, duration=900){
  const [val, setVal] = useState(0);
  useEffect(()=>{
    const start = performance.now();
    let raf;
    const step = (t)=>{
      const p = Math.min(1, (t - start) / duration);
      setVal(Math.round(target * p));
      if(p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return ()=> cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function BarsChart({ title, series=[], max=1, unit="", accent="aqua" }) {
  const width=360, height=190, pad=18, gap=10;
  const n=series.length||1, bw=(width-pad*2-gap*(n-1))/n;
  const gid = useMemo(()=>`g-${accent}-${Math.random().toString(36).slice(2,7)}`,[accent]);
  const yScale = v=>{
    const h=height-pad*2;
    const r=Math.max(0,Math.min(1,(v||0)/(max||1)));
    return height-pad-(h*r);
  };
  return (
    <div className="chart-neo svg">
      <div className="chart-title-neo">{title}</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label={title}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent==="aqua"?"#3fb0ff":"#3c6cff"} />
            <stop offset="100%" stopColor={accent==="aqua"?"#1283e6":"#1e4ed8"} />
          </linearGradient>
        </defs>
        {[0,1,2,3,4].map(i=>{
          const y=pad+((height-pad*2)/4)*i;
          return <line key={i} x1={pad} y1={y} x2={width-pad} y2={y} className="grid-line"/>;
        })}
        {series.map((v,i)=>{
          const x=pad+i*(bw+gap);
          const y=yScale(v);
          const h=Math.max(12,height-pad-y);
          const label = unit ? `${v}${unit}` : kmFormat(v);
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={h} rx="10" ry="10" fill={`url(#${gid})`} className="bar-shadow" style={{animationDelay:`${i*45}ms`}} />
              {v>0 && <text x={x+bw/2} y={y-6} textAnchor="middle" className="bar-cap-svg">{label}</text>}
            </g>
          );
        })}
        <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} className="axis"/>
      </svg>
    </div>
  );
}

function SnapCarousel({ items=[], renderItem }) {
  const ref = useRef(null);
  const by = (dir)=>{
    const el=ref.current; if(!el) return;
    const card=el.querySelector(".snap-card");
    const step = card ? (card.clientWidth + 12) : 260;
    el.scrollBy({ left: dir*step, behavior:"smooth" });
  };
  if(items.length===0) return null;
  return (
    <div className="carousel-wrap">
      <button className="car-btn left" onClick={()=>by(-1)} aria-label="Anterior">‹</button>
      <div className="snap-row" ref={ref}>
        {items.map(renderItem)}
      </div>
      <button className="car-btn right" onClick={()=>by(1)} aria-label="Siguiente">›</button>
    </div>
  );
}

export default function Inicio(){
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState("");
  const [sesiones, setSesiones] = useState([]);
  const [queryTxt, setQueryTxt] = useState("");
  const [tipo, setTipo] = useState("todas");
  const navigate = useNavigate();

  useEffect(()=>{
    document.body.classList.add("page-inicio-soft");
    return ()=>document.body.classList.remove("page-inicio-soft");
  },[]);

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async (user)=>{
      if(!user){ navigate("/userlogin"); return; }
      setUid(user.uid);
      try{
        const ref = doc(db, "usuarios", user.uid);
        const snap = await getDoc(ref);
        setPerfil(snap.exists()? snap.data() : { perfilCompleto:false, nadador:{} });
      } finally { setLoading(false); }
    });
    return ()=>unsub();
  },[navigate]);

  useEffect(()=>{
    if(!uid) return;
    const col = collection(db, "usuarios", uid, "entrenamientos");
    const qy = query(col, orderBy("startMs","desc"));
    const off = onSnapshot(qy, (snap)=>{
      setSesiones(snap.docs.map(d=>({ id:d.id, ...d.data() })));
    });
    return ()=>off();
  },[uid]);

  const data = perfil || {};
  const avatarSrc = useMemo(()=>{
    if(data?.fotoURL) return data.fotoURL;
    try{
      const seed = data?.avatarSeed || data?.nombre || "FlowUp";
      return svgToDataUrl(multiavatar(seed));
    }catch{ return ""; }
  },[data?.avatarSeed, data?.nombre, data?.fotoURL]);

  const nad = data.nadador || {};
  const filled = CAMPOS_REQUERIDOS.filter(k => !!nad[k] || !!data[k]).length;
  const total = CAMPOS_REQUERIDOS.length;
  const progreso = Math.max(0,Math.min(100,Math.round((filled/total)*100)));
  const faltantes = CAMPOS_REQUERIDOS.filter(k => !(nad[k] || data[k]));
  const incompleto = !data.perfilCompleto || progreso < 100;

  const ultima = sesiones[0];
  const agua = sesiones.filter(s=>s.tipo==="agua");
  const distSeries = padSeries(agua.map(s=>s.distanciaTotal||0), 8);
  const durSeries  = padSeries(sesiones.map(s=>s.duracionMin||0), 8);
  const maxD = Math.max(1, ...distSeries);
  const maxT = Math.max(1, ...durSeries);

  const totalSes = sesiones.length;
  const totalDist = agua.reduce((a,b)=>a+(b.distanciaTotal||0),0);
  const promDur = sesiones.length ? Math.round(durSeries.reduce((a,b)=>a+b,0)/Math.min(8,sesiones.length)) : 0;

  const daysWithSession = Array.from(new Set(sesiones.map(s=>startOfDay(s.startMs||s.fecha||0)))).sort((a,b)=>b-a);
  let racha = 0;
  let cursor = startOfDay(Date.now());
  for(const d of daysWithSession){
    if(d === cursor){ racha++; cursor -= 86400000; } else if(d > cursor){ continue; } else { break; }
  }

  const cSes  = useCountUp(loading?0:totalSes, 900);
  const cProg = useCountUp(loading?0:progreso, 900);
  const cProm = useCountUp(loading?0:promDur, 900);
  const cDist = useCountUp(loading?0:totalDist, 900);
  const cRacha= useCountUp(loading?0:racha, 900);

  const sesionesFiltradas = useMemo(()=>{
    let arr = [...sesiones];
    if(tipo !== "todas") arr = arr.filter(s=> (s.tipo||"").toLowerCase() === tipo);
    if(queryTxt.trim()){
      const q = queryTxt.toLowerCase();
      arr = arr.filter(s=>{
        const f = (s.fechaLegible || fechaLarga(s.fecha) || "").toLowerCase();
        const n = (s.notas || "").toLowerCase();
        const t = (s.tipo || "").toLowerCase();
        return f.includes(q) || n.includes(q) || t.includes(q);
      });
    }
    return arr.slice(0,50);
  },[sesiones, tipo, queryTxt]);

  return (
    <div className="in-wrap">
      <section className="hero-neo">
        <div className="hero-waves" aria-hidden="true">
          <svg viewBox="0 0 1440 160" preserveAspectRatio="none">
            <path className="w1" d="M0,80 C240,40 480,120 720,80 C960,40 1200,110 1440,70 L1440,160 L0,160 Z"></path>
            <path className="w2" d="M0,90 C240,50 480,130 720,90 C960,50 1200,120 1440,80 L1440,160 L0,160 Z"></path>
            <path className="w3" d="M0,100 C240,60 480,140 720,100 C960,60 1200,130 1440,90 L1440,160 L0,160 Z"></path>
          </svg>
        </div>
        <div className="hero-left">
          <div className="avatar-neo">
            {avatarSrc ? <img src={avatarSrc} alt="Avatar del deportista" loading="lazy" decoding="async" /> : <div className="avatar-ph-neo"/>}
          </div>
          <div>
            <h1 className="h-title">Hola, {data.nombre || "deportista"}</h1>
            <p className="h-sub">Entrena con propósito. Visualiza, compara y supera tu marca.</p>
            <div className="h-actions">
              <button className="b-primary" onClick={()=>navigate("/EntrenamientoNadador")}>Registrar sesión</button>
              <button className="b-ghost" onClick={()=>navigate("/HistorialNadador")}>Historial</button>
              <button className="b-soft" onClick={()=>navigate("/PerfilNadador")}>Perfil</button>
            </div>
          </div>
        </div>
        <div className="hero-right">
          <div className="mini stat"><span>Sesiones</span><strong>{cSes}</strong></div>
          <div className="mini stat"><span>Perfil</span><strong>{cProg}%</strong></div>
          <div className="mini stat"><span>Racha</span><strong>{cRacha}d</strong></div>
          <div className="mini stat"><span>Prom. duración</span><strong>{cProm}m</strong></div>
          <div className="mini stat"><span>Distancia total</span><strong>{cDist>=1000?(cDist/1000).toFixed(1):cDist} m</strong></div>
        </div>
      </section>

      {incompleto && (
        <section className="panel-neo">
          <div className="panel-l">
            <h3 className="p-title">Completa tu perfil</h3>
            <p className="p-text">Has completado el {progreso}%. Mejora recomendaciones y cargas de trabajo.</p>
            <div className="chips-neo">
              {faltantes.length>0 ? faltantes.map(k=>(<span key={k} className="chip-neo"><i/> {LABELS[k]}</span>)) : (<span className="chip-neo ok">Todo al día</span>)}
            </div>
            <button className="b-primary" onClick={()=>navigate("/PerfilNadador")}>Editar perfil</button>
          </div>
          <div className="panel-r">
            <svg viewBox="0 0 160 160" className="ring-neo" aria-label="Progreso de perfil">
              <circle cx="80" cy="80" r="68" className="ring-bg-neo"/>
              <circle cx="80" cy="80" r="68" className="ring-fg-neo" style={{strokeDasharray:`${(427*(Number.isFinite(cProg)?cProg:0))/100} 427`}}/>
              <text x="80" y="88" textAnchor="middle" className="ring-txt-neo">{cProg}%</text>
            </svg>
          </div>
        </section>
      )}

      <section className="card-neo headless">
        <div className="head-inline">
          <h3 className="card-title-neo">Tus entrenamientos</h3>
          <div className="card-actions-neo">
            <button className="b-ghost" onClick={()=>navigate("/EntrenamientoNadador")}>Abrir</button>
            <button className="b-primary" onClick={()=>navigate("/EntrenamientoNadador")}>Nuevo</button>
          </div>
        </div>
        {loading && (
          <div className="skeleton-neo">
            <div className="s-row" />
            <div className="s-grid">
              <div className="s-card" /><div className="s-card" />
            </div>
          </div>
        )}
        {!loading && sesiones.length===0 && (
          <div className="empty-neo">
            <p>Comienza a registrar tu primera sesión</p>
            <button className="b-primary" onClick={()=>navigate("/EntrenamientoNadador")}>Empezar</button>
          </div>
        )}
        {!loading && sesiones.length>0 && (
          <div className="train-neo">
            <div className="last-neo">
              <div className="kv-neo"><span>Fecha</span><strong>{ultima?.fechaLegible || fechaLarga(ultima?.fecha)}</strong></div>
              <div className="kv-neo"><span>Tipo</span><strong>{ultima?.tipo || "—"}</strong></div>
              <div className="kv-neo"><span>Duración</span><strong>{ultima?.duracionMin?`${ultima.duracionMin} min`:"—"}</strong></div>
              <div className="kv-neo"><span>Distancia</span><strong>{ultima?.tipo==="agua"?`${ultima?.distanciaTotal||0} m`:"—"}</strong></div>
              <div className="note-neo">{ultima?.notas || "Sin notas"}</div>
            </div>
            <div className="charts-neo">
              <BarsChart title="Distancia últimas 8" series={distSeries} max={maxD} unit="" accent="aqua" />
              <BarsChart title="Duración últimas 8" series={durSeries} max={maxT} unit="m" accent="blue" />
            </div>
          </div>
        )}
      </section>

      {sesiones.length>0 && (
        <section className="card-neo">
          <div className="summary-grid">
            <div className="badge-neo">
              <span>Semana (distancia)</span>
              <strong>
                {kmFormat(
                  agua
                    .filter(s=>{
                      const d=new Date(s.startMs||Date.now());
                      const now=new Date();
                      const weekStart=new Date(now); weekStart.setDate(now.getDate()-6);
                      weekStart.setHours(0,0,0,0);
                      return d>=weekStart;
                    })
                    .reduce((a,b)=>a+(b.distanciaTotal||0),0)
                )} m
              </strong>
            </div>
            <div className="badge-neo">
              <span>Sesión más larga</span>
              <strong>{Math.max(...durSeries,0) || 0} min</strong>
            </div>
            <div className="badge-neo">
              <span>Días con actividad (30d)</span>
              <strong>{
                Array.from(new Set(
                  sesiones
                    .filter(s=>{
                      const now=Date.now();
                      return (now - (s.startMs||now)) <= (30*86400000);
                    })
                    .map(s=>startOfDay(s.startMs||Date.now()))
                )).length
              }</strong>
            </div>
          </div>
        </section>
      )}

      {sesiones.length>0 && (
        <section className="card-neo">
          <h3 className="card-title-neo">Tus últimas sesiones</h3>
          <SnapCarousel
            items={sesiones.slice(0,16)}
            renderItem={(s)=>(
              <article key={s.id} className="snap-card" role="article" aria-label={`Sesión ${s.tipo}`}>
                <div className={`snap-top tag-${s.tipo || "otro"}`}>{s.tipo || "—"}</div>
                <div className="snap-date">{s.fechaLegible || fechaLarga(s.fecha)}</div>
                <div className="snap-grid">
                  <div><span>Duración</span><strong>{s.duracionMin?`${s.duracionMin} min`:"—"}</strong></div>
                  <div><span>Distancia</span><strong>{s.tipo==="agua"?`${s.distanciaTotal||0} m`:"—"}</strong></div>
                </div>
              </article>
            )}
          />
        </section>
      )}

      {sesiones.length>0 && (
        <section className="card-neo">
          <div className="head-inline">
            <h3 className="card-title-neo">Historial</h3>
            <div className="hist-controls">
              <div className="seg">
                <button className={`seg-btn ${tipo==="todas"?"on":""}`} onClick={()=>setTipo("todas")}>Todas</button>
                <button className={`seg-btn ${tipo==="agua"?"on":""}`} onClick={()=>setTipo("agua")}>Agua</button>
                <button className={`seg-btn ${tipo==="tierra"?"on":""}`} onClick={()=>setTipo("tierra")}>Tierra</button>
              </div>
              <input className="hist-search" placeholder="Buscar por fecha, tipo o nota" value={queryTxt} onChange={e=>setQueryTxt(e.target.value)} />
            </div>
          </div>
          <div className="hist-table">
            <div className="hist-row head">
              <div>Fecha</div>
              <div>Tipo</div>
              <div>Duración</div>
              <div>Distancia</div>
              <div>Notas</div>
            </div>
            {sesionesFiltradas.map(s=>(
              <div key={s.id} className="hist-row">
                <div>{s.fechaLegible || fechaLarga(s.fecha)}</div>
                <div className={`tag ${s.tipo}`}>{s.tipo || "—"}</div>
                <div>{s.duracionMin?`${s.duracionMin} min`:"—"}</div>
                <div>{s.tipo==="agua"?`${s.distanciaTotal||0} m`:"—"}</div>
                <div className="ellipsis">{s.notas || "—"}</div>
              </div>
            ))}
            {sesionesFiltradas.length===0 && <div className="hist-empty">Sin resultados para el filtro actual</div>}
          </div>
        </section>
      )}

      <footer className="foot-neo">
        <span>FlowUp</span>
        <span>Hecho para superarte</span>
      </footer>

      {loading && (
        <div className="loader-overlay" aria-hidden="true">
          <div className="loader-veil"><div className="loader-dot"/><div className="loader-dot"/><div className="loader-dot"/></div>
        </div>
      )}
    </div>
  );
}
