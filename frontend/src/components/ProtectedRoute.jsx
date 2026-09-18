import React from "react";
import { Navigate, useLocation } from "react-router-dom";

const ROLE_ALIASES = {
  commoner: "commoner",
  public: "commoner",
  user: "commoner",

  traffic_operator: "traffic_operator",
  trafficoperator: "traffic_operator",

  system_operator: "system_operator",
  systemoperator: "system_operator",

  operator: "traffic_operator",

  commissioner: "commissioner",
};

function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase();

  return ROLE_ALIASES[value] || value;
}

function clearAuth() {
  localStorage.removeItem("irtms_token");
  localStorage.removeItem("irtms_user");

  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("access_token");
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem("irtms_user");

    if (!raw) {
      return null;
    }

    const user = JSON.parse(raw);

    if (!user || typeof user !== "object") {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export default function ProtectedRoute({
  children,
  allowedRoles = null,
}) {
  const location = useLocation();

  const token = localStorage.getItem("irtms_token");

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  const user = getStoredUser();

  if (!user) {
    clearAuth();

    return (
      <Navigate
        to="/login"
        replace
        state={{
          reason: "missing-user",
        }}
      />
    );
  }

  if (user.is_active === false) {
    clearAuth();

    return (
      <Navigate
        to="/login"
        replace
        state={{
          reason: "inactive",
        }}
      />
    );
  }

  if (
    allowedRoles &&
    Array.isArray(allowedRoles) &&
    allowedRoles.length > 0
  ) {
    const currentRole = normalizeRole(user.role);

    const normalizedAllowedRoles =
      allowedRoles
        .map(normalizeRole)
        .filter(Boolean);

    if (
      !normalizedAllowedRoles.includes(
        currentRole
      )
    ) {
      return (
        <Navigate
          to="/dashboard"
          replace
          state={{
            reason: "unauthorized",
          }}
        />
      );
    }
  }

  return children;
}