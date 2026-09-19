import React from "react";
import { useLocation } from "react-router-dom";

const ROLE_LABELS = {
  commoner: "Commoner",
  traffic_operator: "Traffic Operator",
  system_operator: "System Operator",
  commissioner: "Commissioner",
};

function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const aliases = {
    commoner: "commoner",
    user: "commoner",
    citizen: "commoner",

    traffic_operator: "traffic_operator",
    trafficoperator: "traffic_operator",

    system_operator: "system_operator",
    systemoperator: "system_operator",

    commissioner: "commissioner",
  };

  return aliases[value] || value;
}

function getRoleLabel(role) {
  return ROLE_LABELS[normalizeRole(role)] || "User";
}

function getDisplayName(user) {
  const directName =
    user?.full_name ||
    user?.fullName ||
    user?.name;

  if (directName) {
    return String(directName).trim();
  }

  const firstName =
    user?.first_name ||
    user?.firstName ||
    "";

  const lastName =
    user?.last_name ||
    user?.lastName ||
    "";

  const combined =
    `${firstName} ${lastName}`.trim();

  return combined || "User";
}

function getInitials(user) {
  const displayName = getDisplayName(user);

  if (!displayName || displayName === "User") {
    return "US";
  }

  const parts = displayName
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`
    .toUpperCase();
}

function getPageName(pathname) {
  if (
    pathname === "/" ||
    pathname === "/dashboard"
  ) {
    return "Dashboard";
  }

  if (
    pathname === "/live" ||
    pathname.startsWith("/live/")
  ) {
    return "Live Monitoring";
  }

  if (pathname.startsWith("/prediction")) {
    return "Traffic Prediction";
  }

  if (pathname.startsWith("/routes")) {
    return "Route Planner";
  }

  if (pathname.startsWith("/alerts")) {
    return "Alerts";
  }

  if (pathname.startsWith("/analytics")) {
    return "Analytics";
  }

  if (pathname.startsWith("/users")) {
    return "User Management";
  }

  return "Dashboard";
}

function getStoredUser() {
  const keys = [
    "irtms_user",
    "currentUser",
    "user",
    "auth_user",
  ];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw);

      if (
        parsed &&
        typeof parsed === "object"
      ) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return {};
}

export default function TopNavbar({
  user: suppliedUser = {},
  onMenuClick,
  showMobileMenu = true,
}) {
  const location = useLocation();

  const [storedUser, setStoredUser] =
    React.useState(getStoredUser);

  React.useEffect(() => {
    const refreshUser = () => {
      setStoredUser(getStoredUser());
    };

    window.addEventListener(
      "storage",
      refreshUser
    );

    window.addEventListener(
      "irtms-auth-changed",
      refreshUser
    );

    return () => {
      window.removeEventListener(
        "storage",
        refreshUser
      );

      window.removeEventListener(
        "irtms-auth-changed",
        refreshUser
      );
    };
  }, []);

  const user =
    suppliedUser &&
    Object.keys(suppliedUser).length > 0
      ? suppliedUser
      : storedUser;

  const pageName = getPageName(
    location.pathname
  );

  const displayName =
    getDisplayName(user);

  const roleLabel =
    getRoleLabel(
      user?.role ||
        user?.user_role ||
        user?.userRole
    );

  const initials =
    getInitials(user);

  return (
    <header className="top-navbar">
      <div className="navbar-left">
        {showMobileMenu && (
          <button
            type="button"
            className="mobile-menu-button"
            onClick={onMenuClick}
            aria-label="Open navigation"
          >
            ☰
          </button>
        )}

        <div className="navbar-page-info">
          <span className="navbar-system-name">
            Intelligent Road Traffic Monitoring
            System (IRTMS)
          </span>

          <span className="navbar-divider">
            /
          </span>

          <span className="navbar-current-page">
            {pageName}
          </span>
        </div>
      </div>

      <div className="navbar-right">
        <div
          className="navbar-user"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            minWidth: "190px",
            maxWidth: "260px",
          }}
        >
          <div
            className="navbar-user-avatar"
            style={{
              flex: "0 0 38px",
              width: "38px",
              height: "38px",
              display: "grid",
              placeItems: "center",
            }}
          >
            {initials}
          </div>

          <div
            className="navbar-user-details"
            style={{
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "center",
              gap: "3px",
              lineHeight: 1.2,
              overflow: "hidden",
            }}
          >
            <strong
              style={{
                display: "block",
                width: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "#ffffff",
              }}
            >
              {displayName}
            </strong>

            <span
              style={{
                display: "block",
                color: "#9fc1dc",
                fontSize: "11px",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {roleLabel}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}