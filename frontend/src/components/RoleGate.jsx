import React from "react";

export default function RoleGate({
  allowedRoles = [],
  user,
  children,
  fallback = null,
}) {
  const role = user?.role?.toLowerCase();

  if (!role) {
    return fallback;
  }

  const normalizedRoles = allowedRoles.map((item) =>
    String(item).toLowerCase()
  );

  if (!normalizedRoles.includes(role)) {
    return fallback;
  }

  return children;
}