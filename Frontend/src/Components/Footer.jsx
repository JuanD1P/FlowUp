import React from "react";
import "./DOCSS/Footer.css";

const Footer = () => {
  return (
    <footer className="fu-foot" role="contentinfo">
      <div className="fu-foot__top">
        <ul className="fu-foot__list fu-foot__list--left" aria-label="Enlaces legales">
          <li><a href="/aviso-legal">Aviso Legal</a></li>
          <li><a href="/politica-privacidad">Política de Privacidad</a></li>
          <li><a href="/politica-cookies">Política de Cookies</a></li>
          <li><a href="/politica-calidad">Política de Calidad</a></li>
        </ul>

        <div className="fu-foot__brand" aria-label="Marca y redes sociales">
          <div className="fu-foot__rule" />
          <div className="fu-foot__logo">FlowUp</div>
          <div className="fu-foot__rule" />
          <div className="fu-foot__social">
            <a aria-label="Facebook" href="#"><span className="fu-foot__icon">f</span></a>
            <a aria-label="Instagram" href="#"><span className="fu-foot__icon">ig</span></a>
            <a aria-label="YouTube" href="#"><span className="fu-foot__icon">▶</span></a>
            <a aria-label="Pinterest" href="#"><span className="fu-foot__icon">p</span></a>
            <a aria-label="LinkedIn" href="#"><span className="fu-foot__icon">in</span></a>
          </div>
        </div>

        <ul className="fu-foot__list fu-foot__list--right" aria-label="Soporte y recursos">
          <li><a href="/blog">Blog</a></li>
          <li><a href="/contacto">Contacto</a></li>
          <li><a href="/preguntas-frecuentes">Preguntas Frecuentes</a></li>
          <li><a href="/soporte">Soporte</a></li>
        </ul>
      </div>

      <div className="fu-foot__bottom">
        <p>
          <span className="fu-foot__sep">FlowUp</span>
          <span className="fu-foot__sep">Calle Falsa 123</span>
          <span className="fu-foot__sep">Facatativa, Colombia</span>
          <span className="fu-foot__sep">contacto@flowup.app</span>
          <span className="fu-foot__sep">+57 300 000 0000</span>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
