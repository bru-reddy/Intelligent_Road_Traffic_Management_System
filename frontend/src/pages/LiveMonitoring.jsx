import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import TrafficMap from "../components/TrafficMap";
import MonitoringScope from "../components/MonitoringScope.jsx";
import StatCard from "../components/StatCard";
import {
  getLiveTraffic,
  getLiveTomTomTraffic,
} from "../services/api";
import { getStoredMonitoringScope as readMonitoringScope } from "../data/indiaLocations";

const REFRESH_INTERVAL = 60 * 1000;

const FALLBACK_POINTS = [
  {
    road_name: "Outer Ring Road",
    latitude: 17.385,
    longitude: 78.4867,
    current_speed: 0,
    free_flow_speed: 60,
    congestion_level: "Low",
    data_source: "Configured monitoring point",
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

function getUser() {
  try {
    return JSON.parse(
      localStorage.getItem("irtms_user") || "{}"
    );
  } catch {
    return {};
  }
}

function toFiniteNumber(value, fallback = 0) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function normalizeTrafficPoint(item, index) {
  const speed = toFiniteNumber(
    item?.avg_speed_kmph ??
      item?.current_speed_kmph ??
      item?.current_speed ??
      item?.speed ??
      item?.currentSpeed
  );

  const freeFlowSpeed = toFiniteNumber(
    item?.free_flow_speed_kmph ??
      item?.free_flow_speed ??
      item?.freeFlowSpeed
  );

  const vehicleCount = toFiniteNumber(
    item?.vehicle_count ??
      item?.vehicleCount ??
      item?.vehicles
  );

  const rawTravelTime =
    item?.travel_time_minutes ??
    item?.travelTimeMinutes ??
    item?.travel_time ??
    item?.travelTime;

  const travelTime =
    rawTravelTime === null ||
    rawTravelTime === undefined ||
    rawTravelTime === ""
      ? null
      : toFiniteNumber(rawTravelTime, null);

  let congestion =
    item?.congestion_level ??
    item?.congestionLevel ??
    item?.congestion ??
    item?.status ??
    "";

  congestion = String(congestion || "")
    .trim()
    .toLowerCase();

  if (
    congestion === "critical" ||
    congestion === "severe"
  ) {
    congestion = "Critical";
  } else if (congestion === "high") {
    congestion = "High";
  } else if (
    congestion === "medium" ||
    congestion === "moderate"
  ) {
    congestion = "Medium";
  } else if (congestion === "low") {
    congestion = "Low";
  } else if (!congestion) {
    if (freeFlowSpeed > 0 && speed > 0) {
      const ratio = speed / freeFlowSpeed;

      if (ratio < 0.4) {
        congestion = "Critical";
      } else if (ratio < 0.7) {
        congestion = "Medium";
      } else {
        congestion = "Low";
      }
    } else {
      congestion = "Unknown";
    }
  } else {
    congestion =
      congestion.charAt(0).toUpperCase() +
      congestion.slice(1);
  }

  const road =
    item?.road_name ??
    item?.road ??
    item?.name ??
    `Monitoring Point ${index + 1}`;

  const latitude = toFiniteNumber(
    item?.latitude ??
      item?.lat ??
      item?.location?.latitude ??
      item?.position?.lat,
    NaN
  );

  const longitude = toFiniteNumber(
    item?.longitude ??
      item?.lng ??
      item?.lon ??
      item?.location?.longitude ??
      item?.position?.lon,
    NaN
  );

  const recordedAt =
    item?.recorded_at ??
    item?.observation_time ??
    item?.observationTime ??
    item?.timestamp ??
    item?.updated_at ??
    null;

  let roadStatus =
    item?.road_status ??
    item?.roadStatus;

  if (!roadStatus) {
    const normalized = congestion.toLowerCase();

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
    id: item?.id ?? `${road}-${index}`,
    road,
    latitude,
    longitude,
    speed,
    freeFlowSpeed,
    vehicleCount,
    travelTime,
    status: congestion,
    roadStatus,
    recordedAt,
    dataSource:
      item?.data_source ??
      item?.dataSource ??
      "Traffic monitoring",
    confidence:
      item?.confidence ??
      item?.confidence_score ??
      null,
    raw: item,
  };
}

function extractTrafficData(response) {
  const data = response?.data ?? response;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.points)) {
    return data.points;
  }

  if (Array.isArray(data?.records)) {
    return data.records;
  }

  if (Array.isArray(data?.traffic)) {
    return data.traffic;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
}

function formatTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTravelTime(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  if (numericValue < 1) {
    return `${Math.round(numericValue * 60)} sec`;
  }

  return `${numericValue.toFixed(1)} min`;
}

function getBadgeClass(status) {
  const value = String(status || "unknown")
    .toLowerCase()
    .trim();

  if (value === "critical" || value === "severe") {
    return "critical";
  }

  if (value === "high") {
    return "high";
  }

  if (value === "medium" || value === "moderate") {
    return "medium";
  }

  if (value === "low") {
    return "low";
  }

  return "unknown";
}

export default function LiveMonitoring() {
  const user = useMemo(() => getUser(), []);

  const role = normalizeRole(user?.role);

  const [monitoringScope, setMonitoringScope] =
    useState(readMonitoringScope);

  useEffect(() => {
    const handler = (event) => {
      setMonitoringScope(
        event.detail || readMonitoringScope()
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

  const isOperationalRole = [
    "traffic_operator",
    "system_operator",
    "commissioner",
  ].includes(role);

  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadTraffic = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        let rawPoints = [];

        if (isOperationalRole) {
          try {
            const response =
              await getLiveTomTomTraffic(
                monitoringScope.latitude,
                monitoringScope.longitude,
                monitoringScope.state,
                monitoringScope.area
              );

            rawPoints = extractTrafficData(response);
          } catch (tomTomError) {
            console.warn(
              "TomTom traffic unavailable. Falling back to stored traffic.",
              tomTomError
            );
          }

          if (!rawPoints.length) {
            const storedResponse =
              await getLiveTraffic();

            rawPoints =
              extractTrafficData(storedResponse);
          }
        } else {
          const response = await getLiveTraffic();

          rawPoints = extractTrafficData(response);
        }

        if (!rawPoints.length) {
          rawPoints = FALLBACK_POINTS;
        }

        const normalized = rawPoints
          .map(normalizeTrafficPoint)
          .filter((point) => {
            return (
              point.road &&
              Number.isFinite(point.latitude) &&
              Number.isFinite(point.longitude)
            );
          });

        if (normalized.length > 0) {
          setPoints(normalized);
        } else {
          setPoints(
            FALLBACK_POINTS.map(normalizeTrafficPoint)
          );
        }

        setLastUpdated(new Date());
      } catch (err) {
        console.error(
          "Unable to load live traffic:",
          err
        );

        setError(
          err?.response?.data?.detail ||
            err?.response?.data?.message ||
            err?.message ||
            "Unable to load live traffic data."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isOperationalRole, monitoringScope]
  );

  useEffect(() => {
    loadTraffic();

    const interval = setInterval(() => {
      loadTraffic(true);
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [loadTraffic]);

  const statistics = useMemo(() => {
    const total = points.length;

    const validSpeedPoints = points.filter(
      (point) => point.speed > 0
    );

    const averageSpeed =
      validSpeedPoints.length > 0
        ? validSpeedPoints.reduce(
            (sum, point) => sum + point.speed,
            0
          ) / validSpeedPoints.length
        : 0;

    const totalVehicles = points.reduce(
      (sum, point) => sum + point.vehicleCount,
      0
    );

    let low = 0;
    let medium = 0;
    let high = 0;
    let critical = 0;

    points.forEach((point) => {
      const status = String(point.status)
        .toLowerCase()
        .trim();

      if (status === "low") {
        low += 1;
      } else if (status === "medium") {
        medium += 1;
      } else if (status === "high") {
        high += 1;
      } else if (
        status === "critical" ||
        status === "severe"
      ) {
        critical += 1;
      }
    });

    return {
      total,
      averageSpeed,
      totalVehicles,
      low,
      medium,
      high,
      critical,
    };
  }, [points]);

  const mapPoints = useMemo(() => {
    return points.filter(
      (point) =>
        Number.isFinite(point.latitude) &&
        Number.isFinite(point.longitude) &&
        point.latitude >= -90 &&
        point.latitude <= 90 &&
        point.longitude >= -180 &&
        point.longitude <= 180 &&
        point.latitude !== 0 &&
        point.longitude !== 0
    );
  }, [points]);

  return (
    <div className="page-content live-monitoring-page">
      <section className="page-title">
        <div>
          <h1>Live Traffic Monitoring</h1>
          <p>
            Current traffic conditions, road speeds
            and congestion across monitored locations.
          </p>
        </div>

        <div className="page-title-actions">
          <div className="live-pill">
            <span className="live-dot" />
            Live monitoring
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => loadTraffic(true)}
            disabled={loading || refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      <MonitoringScope />

      {error && (
        <div className="alert alert-error">
          <strong>Traffic data unavailable.</strong>
          <span>{error}</span>

          <button
            type="button"
            className="btn btn-small"
            onClick={() => loadTraffic()}
          >
            Try again
          </button>
        </div>
      )}

      <section className="stats">
        <StatCard
          label="Monitored locations"
          value={
            loading ? "—" : statistics.total
          }
        />

        <StatCard
          label="Average speed"
          value={
            loading
              ? "—"
              : `${statistics.averageSpeed.toFixed(
                  1
                )} km/h`
          }
        />

        <StatCard
          label="Medium congestion"
          value={
            loading ? "—" : statistics.medium
          }
        />

        <StatCard
          label="High / Critical"
          value={
            loading
              ? "—"
              : statistics.high +
                statistics.critical
          }
        />
      </section>

      <section className="monitoring-summary-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Traffic Flow Summary</h3>
              <p>
                Current conditions across monitored
                road locations.
              </p>
            </div>
          </div>

          <div className="monitoring-summary">
            <div className="summary-item">
              <span className="summary-label">
                Free flowing
              </span>

              <strong className="summary-value">
                {statistics.low}
              </strong>
            </div>

            <div className="summary-item">
              <span className="summary-label">
                Moderate
              </span>

              <strong className="summary-value">
                {statistics.medium}
              </strong>
            </div>

            <div className="summary-item">
              <span className="summary-label">
                Heavy
              </span>

              <strong className="summary-value">
                {statistics.high}
              </strong>
            </div>

            <div className="summary-item">
              <span className="summary-label">
                Critical
              </span>

              <strong className="summary-value">
                {statistics.critical}
              </strong>
            </div>

            <div className="summary-item">
              <span className="summary-label">
                Vehicles monitored
              </span>

              <strong className="summary-value">
                {statistics.totalVehicles.toLocaleString()}
              </strong>
            </div>
          </div>
        </div>

        <div className="panel system-status-panel">
          <div className="panel-header">
            <div>
              <h3>Monitoring Status</h3>
              <p>
                Current traffic data connection.
              </p>
            </div>
          </div>

          <div className="system-status-list">
            <div className="system-status-row">
              <span>Data source</span>

              <strong>
                {isOperationalRole
                  ? "TomTom Traffic"
                  : "Stored traffic"}
              </strong>
            </div>

            <div className="system-status-row">
              <span>Update interval</span>
              <strong>60 seconds</strong>
            </div>

            <div className="system-status-row">
              <span>Last updated</span>

              <strong>
                {formatTime(lastUpdated)}
              </strong>
            </div>

            <div className="system-status-row">
              <span>Connection</span>

              <strong
                className={
                  error
                    ? "status-offline"
                    : "status-online"
                }
              >
                <span className="status-dot" />
                {error ? "Unavailable" : "Online"}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className="panel map-panel">
        <div className="panel-header">
          <div>
            <h3>Live Traffic Map</h3>
            <p>
              Geographic view of current monitored
              traffic conditions.
            </p>
          </div>

          <span className="map-count">
            {mapPoints.length} mapped location
            {mapPoints.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="traffic-map-container">
          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              <span>
                Loading live traffic data...
              </span>
            </div>
          ) : mapPoints.length > 0 ? (
            <TrafficMap points={mapPoints} />
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                📍
              </div>

              <h3>No mapped traffic locations</h3>

              <p>
                Traffic data is available, but no valid
                geographic coordinates were returned.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Current Traffic Observations</h3>
            <p>
              Current speed, free-flow speed, travel
              time, vehicles and road status.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state table-loading">
            <div className="spinner" />
            <span>
              Loading traffic observations...
            </span>
          </div>
        ) : points.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              🚦
            </div>

            <h3>
              No traffic observations available
            </h3>

            <p>
              There are currently no traffic records
              available for monitoring.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table traffic-observations-table">
              <thead>
                <tr>
                  <th>Road</th>
                  <th>Current Speed</th>
                  <th>Free-Flow Speed</th>
                  <th>Travel Time</th>
                  <th>Vehicles</th>
                  <th>Congestion</th>
                  <th>Road Status</th>
                  <th>Observed</th>
                </tr>
              </thead>

              <tbody>
                {points.map((point) => (
                  <tr key={point.id}>
                    <td>
                      <div className="road-name-cell">
                        <strong>
                          {point.road}
                        </strong>

                        {point.dataSource && (
                          <small>
                            {point.dataSource}
                          </small>
                        )}
                      </div>
                    </td>

                    <td>
                      <strong>
                        {point.speed.toFixed(1)} km/h
                      </strong>
                    </td>

                    <td>
                      {point.freeFlowSpeed > 0
                        ? `${point.freeFlowSpeed.toFixed(
                            1
                          )} km/h`
                        : "—"}
                    </td>

                    <td>
                      {formatTravelTime(
                        point.travelTime
                      )}
                    </td>

                    <td>
                      {point.vehicleCount.toLocaleString()}
                    </td>

                    <td>
                      <span
                        className={`badge ${getBadgeClass(
                          point.status
                        )}`}
                      >
                        {point.status}
                      </span>
                    </td>

                    <td>
                      <span className="road-status">
                        {point.roadStatus}
                      </span>
                    </td>

                    <td>
                      <span className="observation-time">
                        {formatTime(
                          point.recordedAt
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="analytics-update-status">
        <span className="status-dot" />

        {refreshing
          ? "Updating traffic data..."
          : lastUpdated
            ? `Last updated ${lastUpdated.toLocaleTimeString()}`
            : "Monitoring ready"}
      </div>
    </div>
  );
}