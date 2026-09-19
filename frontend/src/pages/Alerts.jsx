import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createAlert,
  getAlerts,
  resolveAlert,
} from "../services/api";
import { getStoredMonitoringScope } from "../data/indiaLocations";

const OPERATIONAL_ROLES = [
  "traffic_operator",
  "system_operator",
  "commissioner",
];

function getDefaultDateTime() {
  const now = new Date();

  const offset =
    now.getTimezoneOffset();

  const localDate = new Date(
    now.getTime() - offset * 60000
  );

  return localDate
    .toISOString()
    .slice(0, 16);
}

const INITIAL_FORM = {
  area: "",
  road_name: "",
  alert_time: getDefaultDateTime(),
  congestion_level: "medium",
  current_speed_kmph: "",
  free_flow_speed_kmph: "",
  severity: "medium",
  description: "",
};

function getStoredUser() {
  const keys = [
    "irtms_user",
    "currentUser",
    "user",
    "auth_user",
  ];

  for (const key of keys) {
    try {
      const raw =
        localStorage.getItem(key);

      if (!raw) {
        continue;
      }

      const user = JSON.parse(raw);

      if (
        user &&
        typeof user === "object"
      ) {
        return user;
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

  if (value === "operator") {
    return "system_operator";
  }

  if (value === "trafficoperator") {
    return "traffic_operator";
  }

  if (value === "systemoperator") {
    return "system_operator";
  }

  return value;
}

function normalizeAlerts(payload) {
  const data =
    payload?.data ?? payload;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.alerts)) {
    return data.alerts;
  }

  if (Array.isArray(data?.records)) {
    return data.records;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}

function normalizeSeverity(value) {
  const severity = String(
    value || "medium"
  )
    .trim()
    .toLowerCase();

  if (
    severity === "critical" ||
    severity === "severe"
  ) {
    return "critical";
  }

  if (severity === "high") {
    return "high";
  }

  if (severity === "low") {
    return "low";
  }

  return "medium";
}

function normalizeCongestion(value) {
  const level = String(
    value || "medium"
  )
    .trim()
    .toLowerCase();

  if (
    level === "critical" ||
    level === "severe"
  ) {
    return "critical";
  }

  if (
    level === "moderate" ||
    level === "medium"
  ) {
    return "medium";
  }

  if (level === "high") {
    return "high";
  }

  return "low";
}

function getAlertMessage(alert) {
  return (
    alert?.message ||
    alert?.description ||
    "Traffic incident detected."
  );
}

function getRoadName(alert) {
  return (
    alert?.road_name ||
    alert?.road ||
    alert?.affected_road ||
    "Unknown road"
  );
}

function getArea(alert) {
  return alert?.area || "—";
}

function isActiveAlert(alert) {
  const status = String(
    alert?.status || "active"
  )
    .trim()
    .toLowerCase();

  return (
    status !== "resolved" &&
    status !== "closed"
  );
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatSpeed(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${number.toFixed(1)} km/h`;
}

function calculateCongestion(
  currentSpeed,
  freeFlowSpeed
) {
  const current =
    Number(currentSpeed);

  const freeFlow =
    Number(freeFlowSpeed);

  if (
    !Number.isFinite(current) ||
    !Number.isFinite(freeFlow) ||
    freeFlow <= 0
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.min(
      100,
      (1 - current / freeFlow) *
        100
    )
  );
}

function getErrorMessage(
  error,
  fallback
) {
  const detail =
    error?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail
      .map(
        (item) =>
          item?.msg ||
          String(item)
      )
      .join(", ");
  }

  return (
    detail ||
    error?.response?.data?.message ||
    error?.userMessage ||
    error?.message ||
    fallback
  );
}

export default function Alerts() {
  const currentUser = useMemo(
    () => getStoredUser(),
    []
  );

  const currentRole =
    normalizeRole(
      currentUser?.role
    );

  const canManageAlerts =
    OPERATIONAL_ROLES.includes(
      currentRole
    );

  const [monitoringScope, setMonitoringScope] =
    useState(getStoredMonitoringScope);

  useEffect(() => {
    const handler = (event) => {
      setMonitoringScope(
        event.detail || getStoredMonitoringScope()
      );
    };

    window.addEventListener(
      "irtms-monitoring-scope-changed",
      handler
    );

    return () =>
      window.removeEventListener(
        "irtms-monitoring-scope-changed",
        handler
      );
  }, []);

  const [alerts, setAlerts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [publishing, setPublishing] =
    useState(false);

  const [resolvingId, setResolvingId] =
    useState(null);

  const [showForm, setShowForm] =
    useState(false);

  const [form, setForm] =
    useState(INITIAL_FORM);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const loadAlerts = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response =
          await getAlerts({
            state: monitoringScope.state,
            area: monitoringScope.area,
          });

        setAlerts(
          normalizeAlerts(response)
        );
      } catch (err) {
        console.error(
          "Unable to load traffic alerts:",
          err
        );

        setError(
          getErrorMessage(
            err,
            "Unable to load traffic alerts."
          )
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [monitoringScope]
  );

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const activeAlerts =
    useMemo(
      () =>
        alerts.filter(
          isActiveAlert
        ),
      [alerts]
    );

  const criticalCount =
    useMemo(
      () =>
        activeAlerts.filter(
          (alert) =>
            normalizeSeverity(
              alert?.severity
            ) === "critical"
        ).length,
      [activeAlerts]
    );

  const highCount =
    useMemo(
      () =>
        activeAlerts.filter(
          (alert) =>
            normalizeSeverity(
              alert?.severity
            ) === "high"
        ).length,
      [activeAlerts]
    );

  function handleFormChange(
    event
  ) {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm({
      ...INITIAL_FORM,
      alert_time:
        getDefaultDateTime(),
    });

    setError("");
  }

  async function handlePublish(
    event
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    const area =
      form.area.trim();

    const roadName =
      form.road_name.trim();

    const currentSpeed =
      Number(
        form.current_speed_kmph
      );

    const freeFlowSpeed =
      Number(
        form.free_flow_speed_kmph
      );

    if (!area) {
      setError(
        "Area is required."
      );
      return;
    }

    if (!roadName) {
      setError(
        "Road name is required."
      );
      return;
    }

    if (!form.alert_time) {
      setError(
        "Alert date and time are required."
      );
      return;
    }

    if (
      !Number.isFinite(
        currentSpeed
      ) ||
      currentSpeed < 0
    ) {
      setError(
        "Enter a valid current speed."
      );
      return;
    }

    if (
      !Number.isFinite(
        freeFlowSpeed
      ) ||
      freeFlowSpeed <= 0
    ) {
      setError(
        "Enter a valid free-flow speed greater than zero."
      );
      return;
    }

    if (
      currentSpeed >
      freeFlowSpeed
    ) {
      setError(
        "Current speed cannot be greater than free-flow speed."
      );
      return;
    }

    try {
      setPublishing(true);

      const selectedDate =
        new Date(
          form.alert_time
        );

      if (
        Number.isNaN(
          selectedDate.getTime()
        )
      ) {
        setError(
          "Enter a valid alert date and time."
        );

        return;
      }

      const payload = {
        area,
        road_name: roadName,

        alert_time:
          selectedDate.toISOString(),

        congestion_level:
          form.congestion_level,

        current_speed_kmph:
          currentSpeed,

        free_flow_speed_kmph:
          freeFlowSpeed,

        severity:
          form.severity,

        description:
          form.description.trim(),
      };

      await createAlert(
        payload
      );

      setMessage(
        "Traffic alert published successfully."
      );

      resetForm();
      setShowForm(false);

      await loadAlerts(true);
    } catch (err) {
      console.error(
        "Unable to publish traffic alert:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Unable to publish traffic alert."
        )
      );
    } finally {
      setPublishing(false);
    }
  }

  async function handleResolve(
    alertId
  ) {
    if (
      alertId === undefined ||
      alertId === null
    ) {
      return;
    }

    try {
      setResolvingId(alertId);
      setError("");
      setMessage("");

      await resolveAlert(
        alertId
      );

      setMessage(
        "Traffic alert resolved successfully."
      );

      await loadAlerts(true);
    } catch (err) {
      console.error(
        "Unable to resolve alert:",
        err
      );

      setError(
        getErrorMessage(
          err,
          "Unable to resolve this alert."
        )
      );
    } finally {
      setResolvingId(null);
    }
  }

  const previewCongestion =
    calculateCongestion(
      form.current_speed_kmph,
      form.free_flow_speed_kmph
    );

  return (
    <div className="page-content alerts-page">
      <section className="page-title">
        <div>
          <h1>
            Traffic Alerts
          </h1>

          <p>
            Review active traffic
            incidents and operational
            notifications.
          </p>
        </div>

        <div className="page-title-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              loadAlerts(true)
            }
            disabled={
              refreshing ||
              publishing
            }
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>

          {canManageAlerts && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                setShowForm(
                  (value) =>
                    !value
                )
              }
            >
              {showForm
                ? "Close Alert Form"
                : "Create Alert"}
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="alert alert-error">
          <strong>
            Alert operation failed.
          </strong>

          <span>
            {error}
          </span>
        </div>
      )}

      {message && (
        <div className="alert alert-success">
          <strong>
            Success.
          </strong>

          <span>
            {message}
          </span>
        </div>
      )}

      {canManageAlerts &&
        showForm && (
          <section className="panel alert-create-panel">
            <div className="panel-header">
              <div>
                <h3>
                  Create Traffic Alert
                </h3>

                <p>
                  Publish a verified
                  traffic condition to
                  the shared alert system.
                </p>
              </div>
            </div>

            <form
              className="alert-create-form"
              onSubmit={
                handlePublish
              }
            >
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="alert-area">
                    Area
                  </label>

                  <input
                    id="alert-area"
                    name="area"
                    type="text"
                    value={form.area}
                    onChange={
                      handleFormChange
                    }
                    placeholder="e.g. Banjara Hills"
                    maxLength={255}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="alert-road">
                    Road
                  </label>

                  <input
                    id="alert-road"
                    name="road_name"
                    type="text"
                    value={
                      form.road_name
                    }
                    onChange={
                      handleFormChange
                    }
                    placeholder="e.g. Road No. 12"
                    maxLength={255}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="alert-time">
                    Alert Date &amp; Time
                  </label>

                  <input
                    id="alert-time"
                    name="alert_time"
                    type="datetime-local"
                    value={
                      form.alert_time
                    }
                    onChange={
                      handleFormChange
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="alert-congestion">
                    Congestion Level
                  </label>

                  <select
                    id="alert-congestion"
                    name="congestion_level"
                    value={
                      form.congestion_level
                    }
                    onChange={
                      handleFormChange
                    }
                    required
                  >
                    <option value="low">
                      Low
                    </option>

                    <option value="medium">
                      Medium
                    </option>

                    <option value="high">
                      High
                    </option>

                    <option value="critical">
                      Critical
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="alert-severity">
                    Severity
                  </label>

                  <select
                    id="alert-severity"
                    name="severity"
                    value={
                      form.severity
                    }
                    onChange={
                      handleFormChange
                    }
                    required
                  >
                    <option value="low">
                      Low
                    </option>

                    <option value="medium">
                      Medium
                    </option>

                    <option value="high">
                      High
                    </option>

                    <option value="critical">
                      Critical
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="alert-current-speed">
                    Current Speed (km/h)
                  </label>

                  <input
                    id="alert-current-speed"
                    name="current_speed_kmph"
                    type="number"
                    min="0"
                    step="0.1"
                    value={
                      form.current_speed_kmph
                    }
                    onChange={
                      handleFormChange
                    }
                    placeholder="e.g. 28.5"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="alert-free-flow">
                    Free-flow Speed (km/h)
                  </label>

                  <input
                    id="alert-free-flow"
                    name="free_flow_speed_kmph"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={
                      form.free_flow_speed_kmph
                    }
                    onChange={
                      handleFormChange
                    }
                    placeholder="e.g. 60"
                    required
                  />
                </div>
              </div>

              {previewCongestion !==
                null && (
                <div className="alert-measurement-preview">
                  <span>
                    Derived congestion
                  </span>

                  <strong>
                    {previewCongestion.toFixed(
                      1
                    )}
                    %
                  </strong>

                  <small>
                    Calculated from current
                    speed versus free-flow
                    speed.
                  </small>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="alert-description">
                  Description
                </label>

                <textarea
                  id="alert-description"
                  name="description"
                  value={
                    form.description
                  }
                  onChange={
                    handleFormChange
                  }
                  placeholder="Describe the verified traffic condition or operational issue."
                  maxLength={2000}
                  rows={4}
                />
              </div>

              <div className="alert-form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={
                    resetForm
                  }
                  disabled={
                    publishing
                  }
                >
                  Clear
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    publishing
                  }
                >
                  {publishing
                    ? "Publishing..."
                    : "Publish Alert"}
                </button>
              </div>
            </form>
          </section>
        )}

      <section className="stats">
        <div className="stat-card">
          <div className="stat-card-content">
            <span className="stat-label">
              Active Alerts
            </span>

            <strong className="stat-value">
              {loading
                ? "—"
                : activeAlerts.length}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-content">
            <span className="stat-label">
              Critical
            </span>

            <strong className="stat-value">
              {loading
                ? "—"
                : criticalCount}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-content">
            <span className="stat-label">
              High Priority
            </span>

            <strong className="stat-value">
              {loading
                ? "—"
                : highCount}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-content">
            <span className="stat-label">
              Total Records
            </span>

            <strong className="stat-value">
              {loading
                ? "—"
                : alerts.length}
            </strong>
          </div>
        </div>
      </section>

      <section className="panel alerts-list-panel">
        <div className="panel-header">
          <div>
            <h3>
              Active Traffic Alerts
            </h3>

            <p>
              Current incidents requiring
              visibility or operational
              action.
            </p>
          </div>

          {!loading && (
            <span className="map-count">
              {activeAlerts.length} active
            </span>
          )}
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="traffic-loading-mini">
              <div className="traffic-loading-road">
                <span />
                <span />
                <span />
              </div>

              <div className="traffic-loading-car">
                <i />
                <i />
              </div>
            </div>

            <span>
              Loading traffic alerts...
            </span>
          </div>
        ) : activeAlerts.length ===
          0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              ✓
            </div>

            <h3>
              No active alerts
            </h3>

            <p>
              The traffic network
              currently has no unresolved
              alerts.
            </p>
          </div>
        ) : (
          <div className="alerts-list">
            {activeAlerts.map(
              (alert, index) => {
                const severity =
                  normalizeSeverity(
                    alert?.severity
                  );

                const congestion =
                  normalizeCongestion(
                    alert?.congestion_level
                  );

                const congestionPercentage =
                  alert?.congestion_percentage ??
                  calculateCongestion(
                    alert?.current_speed_kmph,
                    alert?.free_flow_speed_kmph
                  );

                const isResolving =
                  resolvingId ===
                  alert?.id;

                return (
                  <article
                    className="alert-record"
                    key={
                      alert?.id ??
                      `alert-${index}`
                    }
                  >
                    <div
                      className={`alert-severity ${severity}`}
                    >
                      {severity.toUpperCase()}
                    </div>

                    <div className="alert-record-content">
                      <h3>
                        {getAlertMessage(
                          alert
                        )}
                      </h3>

                      <p>
                        <strong>
                          {getArea(
                            alert
                          )}
                        </strong>

                        {" · "}

                        {getRoadName(
                          alert
                        )}
                      </p>

                      <div className="alert-measurements">
                        <span>
                          Congestion:{" "}
                          <strong>
                            {congestion}
                          </strong>
                        </span>

                        <span>
                          Current:{" "}
                          <strong>
                            {formatSpeed(
                              alert?.current_speed_kmph
                            )}
                          </strong>
                        </span>

                        <span>
                          Free-flow:{" "}
                          <strong>
                            {formatSpeed(
                              alert?.free_flow_speed_kmph
                            )}
                          </strong>
                        </span>

                        {congestionPercentage !==
                          null && (
                          <span>
                            Derived:{" "}
                            <strong>
                              {Number(
                                congestionPercentage
                              ).toFixed(
                                1
                              )}
                              %
                            </strong>
                          </span>
                        )}
                      </div>

                      <small>
                        {formatDate(
                          alert?.detected_at ??
                            alert?.created_at
                        )}
                      </small>
                    </div>

                    {canManageAlerts && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() =>
                          handleResolve(
                            alert?.id
                          )
                        }
                        disabled={
                          isResolving ||
                          alert?.id ===
                            undefined
                        }
                      >
                        {isResolving
                          ? "Resolving..."
                          : "Resolve"}
                      </button>
                    )}
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>
    </div>
  );
}