import React from "react";

export default function StatCard({
  title,
  label,
  value,
  subtitle,
  icon,
  trend,
  className = "",
}) {
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-card-header">
        <div className="stat-card-title">{title || label}</div>

        {icon && <div className="stat-card-icon">{icon}</div>}
      </div>

      <div className="stat-card-value">{value ?? "—"}</div>

      {subtitle && (
        <div className="stat-card-subtitle">
          {subtitle}
        </div>
      )}

      {trend && (
        <div className="stat-card-trend">
          {trend}
        </div>
      )}
    </div>
  );
}