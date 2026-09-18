import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

const ROLE_LABELS = {
  commoner: "Commoner",
  traffic_operator: "Traffic Operator",
  system_operator: "System Operator",
  commissioner: "Commissioner",
};

const PAGE_NAMES = {
  "/dashboard": "Dashboard",
  "/live": "Live Monitoring",
  "/prediction": "Traffic Prediction",
  "/routes": "Route Planner",
  "/analytics": "Analytics",
  "/alerts": "Alerts",
  "/users": "User Management",
};

function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (
    value === "trafficoperator" ||
    value === "traffic_operator"
  ) {
    return "traffic_operator";
  }

  if (
    value === "systemoperator" ||
    value === "system_operator" ||
    value === "operator"
  ) {
    return "system_operator";
  }

  if (value === "commissioner") {
    return "commissioner";
  }

  return "commoner";
}

function getStoredUser() {
  try {
    const stored =
      localStorage.getItem("irtms_user") ||
      localStorage.getItem("user");

    if (!stored) {
      return null;
    }

    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function getInitials(name) {
  const value = String(name || "User").trim();

  if (!value) {
    return "U";
  }

  const parts = value
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function clearAuthData() {
  const keys = [
    "irtms_token",
    "irtms_user",
    "token",
    "user",
    "access_token",
    "auth_token",
  ];

  keys.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = getStoredUser();

  const role = normalizeRole(user?.role);

  const roleLabel =
    ROLE_LABELS[role] || ROLE_LABELS.commoner;

  const pageName =
    PAGE_NAMES[location.pathname] ||
    "Dashboard";

  const userName =
    user?.full_name ||
    user?.name ||
    user?.username ||
    "Authenticated User";

  const initials = getInitials(userName);

  const handleDashboard = () => {
    navigate("/dashboard");
  };

  const handleLogout = () => {
    clearAuthData();

    navigate("/login", {
      replace: true,
    });
  };

  return (
    <header
      className="irtms-navbar"
      style={{
        position: "relative",
        zIndex: 100,
        width: "100%",
        minHeight: "78px",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "28px",
        padding: "14px 32px",
        background:
          "linear-gradient(180deg, #06284d 0%, #052341 100%)",
        borderBottom:
          "1px solid rgba(96, 183, 239, 0.28)",
        color: "#ffffff",
      }}
    >
      <div
        className="irtms-navbar-left"
        style={{
          minWidth: 0,
          flex: "1 1 auto",
          display: "flex",
          alignItems: "center",
          gap: "18px",
        }}
      >
        <button
          type="button"
          onClick={handleDashboard}
          aria-label="Go to dashboard"
          className="irtms-navbar-home"
          style={{
            width: "38px",
            height: "38px",
            flex: "0 0 38px",
            display: "grid",
            placeItems: "center",
            padding: 0,
            border: "1px solid rgba(124, 204, 255, 0.35)",
            borderRadius: "9px",
            background: "#ffffff",
            color: "#176ed0",
            cursor: "pointer",
            fontSize: "20px",
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          ≡
        </button>

        <div
          className="irtms-navbar-title-area"
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "4px",
          }}
        >
          <div
            className="irtms-navbar-system-title"
            style={{
              margin: 0,
              padding: 0,
              color: "#ffffff",
              fontSize: "15px",
              lineHeight: 1.25,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Intelligent Road Traffic Monitoring System (IRTMS)
          </div>

          <div
            className="irtms-navbar-breadcrumb"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              color: "#9fc5e6",
              fontSize: "11px",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                color: "#6ebcf0",
                fontWeight: 700,
              }}
            >
              IRTMS
            </span>

            <span
              style={{
                color: "#587e9f",
              }}
            >
              /
            </span>

            <span
              style={{
                color: "#c1d9ed",
              }}
            >
              {pageName}
            </span>
          </div>
        </div>
      </div>

      <div
        className="irtms-navbar-right"
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <div
          className="irtms-navbar-live"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: 750,
            whiteSpace: "nowrap",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#26d6a4",
              boxShadow:
                "0 0 0 4px rgba(38, 214, 164, 0.12)",
            }}
          />

          <span>Live</span>
        </div>

        <div
          className="irtms-navbar-divider"
          style={{
            width: "1px",
            height: "30px",
            background:
              "rgba(159, 197, 230, 0.22)",
          }}
        />

        <div
          className="irtms-navbar-user"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            minWidth: 0,
          }}
        >
          <div
            className="irtms-navbar-avatar"
            aria-hidden="true"
            style={{
              width: "36px",
              height: "36px",
              flex: "0 0 36px",
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, #147bd5, #0b579d)",
              border:
                "1px solid rgba(145, 214, 255, 0.45)",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            {initials}
          </div>

          <div
            className="irtms-navbar-user-text"
            style={{
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "3px",
            }}
          >
            <strong
              style={{
                display: "block",
                maxWidth: "180px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "#ffffff",
                fontSize: "11px",
                lineHeight: 1.2,
                fontWeight: 800,
              }}
            >
              {userName}
            </strong>

            <span
              style={{
                display: "block",
                color: "#9fc5e6",
                fontSize: "10px",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}
            >
              {roleLabel}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="irtms-navbar-logout"
          style={{
            minHeight: "34px",
            padding: "0 13px",
            borderRadius: "7px",
            border:
              "1px solid rgba(107, 183, 235, 0.38)",
            background:
              "rgba(20, 103, 169, 0.20)",
            color: "#dceeff",
            fontSize: "10px",
            fontWeight: 750,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}