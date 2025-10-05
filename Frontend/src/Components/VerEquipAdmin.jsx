import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "@sweetalert2/themes/borderless/borderless.css";
import logo from "/image.png";
import "./DOCSS/Admin.css";

const api = axios.create({
  baseURL: "http://localhost:3000",
  withCredentials: true,
});
api.interceptors.request.use((config) => {
  const t = localStorage.getItem("auth-token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export default function VerEquipoAdmin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const equipoId = params.get("id");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [equipo, setEquipo] = useState(null);
  const [miembros, setMiembros] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    if (!equipoId) return;

    const cargar = async () => {
      try {
        setLoading(true);
        setErr("");

        const [equiposRes, usuariosRes, miembrosRes] = await Promise.all([
          api.get("/api/equipos"),
          api.get("/api/usuarios"),
          api.get(`/api/equipos/${equipoId}/miembros`),
        ]);

        const equipos = Array.isArray(equiposRes.data) ? equiposRes.data : [];
        const users = Array.isArray(usuariosRes.data) ? usuariosRes.data : [];
        const miembrosRaw = Array.isArray(miembrosRes.data) ? miembrosRes.data : [];

        const found = equipos.find((e) => e.id === equipoId) || null;

        setEquipo(found || { id: equipoId, name: "(Equipo sin nombre)" });
        setUsuarios(users);

        const ownerId = found?.ownerId;

        // Normaliza para asegurar nombre/email y filtra solo nadadores
        const nadadores = miembrosRaw
          .filter((u) => (u.rol || u.rolUsuario) === "USER")
          .filter((u) => u.id !== ownerId)
          .map((u) => ({
            id: u.id,
            nombre: u.nombre_completo || u.nombre || "-",
            email: u.email || "-",
          }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre));

        setMiembros(nadadores);
      } catch (e) {
        console.error(e);
        setErr(e?.response?.data?.error || "No fue posible cargar el equipo");
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [equipoId]);

  const entrenadorNombre = useMemo(() => {
    if (!equipo || !usuarios.length) return "No asignado";
    const coach = usuarios.find((u) => u.id === equipo.ownerId);
    return coach?.nombre_completo || coach?.nombre || equipo.ownerEmail || "No asignado";
  }, [equipo, usuarios]);

  if (!equipoId) {
    return (
      <div className="admin-page">
        <div className="admin-overlay" />
        <header className="admin-header glass-strong">
          <div className="admin-header-left">
            <img src={logo} alt="Logo" className="admin-logo" />
            <div>
              <h1 className="admin-title">DETALLE DE EQUIPO</h1>
              <p className="admin-subtitle">
                Falta el parámetro <code>id</code>
              </p>
            </div>
          </div>
        </header>
        <main className="admin-content">
          <section className="card glass-strong">
            <button className="btn" onClick={() => navigate(-1)}>Volver</button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-overlay" />

      <header className="admin-header glass-strong">
        <div className="admin-header-left">
          <img src={logo} alt="Logo" className="admin-logo" />
          <div>
            <h1 className="admin-title">
              EQUIPO: {equipo?.name || equipo?.nombre || equipo?.id || "-"}
            </h1>
            <p className="admin-subtitle">
              Entrenador: <b>{entrenadorNombre}</b>
            </p>
          </div>
        </div>
        <div className="admin-header-right">
          <button className="btn" onClick={() => navigate(-1)}>Volver</button>
        </div>
      </header>

      <main className="admin-content">
        <section className="card glass-strong">
          <div className="card-head">
            <h2>Nadadores</h2>
            <div className="chip">
              {loading ? "Cargando..." : `${miembros.length} miembros`}
            </div>
          </div>

          {err && <div className="alert error">{err}</div>}

          {loading ? (
            <div className="skeleton-row" />
          ) : miembros.length === 0 ? (
            <div className="cell-empty" style={{ padding: 16 }}>
              Este equipo no tiene nadadores asignados.
            </div>
          ) : (
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th className="col-email">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {miembros.map((m) => (
                    <tr key={m.id}>
                      <td className="cell-strong">{m.nombre}</td>
                      <td className="col-email">{m.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
