import React, { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("irtms_user") || "{}");
  } catch {
    return {};
  }
}

function Icon({ type, size = 21 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  const paths = {
    home: (
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M9 21v-6h6v6" />
      </>
    ),
    live: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="m7 9 3 3 5-5" />
      </>
    ),
    prediction: (
      <>
        <path d="M4 19V10" />
        <path d="M10 19V5" />
        <path d="M16 19v-8" />
        <path d="M22 19V3" />
        <path d="M3 21h20" />
      </>
    ),
    route: (
      <>
        <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
        <circle cx="12" cy="9" r="2.3" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
      </>
    ),
    analytics: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h17" />
        <path d="m7 15 4-4 3 2 5-7" />
      </>
    ),
    alerts: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20c.4-3.2 2.4-5 6-5s5.6 1.8 6 5" />
        <path d="M15 15c3 0 5 1.5 5.5 4" />
      </>
    ),
  };

  return <svg {...common}>{paths[type] || paths.more}</svg>;
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
                    <Icon type={item.icon} size={20} />
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
