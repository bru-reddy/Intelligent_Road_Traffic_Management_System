import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getActiveAlerts,
  getAlertSummary,
  getLiveTraffic,
  getLiveTomTomTraffic,
  getStoredUser,
} from "../services/api";
import TrafficMap from "../components/TrafficMap";

const REFRESH_INTERVAL = 60 * 1000;

const FALLBACK_POINTS = [
  {
    id: "hyderabad-central",
    road: "Hyderabad Central",
    latitude: 17.4399,
    longitude: 78.4866,
    speed: 30.2,
    freeFlowSpeed: 60,
    vehicleCount: 0,
    status: "Medium",
    roadStatus: "Moderate traffic",
    dataSource: "Configured monitoring point",
  },
  {
    id: "hitech-city",
    road: "Hitech City",
    latitude: 17.4483,
    longitude: 78.3915,
    speed: 42,
    freeFlowSpeed: 55,
    vehicleCount: 0,
    status: "Low",
    roadStatus: "Free flowing",
    dataSource: "Configured monitoring point",
  },
  {
    id: "madhapur",
    road: "Madhapur",
    latitude: 17.4486,
    longitude: 78.3908,
    speed: 27,
    freeFlowSpeed: 55,
    vehicleCount: 0,
    status: "Medium",
    roadStatus: "Moderate traffic",
    dataSource: "Configured monitoring point",
  },
  {
    id: "gachibowli",
    road: "Gachibowli",
    latitude: 17.4401,
    longitude: 78.3489,
    speed: 48,
    freeFlowSpeed: 60,
    vehicleCount: 0,
    status: "Low",
    roadStatus: "Free flowing",
    dataSource: "Configured monitoring point",
  },
  {
    id: "secunderabad",
    road: "Secunderabad",
    latitude: 17.4399,
    longitude: 78.4983,
    speed: 24,
    freeFlowSpeed: 55,
    vehicleCount: 0,
    status: "High",
    roadStatus: "Heavy traffic",
    dataSource: "Configured monitoring point",
  },
];

const ROLE_ALIASES = {
  commoner: "commoner",
  public: "commoner",
  user: "commoner",

  traffic_operator: "traffic_operator",
  trafficoperator: "traffic_operator",
  trafficoperations: "traffic_operator",

  system_operator: "system_operator",
  systemoperator: "system_operator",
  operator: "system_operator",

  commissioner: "commissioner",
};

function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase();

  return ROLE_ALIASES[value] || value;
}

