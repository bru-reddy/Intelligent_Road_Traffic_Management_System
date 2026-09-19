import React, { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("irtms_user") || "{}");
  } catch {
    return {};
  }
}

function Icon({ type }) {
  const paths = {
    home: "⌂",
    live: "◉",
    prediction: "▥",
    route: "⌖",
    more: "•••",
    analytics: "⌁",
    alerts: "!",
    users: "♙",
  };

  return <span aria-hidden="true">{paths[type] || "•"}</span>;
}

export default function MobileNav() {
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const user = useMemo(getStoredUser, []);

  const isCommissioner =
    String(user?.role || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_") === "commissioner";

  const primary = [
    { label: "Home", path: "/dashboard", icon: "home" },
    { label: "Live", path: "/live", icon: "live" },
    { label: "Predict", path: "/prediction", icon: "prediction" },
    { label: "Routes", path: "/routes", icon: "route" },
  ];

  const secondary = [
    { label: "Analytics", path: "/analytics", icon: "analytics" },
    { label: "Alerts", path: "/alerts", icon: "alerts" },
    ...(isCommissioner
      ? [{ label: "Users", path: "/users", icon: "users" }]
      : []),
  ];

  const logout = () => {
    [
      "token",
      "access_token",
      "auth_token",
      "accessToken",
      "irtms_token",
      "irtms_user",
      "currentUser",
      "user",
      "auth_user",
    ].forEach((key) => localStorage.removeItem(key));

    sessionStorage.clear();
    window.dispatchEvent(new Event("irtms-auth-changed"));
    navigate("/login", { replace: true });
  };

  return (
    <>
      <nav className="irtms-mobile-nav" aria-label="Mobile navigation">
        {primary.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `irtms-mobile-nav-item ${isActive ? "active" : ""}`
            }
            onClick={() => setMoreOpen(false)}
          >
            <span className="irtms-mobile-nav-icon">
              <Icon type={item.icon} />
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}

        <button
          type="button"
          className={`irtms-mobile-nav-item irtms-mobile-more ${moreOpen ? "active" : ""}`}
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
        >
          <span className="irtms-mobile-nav-icon">
            <Icon type="more" />
          </span>
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div
          className="irtms-mobile-more-backdrop"
          onClick={() => setMoreOpen(false)}
        >
          <section
            className="irtms-mobile-more-sheet"
            onClick={(event) => event.stopPropagation()}
            aria-label="More navigation"
          >
            <div className="irtms-mobile-more-handle" />
            <div className="irtms-mobile-more-header">
              <div>
                <strong>IRTMS</strong>
                <span>Traffic management</span>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            <div className="irtms-mobile-more-grid">
              {secondary.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className="irtms-mobile-more-item"
                  onClick={() => setMoreOpen(false)}
                >
                  <span className="irtms-mobile-more-icon">
                    <Icon type={item.icon} />
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>

            <button
              type="button"
              className="irtms-mobile-logout"
              onClick={logout}
            >
              Sign out
            </button>
          </section>
        </div>
      )}
    </>
  );
}
