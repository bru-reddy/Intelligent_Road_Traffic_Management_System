import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

function Icon({ name, size = 21 }) {
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

    monitor: (
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
        <path d="M5 19h-2" />
        <path d="M21 19h-2" />
      </>
    ),

    analytics: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h17" />
        <path d="m7 15 4-4 3 2 5-7" />
        <circle cx="7" cy="15" r="1" />
        <circle cx="11" cy="11" r="1" />
        <circle cx="14" cy="13" r="1" />
        <circle cx="19" cy="6" r="1" />
      </>
    ),

    alert: (
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

    logout: (
      <>
        <path d="M10 5H5v14h5" />
        <path d="m14 8 4 4-4 4" />
        <path d="M18 12H9" />
      </>
    ),

    chevron: (
      <path d="m9 18 6-6-6-6" />
    ),

    menu: (
      <>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function TrafficLogo() {
  return (
    <div className="irtms-sidebar-logo" aria-hidden="true">
      <svg
        viewBox="0 0 82 82"
        width="54"
        height="54"
        fill="none"
      >
        <rect
          x="2"
          y="2"
          width="78"
          height="78"
          rx="17"
          fill="url(#irtmsLogoGradient)"
        />

        <path
          d="M17 67c8-15 11-26 11-42"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
        />

        <path
          d="M26 67c5-10 7-19 7-29"
          stroke="#7dd3fc"
          strokeWidth="2.5"
          strokeDasharray="6 5"
          strokeLinecap="round"
        />

        <rect
          x="38"
          y="11"
          width="19"
          height="39"
          rx="8"
          fill="#0a2745"
          stroke="#fff"
          strokeWidth="2"
        />

        <circle
          cx="47.5"
          cy="20"
          r="5"
          fill="#ef4444"
        />

        <circle
          cx="47.5"
          cy="31"
          r="5"
          fill="#fbbf24"
        />

        <circle
          cx="47.5"
          cy="42"
          r="5"
          fill="#22c55e"
        />

        <path
          d="M47.5 50v13"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <path
          d="M38 63h20"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <defs>
          <linearGradient
            id="irtmsLogoGradient"
            x1="8"
            y1="8"
            x2="74"
            y2="74"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#1688e8" />
            <stop
              offset="1"
              stopColor="#0755a1"
            />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function TrafficAnimation() {
  return (
    <div
      className="irtms-sidebar-traffic"
      aria-hidden="true"
    >
      <div className="irtms-cityline">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="irtms-road">
        <div className="irtms-road-line">
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="irtms-moving-car">
          <div className="irtms-car-body">
            <span className="irtms-car-window" />
            <span className="irtms-car-front" />
          </div>

          <span className="irtms-car-wheel left" />
          <span className="irtms-car-wheel right" />
        </div>
      </div>
    </div>
  );
}

function readUser() {
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
    operator: "traffic_operator",

    system_operator: "system_operator",
    systemoperator: "system_operator",

    commissioner: "commissioner",
  };

  return aliases[value] || value;
}

function roleLabel(role) {
  const labels = {
    commoner: "Commoner",
    traffic_operator: "Traffic Operator",
    system_operator: "System Operator",
    commissioner: "Commissioner",
  };

  return (
    labels[normalizeRole(role)] ||
    "Commoner"
  );
}

function getDisplayName(user) {
  const fullName =
    user?.full_name ||
    user?.fullName;

  if (
    typeof fullName === "string" &&
    fullName.trim()
  ) {
    return fullName.trim();
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

  if (combined) {
    return combined;
  }

  if (
    typeof user?.name === "string" &&
    user.name.trim()
  ) {
    return user.name.trim();
  }

  if (
    typeof user?.email === "string" &&
    user.email.trim()
  ) {
    return user.email.trim();
  }

  return "User";
}

function getInitials(user) {
  const name = getDisplayName(user);

  if (!name || name === "User") {
    return "US";
  }

  const parts = name
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase();
}

export default function Sidebar({
  collapsed = false,
  onToggle,
}) {
  const navigate = useNavigate();

  const [user, setUser] = useState(
    readUser
  );

  useEffect(() => {
    const refreshUser = () => {
      setUser(readUser());
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

  const role = useMemo(
    () =>
      normalizeRole(
        user?.role ||
          user?.user_role ||
          user?.userRole
      ),
    [user]
  );

  const displayName =
    getDisplayName(user);

  const initials =
    getInitials(user);

  const navigation = [
    {
      title: "Overview",
      items: [
        {
          label: "Dashboard",
          path: "/dashboard",
          icon: "home",
        },
      ],
    },

    {
      title: "Traffic Intelligence",
      items: [
        {
          label: "Live Monitoring",
          path: "/live",
          icon: "monitor",
        },
        {
          label: "Traffic Prediction",
          path: "/prediction",
          icon: "prediction",
        },
        {
          label: "Route Planner",
          path: "/routes",
          icon: "route",
        },
        {
          label: "Analytics",
          path: "/analytics",
          icon: "analytics",
        },
      ],
    },

    {
      title: "Operations",
      items: [
        {
          label: "Alerts",
          path: "/alerts",
          icon: "alert",
        },
        ...(role === "commissioner"
          ? [
              {
                label: "User Management",
                path: "/users",
                icon: "users",
              },
            ]
          : []),
      ],
    },
  ];

  const handleLogout = () => {
    const keys = [
      "token",
      "access_token",
      "auth_token",
      "accessToken",
      "irtms_token",
      "irtms_user",
      "currentUser",
      "user",
      "auth_user",
    ];

    keys.forEach((key) => {
      localStorage.removeItem(key);
    });

    sessionStorage.clear();

    window.dispatchEvent(
      new Event("irtms-auth-changed")
    );

    navigate("/login", {
      replace: true,
    });
  };

  return (
    <aside
      className={`irtms-sidebar ${
        collapsed
          ? "irtms-sidebar-collapsed"
          : ""
      }`}
    >
      <div className="irtms-sidebar-inner">

        <div className="irtms-sidebar-brand">
          <div className="irtms-brand-row">
            <TrafficLogo />

            {!collapsed && (
              <div className="irtms-brand-copy">
                <div className="irtms-brand-title">
                  <strong>IRTMS</strong>
                </div>

                <div className="irtms-brand-subtitle">
                  Intelligent Road Traffic
                  <br />
                  Monitoring System
                </div>
              </div>
            )}
          </div>

          {!collapsed && (
            <>
              <div className="irtms-brand-slogan">
                SAFER ROADS. SMARTER CITIES.
              </div>

              <TrafficAnimation />
            </>
          )}
        </div>

        <nav
          className="irtms-sidebar-nav"
          aria-label="Main navigation"
        >
          {navigation.map((group) => (
            <div
              className="irtms-nav-group"
              key={group.title}
            >
              {!collapsed && (
                <div className="irtms-nav-heading">
                  {group.title}
                </div>
              )}

              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={
                    collapsed
                      ? item.label
                      : undefined
                  }
                  className={({ isActive }) =>
                    `irtms-nav-item ${
                      isActive
                        ? "active"
                        : ""
                    }`
                  }
                >
                  <span className="irtms-nav-icon">
                    <Icon
                      name={item.icon}
                      size={21}
                    />
                  </span>

                  {!collapsed && (
                    <>
                      <span className="irtms-nav-label">
                        {item.label}
                      </span>

                      <span className="irtms-nav-arrow">
                        <Icon
                          name="chevron"
                          size={17}
                        />
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="irtms-sidebar-bottom">

          <div className="irtms-sidebar-user">
            <div className="irtms-user-avatar">
              {initials}
            </div>

            {!collapsed && (
              <div className="irtms-user-copy">
                <strong title={displayName}>
                  {displayName}
                </strong>

                <span>
                  {roleLabel(role)}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="irtms-sidebar-logout"
            onClick={handleLogout}
            title={
              collapsed
                ? "Logout"
                : "Logout"
            }
          >
            <Icon
              name="logout"
              size={21}
            />

            {!collapsed && (
              <span>Logout</span>
            )}
          </button>
        </div>

      </div>

      {typeof onToggle === "function" && (
        <button
          type="button"
          className="irtms-sidebar-toggle"
          onClick={onToggle}
          aria-label={
            collapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
        >
          <Icon
            name="menu"
            size={19}
          />
        </button>
      )}
    </aside>
  );
}