function extractArray(response) {
  const data = response?.data ?? response;

  if (Array.isArray(data)) {
    return data;
  }

  const arrayKeys = [
    "data",
    "points",
    "records",
    "traffic",
    "traffic_data",
    "trafficData",
    "road_data",
    "roadData",
    "observations",
    "items",
    "results",
    "alerts",
    "current_traffic",
    "currentTraffic",
  ];

  for (const key of arrayKeys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  // Some live-traffic endpoints return one traffic object
  // instead of an array. Keep that object instead of falling
  // back to static demo points.
  if (
    data &&
    typeof data === "object" &&
    (
      data.current_speed_kmph !== undefined ||
      data.avg_speed_kmph !== undefined ||
      data.currentSpeed !== undefined ||
      data.speed !== undefined ||
      data.free_flow_speed_kmph !== undefined ||
      data.freeFlowSpeed !== undefined ||
      data.latitude !== undefined ||
      data.longitude !== undefined ||
      data.flowSegmentData
    )
  ) {
    return [data];
  }

  // A wrapped TomTom response can expose the flow segment
  // object directly under flowSegmentData.
  if (data?.flowSegmentData) {
    return [data.flowSegmentData];
  }

  // A single nested traffic object is also valid.
  if (
    data?.traffic &&
    typeof data.traffic === "object"
  ) {
    return [data.traffic];
  }

  return [];
}

function number(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function normalizePoint(item, index) {
  // Support both the application's normalized response and
  // the native TomTom flowSegmentData shape.
  const flow = item?.flowSegmentData ?? item;

  const speed = number(
    item?.current_speed_kmph ??
      item?.avg_speed_kmph ??
      item?.current_speed ??
      item?.speed ??
      item?.currentSpeed ??
      flow?.currentSpeed
  );

  const freeFlowSpeed = number(
    item?.free_flow_speed_kmph ??
      item?.free_flow_speed ??
      item?.freeFlowSpeed ??
      flow?.freeFlow
  );

  const vehicleCount = number(
    item?.vehicle_count ??
      item?.vehicleCount ??
      item?.vehicles ??
      item?.vehicle_count_proxy
  );

  let status = String(
    item?.congestion_level ??
      item?.congestionLevel ??
      item?.congestion ??
      item?.status ??
      ""
  )
    .trim()
    .toLowerCase();

  if (
    status === "critical" ||
    status === "severe"
  ) {
    status = "Critical";
  } else if (status === "high") {
    status = "High";
  } else if (
    status === "medium" ||
    status === "moderate"
  ) {
    status = "Medium";
  } else if (status === "low") {
    status = "Low";
  } else if (
    freeFlowSpeed > 0 &&
    speed > 0
  ) {
    const ratio = speed / freeFlowSpeed;

    if (ratio < 0.4) {
      status = "Critical";
    } else if (ratio < 0.7) {
      status = "High";
    } else if (ratio < 0.85) {
      status = "Medium";
    } else {
      status = "Low";
    }
  } else {
    status = "Unknown";
  }

  const road =
    item?.road_name ??
    item?.road ??
    item?.name ??
    flow?.roadName ??
    flow?.frc ??
    `Monitoring Point ${index + 1}`;

  const tomtomCoordinate =
    flow?.coordinates?.coordinate?.[0];

  const latitude = number(
    item?.latitude ??
      item?.lat ??
      item?.location?.latitude ??
      item?.position?.lat ??
      tomtomCoordinate?.latitude,
    NaN
  );

  const longitude = number(
    item?.longitude ??
      item?.lng ??
      item?.lon ??
      item?.location?.longitude ??
      item?.position?.lon ??
      tomtomCoordinate?.longitude,
    NaN
  );

  let roadStatus =
    item?.road_status ??
    item?.roadStatus;

  if (!roadStatus) {
    const normalized = status.toLowerCase();

    if (normalized === "critical") {
      roadStatus = "Critical traffic";
    } else if (normalized === "high") {
      roadStatus = "Heavy traffic";
    } else if (normalized === "medium") {
      roadStatus = "Moderate traffic";
    } else if (normalized === "low") {
      roadStatus = "Free flowing";
    } else {
      roadStatus = "Status unavailable";
    }
  }

  return {
    id:
      item?.id ??
      `${road}-${index}`,
    road,
    latitude,
    longitude,
    speed,
    freeFlowSpeed,
    vehicleCount,
    status,
    roadStatus,
    travelTime:
      item?.travel_time_minutes ??
      item?.travelTimeMinutes ??
      null,
    recordedAt:
      item?.recorded_at ??
      item?.observation_time ??
      item?.timestamp ??
      item?.updated_at ??
      null,
    dataSource:
      item?.data_source ??
      item?.dataSource ??
      "Traffic monitoring",
  };
}


function badgeClass(status) {
  const value = String(status || "")
    .toLowerCase()
    .trim();

  if (
    value === "critical" ||
    value === "severe"
  ) {
    return "critical";
  }

  if (value === "high") {
    return "high";
  }

  if (
    value === "medium" ||
    value === "moderate"
  ) {
    return "medium";
  }

  if (value === "low") {
    return "low";
  }

  return "unknown";
}

function formatTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleTitle(role) {
  if (role === "commissioner") {
    return "City Traffic Overview";
  }

  if (role === "system_operator") {
    return "System Operations Dashboard";
  }

  if (role === "traffic_operator") {
    return "Traffic Operations Dashboard";
  }

  return "Traffic Dashboard";
}

function roleDescription(role) {
  if (role === "commissioner") {
    return "Executive overview of citywide traffic conditions, incidents and mobility performance.";
  }

  if (role === "system_operator") {
    return "Monitor traffic infrastructure, system services and operational performance.";
  }

  if (role === "traffic_operator") {
    return "Monitor current road conditions, traffic flow and operational incidents.";
  }

  return "View current traffic conditions, route information and public traffic alerts.";
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "",
}) {
  return (
    <article className={`dashboard-stat ${tone}`}>
      <div className="dashboard-stat-top">
        <span className="dashboard-stat-label">
          {label}
        </span>

        <span className="dashboard-stat-icon">
          {icon}
        </span>
      </div>

      <strong className="dashboard-stat-value">
        {value}
      </strong>

      {sub && (
        <span className="dashboard-stat-sub">
          {sub}
        </span>
      )}
    </article>
  );
}

export default function Dashboard() {
  const user = useMemo(
    () => getStoredUser(),
    []
  );

  const role = normalizeRole(user?.role);

  const isOperational = [
    "traffic_operator",
    "system_operator",
    "commissioner",
  ].includes(role);

  const [points, setPoints] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] =
    useState(null);

  const loadDashboard = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        let trafficResponse;

        if (isOperational) {
          try {
            trafficResponse =
              await getLiveTomTomTraffic();
          } catch {
            trafficResponse =
              await getLiveTraffic();
          }
        } else {
          trafficResponse =
            await getLiveTraffic();
        }

        const rawTraffic =
          extractArray(trafficResponse);

        const normalizedTraffic =
          rawTraffic
            .map(normalizePoint)
            .filter(
              (point) =>
                point.road &&
                Number.isFinite(
                  point.latitude
                ) &&
                Number.isFinite(
                  point.longitude
                )
            );

        setPoints(
          normalizedTraffic.length
            ? normalizedTraffic
            : FALLBACK_POINTS
        );

        try {
          const activeResponse =
            await getActiveAlerts();

          setAlerts(
            extractArray(activeResponse)
          );
        } catch {
          try {
            const summary =
              await getAlertSummary();

            const summaryData =
              summary?.data ?? summary;

            if (
              Array.isArray(
                summaryData?.alerts
              )
            ) {
              setAlerts(
                summaryData.alerts
              );
            }
          } catch {
            setAlerts([]);
          }
        }

        setLastUpdated(new Date());
      } catch (err) {
        console.error(
          "Dashboard loading failed:",
          err
        );

        setError(
          err?.response?.data?.detail ||
            err?.response?.data?.message ||
            err?.message ||
            "Unable to load live traffic data."
        );

        setPoints(FALLBACK_POINTS);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isOperational]
  );

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(
      () => loadDashboard(true),
      REFRESH_INTERVAL
    );

    return () => clearInterval(interval);
  }, [loadDashboard]);

  const statistics = useMemo(() => {
    const validSpeeds = points.filter(
      (point) => point.speed > 0
    );

    const averageSpeed =
      validSpeeds.length > 0
        ? validSpeeds.reduce(
            (sum, point) =>
              sum + point.speed,
            0
          ) / validSpeeds.length
        : 0;

    const vehicles = points.reduce(
      (sum, point) =>
        sum + point.vehicleCount,
      0
    );

    const low = points.filter(
      (point) =>
        point.status.toLowerCase() === "low"
    ).length;

    const medium = points.filter(
      (point) =>
        point.status.toLowerCase() ===
        "medium"
    ).length;

    const high = points.filter(
      (point) =>
        point.status.toLowerCase() === "high"
    ).length;

    const critical = points.filter(
      (point) =>
        point.status.toLowerCase() ===
          "critical" ||
        point.status.toLowerCase() ===
          "severe"
    ).length;

    return {
      total: points.length,
      averageSpeed,
      vehicles,
      low,
      medium,
      high,
      critical,
    };
  }, [points]);

  const activeAlerts = alerts.filter(
    (alert) =>
      String(
        alert?.status || "active"
      ).toLowerCase() === "active"
  );

  const criticalAlerts =
    activeAlerts.filter((alert) => {
      const severity = String(
        alert?.severity || ""
      ).toLowerCase();

      return (
        severity.includes("critical")
      );
    }).length;

  const mappedPoints = points.filter(
    (point) =>
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      point.latitude >= -90 &&
      point.latitude <= 90 &&
      point.longitude >= -180 &&
      point.longitude <= 180
  );

  return (
    <div className="dashboard-page">
      <section className="dashboard-header">
        <div>
          <span className="dashboard-eyebrow">
            OVERVIEW
          </span>

          <h1>{roleTitle(role)}</h1>

          <p>{roleDescription(role)}</p>
        </div>

        <div className="dashboard-header-actions">
          <span className="tomtom-status">
            <span className="status-live-dot" />
            {isOperational
              ? "TomTom Live"
              : "Traffic Live"}
          </span>

          <button
            type="button"
            className="dashboard-button secondary"
            onClick={() => loadDashboard(true)}
            disabled={loading || refreshing}
          >
            {refreshing
              ? "Refreshing..."
              : "↻ Refresh"}
          </button>

          <button
            type="button"
            className="dashboard-button primary"
            onClick={() =>
              window.location.assign(
                "/live"
              )
            }
          >
            Live Monitoring
          </button>
        </div>
      </section>

      {error && (
        <div className="dashboard-error">
          <strong>
            Traffic data temporarily unavailable.
          </strong>

          <span>{error}</span>
        </div>
      )}

      <section className="dashboard-stats-grid">
        <StatCard
          label="MONITORED POINTS"
          value={
            loading
              ? "—"
              : statistics.total
          }
          sub="Current traffic observations"
          icon="⌁"
        />

        <StatCard
          label="VEHICLES MONITORED"
          value={
            loading
              ? "—"
              : statistics.vehicles.toLocaleString()
          }
          sub="Vehicles in current observations"
          icon="▰"
          tone="green"
        />

        <StatCard
          label="AVERAGE FLOW SPEED"
          value={
            loading
              ? "—"
              : `${statistics.averageSpeed.toFixed(
                  1
                )} km/h`
          }
          sub="Across monitored roads"
          icon="↗"
          tone="amber"
        />

        <StatCard
          label="CONGESTED POINTS"
          value={
            loading
              ? "—"
              : statistics.high +
                statistics.critical
          }
          sub="Medium or higher congestion"
          icon="!"
          tone="red"
        />
      </section>

      <section className="dashboard-main-grid">
        <article className="dashboard-panel map-dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="dashboard-panel-title">
              <div className="dashboard-panel-icon map-icon">
                ●
              </div>

              <div>
                <h2>Live Traffic Map</h2>

                <p>
                  Real-time monitored road
                  conditions and traffic flow
                </p>
              </div>
            </div>

            <div className="dashboard-panel-meta">
              <span className="live-map-status">
                <span className="status-live-dot" />
                Live
              </span>

              <span className="panel-divider" />

              <span>
                {mappedPoints.length} monitoring
                point
                {mappedPoints.length === 1
                  ? ""
                  : "s"}
              </span>

              <button
                type="button"
                className="map-expand-button"
                onClick={() =>
                  window.location.assign(
                    "/live"
                  )
                }
                title="Open live monitoring"
              >
                ↗
              </button>
            </div>
          </div>

          <div className="dashboard-map-container">
            {loading ? (
              <div className="dashboard-map-loading">
                <div className="traffic-mini-loader">
                  <span />
                  <span />
                  <span />
                </div>

                <strong>
                  Loading live traffic
                </strong>

                <p>
                  Connecting to traffic
                  monitoring services...
                </p>
              </div>
            ) : (
              <TrafficMap
                points={mappedPoints}
              />
            )}

            <div className="map-legend">
              <div>
                <span className="legend-line free" />
                Free Flow
              </div>

              <div>
                <span className="legend-line moderate" />
                Moderate
              </div>

              <div>
                <span className="legend-line heavy" />
                Heavy
              </div>

              <div>
                <span className="legend-line congested" />
                Congested
              </div>
            </div>
          </div>
        </article>

        <div className="dashboard-side-column">
          <article className="dashboard-panel alerts-dashboard-panel">
            <div className="dashboard-panel-header">
              <div className="dashboard-panel-title">
                <div className="dashboard-panel-icon alert-icon">
                  !
                </div>

                <div>
                  <h2>
                    Active Alerts
                    <span className="alert-count">
                      {activeAlerts.length}
                    </span>
                  </h2>

                  <p>
                    Current traffic notifications
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="panel-view-button"
                onClick={() =>
                  window.location.assign(
                    "/alerts"
                  )
                }
              >
                View all
              </button>
            </div>

            <div className="alerts-dashboard-body">
              {activeAlerts.length === 0 ? (
                <div className="no-alerts">
                  <div className="no-alert-icon">
                    ✓
                  </div>

                  <h3>No active alerts</h3>

                  <p>
                    No current traffic alerts
                    are available.
                    <br />
                    All monitored roads are
                    operating normally.
                  </p>
                </div>
              ) : (
                <div className="dashboard-alert-list">
                  {activeAlerts
                    .slice(0, 4)
                    .map((alert) => (
                      <div
                        className="dashboard-alert-item"
                        key={alert.id}
                      >
                        <div>
                          <strong>
                            {alert.road ||
                              alert.road_name ||
                              "Traffic location"}
                          </strong>

                          <span>
                            {alert.message ||
                              "Traffic condition requires attention."}
                          </span>
                        </div>

                        <span
                          className={`alert-severity ${badgeClass(
                            alert.severity
                          )}`}
                        >
                          {alert.severity ||
                            "Alert"}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </article>

          <article className="dashboard-panel system-dashboard-panel">
            <div className="dashboard-panel-header">
              <div className="dashboard-panel-title">
                <div className="dashboard-panel-icon system-icon">
                  ✓
                </div>

                <div>
                  <h2>System Status</h2>

                  <p>
                    Traffic services operational
                  </p>
                </div>
              </div>

              <span className="system-online-pill">
                <span />
                Online
              </span>
            </div>

            <div className="system-status-grid">
              <div>
                <span>API</span>
                <strong>
                  <i />
                  Online
                </strong>
              </div>

              <div>
                <span>Database</span>
                <strong>
                  <i />
                  Connected
                </strong>
              </div>

              <div>
                <span>TomTom</span>
                <strong>
                  <i />
                  {isOperational
                    ? "Active"
                    : "Available"}
                </strong>
              </div>

              <div>
                <span>ML Services</span>
                <strong>
                  <i />
                  Running
                </strong>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="dashboard-panel traffic-table-panel">
        <div className="dashboard-panel-header">
          <div className="dashboard-panel-title">
            <div className="dashboard-panel-icon road-icon">
              ≋
            </div>

            <div>
              <h2>Current Road Traffic</h2>

              <p>
                Current speed and congestion
                status across monitored roads
              </p>
            </div>
          </div>

          <div className="traffic-summary-badges">
            <span className="summary-badge low">
              Free {statistics.low}
            </span>

            <span className="summary-badge medium">
              Moderate {statistics.medium}
            </span>

            <span className="summary-badge high">
              Heavy {statistics.high}
            </span>
          </div>
        </div>

        <div className="dashboard-table-wrapper">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>ROAD</th>
                <th>CURRENT SPEED</th>
                <th>FREE-FLOW SPEED</th>
                <th>CONGESTION</th>
                <th>ROAD STATUS</th>
                <th>UPDATED</th>
              </tr>
            </thead>

            <tbody>
              {points
                .slice(0, 8)
                .map((point) => (
                  <tr key={point.id}>
                    <td>
                      <strong>
                        {point.road}
                      </strong>
                    </td>

                    <td>
                      <strong>
                        {point.speed.toFixed(
                          1
                        )}{" "}
                        km/h
                      </strong>
                    </td>

                    <td>
                      {point.freeFlowSpeed >
                      0
                        ? `${point.freeFlowSpeed.toFixed(
                            1
                          )} km/h`
                        : "—"}
                    </td>

                    <td>
                      <span
                        className={`traffic-badge ${badgeClass(
                          point.status
                        )}`}
                      >
                        {point.status}
                      </span>
                    </td>

                    <td>
                      {point.roadStatus}
                    </td>

                    <td>
                      {formatTime(
                        point.recordedAt
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="dashboard-footer-status">
        <span className="status-live-dot" />

        <span>
          {refreshing
            ? "Updating traffic data..."
            : lastUpdated
            ? `Last updated ${lastUpdated.toLocaleTimeString(
                [],
                {
                  hour: "2-digit",
                  minute: "2-digit",
                }
              )}`
            : "Monitoring ready"}
        </span>

        {criticalAlerts > 0 && (
          <span className="footer-critical">
            {criticalAlerts} critical alert
            {criticalAlerts === 1
              ? ""
              : "s"}
          </span>
        )}
      </div>
    </div>
  );
}