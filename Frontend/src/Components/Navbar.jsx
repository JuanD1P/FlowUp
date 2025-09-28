import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/client";
import "./DOCSS/Navbar.css";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const role = (localStorage.getItem("user-role") || "").toUpperCase();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("no-scroll", open);
    return () => document.documentElement.classList.remove("no-scroll");
  }, [open]);

  const logoSrc = "/flowuplogo.png";

  const roleText = useMemo(() => {
    if (role === "ADMIN") return " | Panel de Administrador";
    if (role === "USEREN") return " | Panel de Entrenador";
    if (role === "USER") return " | Panel de Nadador";
    return "";
  }, [role]);

  const MENU_BY_ROLE = {
    ADMIN: [
      { label: "Opción 1 Admin", to: "/admin/opcion-1" },
      { label: "Opción 2 Admin", to: "/admin/opcion-2" },
    ],
    USEREN: [
      { label: "Opción 1 Entrenador", to: "/entrenador/opcion-1" },
      { label: "Opción 2 Entrenador", to: "/entrenador/opcion-2" },
    ],
    USER: [
      { label: "Inicio", to: "/Inicio" },
      { label: "Mi Perfil", to: "/PerfilNadador" },
      
    ],
  };

  const roleMenu = MENU_BY_ROLE[role] || [];

  const go = (to) => {
    navigate(to);
    setOpen(false);
  };

  const handleLogout = async () => {
    try { await signOut(auth); } catch {}
    localStorage.removeItem("auth-token");
    localStorage.removeItem("user-role");
    navigate("/");
    window.location.reload();
  };

  const isActive = (to) => location.pathname.startsWith(to);

  return (
    <header className="fu-nav">
      <div className="fu-nav__inner">
        <div className="fu-nav__brand" onClick={() => go("/Inicio")} role="button" tabIndex={0}>
          <img src={logoSrc} alt="FlowUp" className="fu-nav__logo" />

          <span className="fu-nav__role">{roleText}</span>
        </div>

        <nav className="fu-nav__links fu-nav__links--desktop">
          {roleMenu.map((item) => (
            <button
              key={item.to}
              className={`fu-link ${isActive(item.to) ? "is-active" : ""}`}
              onClick={() => go(item.to)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="fu-nav__actions fu-nav__actions--desktop">
          <button className="fu-btn fu-btn--primary" onClick={handleLogout}>Cerrar sesión</button>
        </div>

        <button
          className="fu-nav__toggle"
          aria-label="Abrir menú"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span className="fu-nav__bar" />
          <span className="fu-nav__bar" />
          <span className="fu-nav__bar" />
        </button>
      </div>

      <div className={`fu-backdrop ${open ? "is-open" : ""}`} onClick={() => setOpen(false)} />

      <aside className={`fu-drawer ${open ? "is-open" : ""}`}>
        <div className="fu-drawer__header">
          <div className="fu-drawer__brand">
            <img src={logoSrc} alt="FlowUp" className="fu-drawer__logo" />
            <span className="fu-drawer__title">FlowUp</span>
          </div>
          <button className="fu-drawer__close" onClick={() => setOpen(false)}>×</button>
        </div>

        <nav className="fu-drawer__nav">
          <ul className="fu-menu">
            {roleMenu.map((item) => (
              <li key={item.to}>
                <button
                  className={`fu-menu__item ${isActive(item.to) ? "is-active" : ""}`}
                  onClick={() => go(item.to)}
                >
                  <span className="fu-menu__icon">•</span>
                  <span className="fu-menu__label">{item.label}</span>
                  <span className="fu-menu__chev">›</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="fu-drawer__footer">
          <button className="fu-btn fu-btn--primary fu-drawer__logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </header>
  );
};

export default Navbar;
