import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/client";
import "./DOCSS/Navbar.css";

const Navbar = () => {
  const navigate = useNavigate();
  const role = (localStorage.getItem("user-role") || "").toUpperCase();


  const logoSrc = "/flowuplogo.png";

  const roleText = useMemo(() => {
    if (role === "ADMIN") return "| Panel de Administrador";
    if (role === "USEREN") return "| Panel de Entrenador";
    if (role === "USER") return "| Panel de Nadador";
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
      { label: "Opción 1 Nadador", to: "/inicio/opcion-1" },
      { label: "Opción 2 Nadador", to: "/inicio/opcion-2" },
    ],
  };

  const roleMenu = MENU_BY_ROLE[role] || [];

  const go = (to) => navigate(to);
  const handleLogout = async () => {
    try { await signOut(auth); } catch {}
    localStorage.removeItem("auth-token");
    localStorage.removeItem("user-role");
    navigate("/"); 
    window.location.reload();
  };

  return (
    <header className="fu-nav">
      <div className="fu-nav__inner">
        <div className="fu-nav__brand">
          <img src={logoSrc} alt="FlowUp" className="fu-nav__logo" />
          <span style={{ fontWeight: "bold" }}>{roleText}</span>

        </div>

        <nav className="fu-nav__links">
          {roleMenu.map((item) => (
            <button
              key={item.to}
              className="fu-link"
              onClick={() => go(item.to)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="fu-nav__actions">
          <button className="fu-btn fu-btn--primary" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
