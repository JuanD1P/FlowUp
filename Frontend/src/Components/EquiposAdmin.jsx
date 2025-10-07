// src/components/EquiposAdmin.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
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

export default function EquiposAdmin() {
  const navigate = useNavigate();
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    obtenerEquipos();
  }, []);

  const obtenerEquipos = async () => {
    try {
      setLoading(true);
      setError("");

      // Trae equipos y usuarios en paralelo
      const [equiposRes, usuariosRes] = await Promise.all([
        api.get("/api/equipos"),
        api.get("/api/usuarios"),
      ]);

      const listaEquipos = Array.isArray(equiposRes.data) ? equiposRes.data : [];
      const listaUsuarios = Array.isArray(usuariosRes.data) ? usuariosRes.data : [];

      // Índice rápido por id de usuario
      const usuariosById = new Map(listaUsuarios.map((u) => [u.id, u]));

      // Enriquecer: nombre visible, entrenador y conteo de miembros (excluye al owner)
      const enriched = listaEquipos.map((eq) => {
        const entrenador = usuariosById.get(eq.ownerId);
        const entrenadorNombre =
          entrenador?.nombre_completo ||
          entrenador?.nombre ||
          eq.ownerEmail ||
          "No asignado";

        let miembrosCount = 0;
        if (Array.isArray(eq.miembros)) {
          miembrosCount = eq.miembros.filter((uid) => uid && uid !== eq.ownerId).length;
        } else if (Number.isFinite(eq.swimmersCount)) {
          miembrosCount = Math.max(0, eq.swimmersCount - 1);
        }

        return {
          ...eq,
          nombreVisible: eq.name || eq.nombre || "-",
          entrenadorNombre,
          miembrosCount,
        };
      });

      setEquipos(enriched);
    } catch (err) {
      setError(err?.response?.data?.error || "No fue posible cargar los equipos");
    } finally {
      setLoading(false);
    }
  };

  const eliminarEquipo = async (id, nombre) => {
    // deshabilitar botón mientras está abierto el modal
    setDeletingId(id);

    const result = await Swal.fire({
      title: "¿Eliminar equipo?",
      html: `Esto eliminará el documento del equipo <b>${nombre || id}</b>.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        popup: "sw-popup",
        title: "sw-title",
        htmlContainer: "sw-text",
        actions: "sw-actions",
        confirmButton: "sw-confirm",
        cancelButton: "sw-cancel",
      },
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          await api.delete(`/api/equipos/${id}`);
        } catch (error) {
          Swal.showValidationMessage(
            error?.response?.data?.error || "No fue posible eliminar el equipo"
          );
          return false;
        }
      },
    });

    // Si canceló, liberar botón y salir
    if (!result.isConfirmed) {
      setDeletingId(null);
      return;
    }

    // Ya se eliminó en el backend: actualiza UI
    setEquipos((prev) => prev.filter((e) => e.id !== id));

    await Swal.fire({
      icon: "success",
      title: "Equipo eliminado",
      timer: 1200,
      showConfirmButton: false,
      customClass: { popup: "sw-popup" },
      buttonsStyling: false,
    });

    setDeletingId(null);
  };

  return (
    <div className="admin-page">
      <div className="admin-overlay" />

      <header className="admin-header glass-strong">
        <div className="admin-header-left">
          <img src={logo} alt="Logo" className="admin-logo" />
          <div>
            <h1 className="admin-title">GESTIÓN DE EQUIPOS</h1>
            <p className="admin-subtitle">Nombre del equipo, entrenador y miembros</p>
          </div>
        </div>
      </header>

      <main className="admin-content">
        <section className="card glass-strong">
          <div className="card-head">
            <h2>Equipos</h2>
            <div className="chip">{loading ? "Cargando..." : `${equipos.length} equipos`}</div>
          </div>

          {error && <div className="alert error">{error}</div>}

          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre del equipo</th>
                  <th>Entrenador</th>
                  <th>Miembros</th>
                  <th style={{ minWidth: 220 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="skeleton-row" />
                      <div className="skeleton-row" />
                      <div className="skeleton-row" />
                    </td>
                  </tr>
                ) : equipos.length ? (
                  equipos.map((eq) => (
                    <tr key={eq.id}>
                      <td className="cell-strong">{eq.nombreVisible}</td>
                      <td>{eq.entrenadorNombre}</td>
                      <td className="text-center">{eq.miembrosCount}</td>
                      <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="btn"
                          onClick={() => navigate(`/VerEquipAdmin?id=${eq.id}`)}
                          title="Ver equipo"
                        >
                          Ver equipo
                        </button>
                        <button
                          className="btn danger"
                          onClick={() => eliminarEquipo(eq.id, eq.nombreVisible)}
                          title="Eliminar equipo"
                          disabled={deletingId === eq.id}
                        >
                          <span className="x">✖</span>{" "}
                          {deletingId === eq.id ? "Eliminando..." : "Eliminar"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="cell-empty">
                      No hay equipos registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
