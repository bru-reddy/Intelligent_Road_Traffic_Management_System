import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../services/api";
import TrafficLoading from "../components/TrafficLoading";
import MonitoringScope from "../components/MonitoringScope.jsx";
import { getStoredMonitoringScope } from "../data/indiaLocations";

const REFRESH_INTERVAL = 60 * 1000;

function extractData(response) {
  return response?.data ?? response;
}

function extractArray(response, keys = []) {
  const data = extractData(response);

  if (Array.isArray(data)) {
    return data;
  }

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  return [];
}

function getValue(item, keys, fallback = null) {
  for (const key of keys) {
    if (
      item?.[key] !== undefined &&
      item?.[key] !== null
    ) {
      return item[key];
    }
  }

  return fallback;
}

function numberValue(value, fallback = 0) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric)
    ? numeric
    : fallback;
}

function formatNumber(value, decimals = 0) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return numeric.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function normalizeCongestion(value) {
  const level = String(value || "")
    .trim()
    .toLowerCase();

  if (
    level === "critical" ||
    level === "severe"
  ) {
    return "critical";
  }

  if (level === "high") {
    return "high";
  }

  if (
    level === "medium" ||
    level === "moderate"
  ) {
    return "medium";
  }

  if (
    level === "low" ||
    level === "normal" ||
    level === "light" ||
    level === "free" ||
    level === "free flowing"
  ) {
    return "low";
  }

  return "unknown";
}

function congestionFromSpeed(
  averageSpeed,
  freeFlowSpeed
) {
  const speed = Number(averageSpeed);
  const freeFlow = Number(freeFlowSpeed);

  if (
    !Number.isFinite(speed) ||
    !Number.isFinite(freeFlow) ||
    freeFlow <= 0 ||
    speed <= 0
  ) {
    return "unknown";
  }

  const ratio = speed / freeFlow;

  if (ratio < 0.35) {
    return "critical";
  }

  if (ratio < 0.55) {
    return "high";
  }

  if (ratio < 0.75) {
    return "medium";
  }

  return "low";
}

function normalizeRoadPerformance(
  item,
  index
) {
  const averageSpeed = numberValue(
    getValue(item, [
      "average_speed_kmph",
      "avg_speed_kmph",
      "average_speed",
      "avg_speed",
    ])
  );

  const freeFlowSpeed = numberValue(
    getValue(item, [
      "free_flow_speed_kmph",
      "freeFlowSpeed",
      "free_flow_speed",
      "average_free_flow_speed_kmph",
    ])
  );

  const vehicleCount = numberValue(
    getValue(item, [
      "vehicle_count",
      "vehicles",
      "total_vehicles",
      "average_vehicle_count",
    ])
  );

  const rawCongestion = getValue(
    item,
    [
      "congestion_level",
      "congestion",
      "traffic_level",
      "performance",
    ],
    null
  );

  const normalizedRaw =
    normalizeCongestion(rawCongestion);

  const congestion =
    normalizedRaw !== "unknown"
      ? normalizedRaw
      : congestionFromSpeed(
          averageSpeed,
          freeFlowSpeed
        );

  return {
    id:
      item?.id ??
      `road-${index}`,

    road:
      getValue(
        item,
        [
          "road_name",
          "road",
          "name",
          "location",
        ],
        `Road ${index + 1}`
      ),

    averageSpeed,
    freeFlowSpeed,
    vehicleCount,
    congestion,

    observationCount: numberValue(
      getValue(item, [
        "observation_count",
        "observations",
        "count",
      ])
    ),
  };
}

function normalizeTrend(item, index) {
  const timestamp = getValue(
    item,
    [
      "timestamp",
      "recorded_at",
      "observation_time",
      "date",
      "time",
      "period",
      "label",
    ],
    null
  );

  return {
    id:
      item?.id ??
      timestamp ??
      `trend-${index}`,

    timestamp,

    congestion: numberValue(
      getValue(item, [
        "congestion_index",
        "congestion_score",
        "average_congestion",
        "congestion",
        "congestion_level",
      ])
    ),

    speed: numberValue(
      getValue(item, [
        "average_speed_kmph",
        "avg_speed_kmph",
        "average_speed",
        "speed",
      ])
    ),

    vehicles: numberValue(
      getValue(item, [
        "average_vehicle_count",
        "vehicle_count",
        "vehicles",
      ])
    ),
  };
}

function normalizeHeatmapPoint(
  item,
  index
) {
  const latitude = numberValue(
    getValue(item, [
      "latitude",
      "lat",
    ]),
    NaN
  );

  const longitude = numberValue(
    getValue(item, [
      "longitude",
      "lng",
      "lon",
    ]),
    NaN
  );

  let intensity = numberValue(
    getValue(item, [
      "intensity",
      "congestion_score",
      "congestion",
      "vehicle_count",
    ])
  );

  const congestion = getValue(
    item,
    [
      "congestion_level",
      "traffic_level",
      "congestion",
    ],
    "Unknown"
  );

  if (
    intensity <= 1 &&
    intensity > 0
  ) {
    intensity *= 100;
  }

  if (
    intensity === 0 &&
    normalizeCongestion(congestion) !==
      "unknown"
  ) {
    const level =
      normalizeCongestion(
        congestion
      );

    if (level === "critical") {
      intensity = 100;
    } else if (level === "high") {
      intensity = 75;
    } else if (level === "medium") {
      intensity = 50;
    } else {
      intensity = 25;
    }
  }

  return {
    id:
      item?.id ??
      `heatmap-${index}`,

    road:
      getValue(
        item,
        [
          "road_name",
          "road",
          "name",
          "location",
        ],
        `Location ${index + 1}`
      ),

    latitude,
    longitude,

    intensity: Math.max(
      0,
      Math.min(100, intensity)
    ),

    congestion,

    vehicleCount: numberValue(
      getValue(item, [
        "vehicle_count",
        "vehicles",
        "total_vehicles",
      ])
    ),

    averageSpeed: numberValue(
      getValue(item, [
        "average_speed_kmph",
        "avg_speed_kmph",
        "average_speed",
      ])
    ),
  };
}

function normalizeUtilization(
  item,
  index
) {
  let value = numberValue(
    getValue(item, [
      "utilization_percentage",
      "utilization_percent",
      "utilization",
      "road_utilization",
      "percentage",
    ])
  );

  if (
    value > 0 &&
    value <= 1
  ) {
    value *= 100;
  }

  return {
    id:
      item?.id ??
      `utilization-${index}`,

    road:
      getValue(
        item,
        [
          "road_name",
          "road",
          "name",
        ],
        `Road ${index + 1}`
      ),

    value: Math.max(
      0,
      Math.min(100, value)
    ),
  };
}

function formatTrendLabel(timestamp) {
  if (!timestamp) {
    return "—";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return String(timestamp);
  }

  return date.toLocaleTimeString(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  );
}

function formatTooltipDate(timestamp) {
  if (!timestamp) {
    return "Time unavailable";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return String(timestamp);
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function congestionLabel(value) {
  const normalized =
    normalizeCongestion(value);

  if (normalized === "critical") {
    return "Critical";
  }

  if (normalized === "high") {
    return "High";
  }

  if (normalized === "medium") {
    return "Medium";
  }

  if (normalized === "low") {
    return "Low";
  }

  return "Unknown";
}

function getCongestionCount(
  roads,
  level
) {
  return roads.filter(
    (road) =>
      road.congestion === level
  ).length;
}

function buildLinePath(
  points,
  width,
  height,
  padding,
  maxValue
) {
  if (!points.length) {
    return "";
  }

  const chartWidth =
    width -
    padding.left -
    padding.right;

  const chartHeight =
    height -
    padding.top -
    padding.bottom;

  return points
    .map((point, index) => {
      const x =
        padding.left +
        (index /
          Math.max(
            points.length - 1,
            1
          )) *
          chartWidth;

      const normalized =
        maxValue > 0
          ? point.value /
            maxValue
          : 0;

      const y =
        padding.top +
        chartHeight -
        normalized *
          chartHeight;

      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function TrendGraph({
  data,
  metric,
}) {
  const width = 900;
  const height = 360;

  const padding = {
    top: 24,
    right: 28,
    bottom: 54,
    left: 56,
  };

  const values = data.map(
    (item) =>
      metric === "congestion"
        ? item.congestion
        : item.speed
  );

  const maxValue =
    metric === "congestion"
      ? Math.max(...values, 4)
      : Math.max(...values, 1);

  const points = data.map(
    (item, index) => ({
      ...item,
      value:
        metric === "congestion"
          ? item.congestion
          : item.speed,
      index,
    })
  );

  const path = buildLinePath(
    points,
    width,
    height,
    padding,
    maxValue
  );

  const chartWidth =
    width -
    padding.left -
    padding.right;

  const chartHeight =
    height -
    padding.top -
    padding.bottom;

  return (
    <div className="analytics-line-chart">
      <div className="analytics-chart-legend">
        <span className="analytics-legend-line" />
        <span>
          {metric === "congestion"
            ? "Congestion index"
            : "Average speed"}
        </span>
      </div>

      <svg
        className="analytics-trend-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={
          metric === "congestion"
            ? "Traffic congestion trend"
            : "Average traffic speed trend"
        }
      >
        {[0, 0.25, 0.5, 0.75, 1].map(
          (ratio) => {
            const y =
              padding.top +
              chartHeight -
              ratio *
                chartHeight;

            const label =
              maxValue * ratio;

            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  x2={
                    width -
                    padding.right
                  }
                  y1={y}
                  y2={y}
                  className="analytics-grid-line"
                />

                <text
                  x={padding.left - 12}
                  y={y + 4}
                  textAnchor="end"
                  className="analytics-axis-text"
                >
                  {metric ===
                  "congestion"
                    ? label.toFixed(
                        0
                      )
                    : label.toFixed(
                        0
                      )}
                </text>
              </g>
            );
          }
        )}

        <path
          d={path}
          className="analytics-trend-line"
          fill="none"
        />

        {points.map(
          (
            point,
            index
          ) => {
            const x =
              padding.left +
              (index /
                Math.max(
                  points.length - 1,
                  1
                )) *
                chartWidth;

            const normalized =
              maxValue > 0
                ? point.value /
                  maxValue
                : 0;

            const y =
              padding.top +
              chartHeight -
              normalized *
                chartHeight;

            return (
              <g
                key={point.id}
              >
                <circle
                  cx={x}
                  cy={y}
                  r="5"
                  className="analytics-trend-point"
                />

                <title>
                  {`${formatTooltipDate(
                    point.timestamp
                  )} — ${
                    metric ===
                    "congestion"
                      ? "Congestion"
                      : "Speed"
                  }: ${formatNumber(
                    point.value,
                    1
                  )}${
                    metric ===
                    "speed"
                      ? " km/h"
                      : ""
                  }`}
                </title>
              </g>
            );
          }
        )}

        {points.map(
          (
            point,
            index
          ) => {
            if (
              points.length >
                8 &&
              index %
                Math.ceil(
                  points.length /
                    8
                ) !==
                0 &&
              index !==
                points.length - 1
            ) {
              return null;
            }

            const x =
              padding.left +
              (index /
                Math.max(
                  points.length - 1,
                  1
                )) *
                chartWidth;

            return (
              <text
                key={`label-${point.id}`}
                x={x}
                y={
                  height -
                  18
                }
                textAnchor="middle"
                className="analytics-axis-text"
              >
                {formatTrendLabel(
                  point.timestamp
                )}
              </text>
            );
          }
        )}
      </svg>

      <div className="analytics-chart-summary">
        <span>
          {data.length} observations
        </span>

        <span>
          Peak:{" "}
          {formatNumber(
            Math.max(
              ...values,
              0
            ),
            1
          )}
          {metric === "speed"
            ? " km/h"
            : ""}
        </span>
      </div>
    </div>
  );
}

function CongestionDonut({
  counts,
  total,
}) {
  const low = counts.low;
  const medium = counts.medium;
  const high = counts.high;
  const critical = counts.critical;

  const lowPct =
    total > 0
      ? (low / total) * 100
      : 0;

  const mediumPct =
    total > 0
      ? (medium / total) * 100
      : 0;

  const highPct =
    total > 0
      ? (high / total) * 100
      : 0;

  const criticalPct =
    total > 0
      ? (critical / total) * 100
      : 0;

  const firstEnd = lowPct;
  const secondEnd =
    firstEnd + mediumPct;
  const thirdEnd =
    secondEnd + highPct;

  const background =
    total > 0
      ? `conic-gradient(
          #22c55e 0% ${firstEnd}%,
          #f59e0b ${firstEnd}% ${secondEnd}%,
          #f97316 ${secondEnd}% ${thirdEnd}%,
          #ef4444 ${thirdEnd}% ${thirdEnd + criticalPct}%,
          #e5e7eb ${thirdEnd + criticalPct}% 100%
        )`
      : "#e5e7eb";

  return (
    <div className="congestion-donut-wrapper">
      <div
        className="congestion-donut"
        style={{
          background,
        }}
      >
        <div className="congestion-donut-inner">
          <strong>
            {total}
          </strong>

          <span>
            Roads
          </span>
        </div>
      </div>

      <div className="congestion-donut-legend">
        <LegendItem
          label="Low"
          value={low}
          className="low"
        />

        <LegendItem
          label="Medium"
          value={medium}
          className="medium"
        />

        <LegendItem
          label="High"
          value={high}
          className="high"
        />

        <LegendItem
          label="Critical"
          value={critical}
          className="critical"
        />
      </div>
    </div>
  );
}

function LegendItem({
  label,
  value,
  className,
}) {
  return (
    <div className="congestion-legend-item">
      <span>
        <i
          className={`congestion-legend-dot ${className}`}
        />
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function UtilizationGraph({
  data,
}) {
  const sorted = [...data]
    .sort(
      (a, b) =>
        b.value - a.value
    )
    .slice(0, 10);

  return (
    <div className="road-utilization-chart">
      {sorted.map(
        (item, index) => (
          <div
            className="utilization-chart-row"
            key={item.id}
          >
            <div className="utilization-chart-label">
              <span>
                {item.road}
              </span>

              <strong>
                {formatNumber(
                  item.value,
                  1
                )}
                %
              </strong>
            </div>

            <div className="utilization-chart-track">
              <div
                className={`utilization-chart-fill ${
                  item.value >= 80
                    ? "critical"
                    : item.value >=
                      60
                    ? "high"
                    : item.value >=
                      35
                    ? "medium"
                    : "low"
                }`}
                style={{
                  width: `${item.value}%`,
                }}
              />

              <span
                className="utilization-chart-marker"
                style={{
                  left: `${item.value}%`,
                }}
              />
            </div>

            <span className="utilization-rank">
              {String(
                index + 1
              ).padStart(2, "0")}
            </span>
          </div>
        )
      )}

      <div className="utilization-scale">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

export default function Analytics() {
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

  const [heatmap, setHeatmap] =
    useState([]);

  const [
    roadPerformance,
    setRoadPerformance,
  ] = useState([]);

  const [trends, setTrends] =
    useState([]);

  const [
    roadUtilization,
    setRoadUtilization,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState(null);

  const [
    trendMetric,
    setTrendMetric,
  ] = useState("congestion");

  const loadAnalytics =
    useCallback(
      async (silent = false) => {
        try {
          if (silent) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setError("");

          const scopeParams = {
            state: monitoringScope.state,
            area: monitoringScope.area,
          };

          const requestAnalytics = () =>
            Promise.allSettled([
              api.get(
                "/analytics/heatmap",
                { params: scopeParams }
              ),
              api.get(
                "/analytics/road-performance",
                { params: scopeParams }
              ),
              api.get(
                "/analytics/trends",
                { params: scopeParams }
              ),
              api.get(
                "/traffic/road-utilization",
                { params: scopeParams }
              ),
            ]);

          let results =
            await requestAnalytics();

          // Analytics must not depend on the Dashboard being opened first.
          // If a newly selected city has no stored observations yet, trigger
          // one live/simulation observation for that exact monitoring scope.
          // The backend persists successful TomTom observations and already
          // persists simulation fallbacks, after which the analytics queries
          // can read the newly available data.
          const analyticsAreEmpty =
            results.every((result) => {
              if (result.status !== "fulfilled") {
                return true;
              }

              const data = extractData(result.value);

              if (Array.isArray(data)) {
                return data.length === 0;
              }

              if (data && typeof data === "object") {
                return Object.keys(data).length === 0;
              }

              return true;
            });

          const hasCoordinates =
            monitoringScope?.latitude !== null &&
            monitoringScope?.latitude !== undefined &&
            monitoringScope?.longitude !== null &&
            monitoringScope?.longitude !== undefined &&
            Number.isFinite(
              Number(monitoringScope.latitude)
            ) &&
            Number.isFinite(
              Number(monitoringScope.longitude)
            ) &&
            !(
              Number(monitoringScope.latitude) === 0 &&
              Number(monitoringScope.longitude) === 0
            );

          if (
            analyticsAreEmpty &&
            hasCoordinates
          ) {
            try {
              const liveResponse = await api.get(
                "/traffic/live-tomtom",
                {
                  params: {
                    latitude: Number(
                      monitoringScope.latitude
                    ),
                    longitude: Number(
                      monitoringScope.longitude
                    ),
                    state:
                      monitoringScope.state,
                    area:
                      monitoringScope.area,
                  },
                }
              );

              // Use the live/simulation response immediately as an
              // analytics source. This keeps Analytics populated even
              // when the database write is delayed or unavailable.
              const livePoints = extractArray(
                liveResponse,
                [
                  "points",
                  "traffic",
                  "observations",
                  "results",
                ]
              );

              if (livePoints.length > 0) {
                setHeatmap(
                  livePoints.map(
                    normalizeHeatmapPoint
                  )
                );

                setRoadPerformance(
                  livePoints.map(
                    normalizeRoadPerformance
                  )
                );

                setRoadUtilization(
                  livePoints.map(
                    normalizeUtilization
                  )
                );

                setTrends(
                  livePoints
                    .map(
                      (point, index) =>
                        normalizeTrend(
                          {
                            ...point,
                            timestamp:
                              point?.recorded_at ||
                              new Date().toISOString(),
                          },
                          index
                        )
                    )
                    .filter(
                      (item) =>
                        item.timestamp
                    )
                );
              }

              // Refresh from the database as well. If persistence has
              // completed, this replaces the immediate fallback data
              // with the canonical analytics records.
              const refreshedResults =
                await requestAnalytics();

              const refreshedHasData =
                refreshedResults.some(
                  (result) =>
                    result.status === "fulfilled" &&
                    extractArray(
                      result.value,
                      [
                        "points",
                        "heatmap",
                        "roads",
                        "road_performance",
                        "trends",
                        "utilization",
                        "data",
                        "results",
                      ]
                    ).length > 0
                );

              if (refreshedHasData) {
                results = refreshedResults;
              }
            } catch (liveError) {
              console.warn(
                "Analytics live-data warmup failed:",
                liveError
              );
            }
          }

          const [
            heatmapResult,
            performanceResult,
            trendsResult,
            utilizationResult,
          ] = results;

          const failed = [];

          if (
            heatmapResult.status ===
            "fulfilled"
          ) {
            const data =
              extractArray(
                heatmapResult.value,
                [
                  "points",
                  "heatmap",
                  "data",
                  "locations",
                  "results",
                ]
              );

            setHeatmap(
              data.map(
                normalizeHeatmapPoint
              )
            );
          } else {
            failed.push("heatmap");
            setHeatmap([]);
          }

          if (
            performanceResult.status ===
            "fulfilled"
          ) {
            const data =
              extractArray(
                performanceResult.value,
                [
                  "roads",
                  "road_performance",
                  "data",
                  "results",
                ]
              );

            setRoadPerformance(
              data.map(
                normalizeRoadPerformance
              )
            );
          } else {
            failed.push(
              "road performance"
            );

            setRoadPerformance([]);
          }

          if (
            trendsResult.status ===
            "fulfilled"
          ) {
            const data =
              extractArray(
                trendsResult.value,
                [
                  "trends",
                  "data",
                  "results",
                ]
              );

            const normalized =
              data
                .map(
                  normalizeTrend
                )
                .filter(
                  (item) =>
                    item.timestamp
                )
                .sort(
                  (a, b) => {
                    const first =
                      new Date(
                        a.timestamp
                      ).getTime();

                    const second =
                      new Date(
                        b.timestamp
                      ).getTime();

                    if (
                      Number.isFinite(
                        first
                      ) &&
                      Number.isFinite(
                        second
                      )
                    ) {
                      return (
                        first -
                        second
                      );
                    }

                    return 0;
                  }
                );

            setTrends(
              normalized
            );
          } else {
            failed.push("trends");
            setTrends([]);
          }

          if (
            utilizationResult.status ===
            "fulfilled"
          ) {
            const data =
              extractArray(
                utilizationResult.value,
                [
                  "roads",
                  "utilization",
                  "data",
                  "results",
                ]
              );

            setRoadUtilization(
              data.map(
                normalizeUtilization
              )
            );
          } else {
            failed.push(
              "road utilization"
            );

            setRoadUtilization([]);
          }

          setLastUpdated(
            new Date()
          );

          if (
            failed.length === 4
          ) {
            throw new Error(
              "Unable to retrieve analytics data."
            );
          }

          if (
            failed.length > 0
          ) {
            setError(
              `Some analytics data could not be loaded: ${failed.join(
                ", "
              )}.`
            );
          }
        } catch (err) {
          console.error(
            "Unable to load analytics:",
            err
          );

          setError(
            err?.response?.data
              ?.detail ||
              err?.response?.data
                ?.message ||
              err?.message ||
              "Unable to load analytics data."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [monitoringScope]
    );

  useEffect(() => {
    loadAnalytics();

    const interval =
      setInterval(
        () =>
          loadAnalytics(true),
        REFRESH_INTERVAL
      );

    return () =>
      clearInterval(interval);
  }, [loadAnalytics]);

  const summary = useMemo(() => {
    const roads =
      roadPerformance;

    const totalVehicles =
      roads.reduce(
        (sum, road) =>
          sum +
          road.vehicleCount,
        0
      );

    const validSpeeds =
      roads
        .map(
          (road) =>
            road.averageSpeed
        )
        .filter(
          (speed) =>
            speed > 0
        );

    const averageSpeed =
      validSpeeds.length
        ? validSpeeds.reduce(
            (sum, speed) =>
              sum + speed,
            0
          ) /
          validSpeeds.length
        : 0;

    const counts = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
      unknown: 0,
    };

    roads.forEach(
      (road) => {
        if (
          counts[
            road.congestion
          ] !== undefined
        ) {
          counts[
            road.congestion
          ] += 1;
        } else {
          counts.unknown += 1;
        }
      }
    );

    return {
      roads: roads.length,
      totalVehicles,
      averageSpeed,
      ...counts,
    };
  }, [roadPerformance]);

  const sortedRoads = useMemo(
    () =>
      [...roadPerformance].sort(
        (a, b) =>
          b.averageSpeed -
          a.averageSpeed
      ),
    [roadPerformance]
  );

  const visibleTrends =
    useMemo(
      () =>
        trends.slice(-12),
      [trends]
    );

  const congestionCounts =
    useMemo(
      () => ({
        low: getCongestionCount(
          roadPerformance,
          "low"
        ),
        medium:
          getCongestionCount(
            roadPerformance,
            "medium"
          ),
        high:
          getCongestionCount(
            roadPerformance,
            "high"
          ),
        critical:
          getCongestionCount(
            roadPerformance,
            "critical"
          ),
      }),
      [roadPerformance]
    );

  if (loading) {
    return (
      <div className="page-content analytics-page">
        <TrafficLoading
          title="Loading traffic analytics"
          message="IRTMS is processing traffic intelligence and historical road data."
          fullScreen={false}
        />
      </div>
    );
  }

  return (
    <div className="page-content analytics-page">
      <MonitoringScope />

      <section className="page-title">
        <div>
          <span className="page-eyebrow">
            TRAFFIC INTELLIGENCE
          </span>

          <h1>
            Traffic Analytics
          </h1>

          <p>
            Visual analysis of traffic
            performance, congestion
            trends and road
            utilization.
          </p>
        </div>

        <div className="page-title-actions">
          <div className="live-pill">
            <span className="live-dot" />
            Analytics monitoring
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              loadAnalytics(true)
            }
            disabled={
              refreshing
            }
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>
      </section>

      {error && (
        <div className="alert alert-error">
          <strong>
            Analytics warning.
          </strong>

          <span>
            {error}
          </span>
        </div>
      )}

      <section className="stats">
        <div className="stat-card">
          <div className="stat-card-content">
            <span className="stat-label">
              Monitored Roads
            </span>

            <strong className="stat-value">
              {summary.roads}
            </strong>

            <span className="stat-card-meta">
              Roads with historical
              observations
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-content">
            <span className="stat-label">
              Average Speed
            </span>

            <strong className="stat-value">
              {summary.averageSpeed >
              0
                ? `${summary.averageSpeed.toFixed(
                    1
                  )} km/h`
                : "—"}
            </strong>

            <span className="stat-card-meta">
              Across monitored roads
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-content">
            <span className="stat-label">
              High / Critical
            </span>

            <strong className="stat-value">
              {summary.high +
                summary.critical}
            </strong>

            <span className="stat-card-meta">
              Roads requiring
              attention
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-content">
            <span className="stat-label">
              Vehicles Observed
            </span>

            <strong className="stat-value">
              {formatNumber(
                summary.totalVehicles
              )}
            </strong>

            <span className="stat-card-meta">
              Historical traffic
              observations
            </span>
          </div>
        </div>
      </section>

      <section className="analytics-grid">
        <div className="panel analytics-chart-panel">
          <div className="panel-header">
            <div>
              <h3>
                Traffic Trends
              </h3>

              <p>
                Hourly traffic movement
                across the latest
                available observations.
              </p>
            </div>

            <div className="chart-controls">
              <button
                type="button"
                className={
                  trendMetric ===
                  "congestion"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setTrendMetric(
                    "congestion"
                  )
                }
              >
                Congestion
              </button>

              <button
                type="button"
                className={
                  trendMetric ===
                  "speed"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setTrendMetric(
                    "speed"
                  )
                }
              >
                Speed
              </button>
            </div>
          </div>

          {visibleTrends.length >
          0 ? (
            <TrendGraph
              data={
                visibleTrends
              }
              metric={
                trendMetric
              }
            />
          ) : (
            <div className="empty-state compact analytics-empty">
              <div className="empty-state-icon">
                —
              </div>

              <h3>
                No trend data
              </h3>

              <p>
                Historical hourly traffic
                data is not available.
              </p>
            </div>
          )}
        </div>

        <div className="panel congestion-breakdown-panel">
          <div className="panel-header">
            <div>
              <h3>
                Congestion Distribution
              </h3>

              <p>
                Current distribution of
                monitored road conditions.
              </p>
            </div>
          </div>

          {summary.roads > 0 ? (
            <div className="congestion-visual">
              <CongestionDonut
                counts={
                  congestionCounts
                }
                total={
                  summary.roads
                }
              />

              <div className="congestion-distribution-bars">
                {[
                  {
                    label: "Low",
                    value:
                      congestionCounts.low,
                    className:
                      "low",
                  },
                  {
                    label: "Medium",
                    value:
                      congestionCounts.medium,
                    className:
                      "medium",
                  },
                  {
                    label: "High",
                    value:
                      congestionCounts.high,
                    className:
                      "high",
                  },
                  {
                    label: "Critical",
                    value:
                      congestionCounts.critical,
                    className:
                      "critical",
                  },
                ].map(
                  (item) => {
                    const percentage =
                      summary.roads >
                      0
                        ? (item.value /
                            summary.roads) *
                          100
                        : 0;

                    return (
                      <div
                        className="congestion-graph-row"
                        key={
                          item.label
                        }
                      >
                        <div className="congestion-graph-header">
                          <span>
                            <i
                              className={`congestion-indicator ${item.className}`}
                            />

                            {
                              item.label
                            }
                          </span>

                          <strong>
                            {
                              item.value
                            }
                          </strong>
                        </div>

                        <div className="congestion-graph-track">
                          <div
                            className={`congestion-graph-fill ${item.className}`}
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>

                        <span className="congestion-graph-percentage">
                          {percentage.toFixed(
                            0
                          )}
                          %
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state compact analytics-empty">
              <div className="empty-state-icon">
                —
              </div>

              <h3>
                No road data
              </h3>

              <p>
                Road condition data is
                not available yet.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="panel heatmap-panel">
        <div className="panel-header">
          <div>
            <h3>
              Traffic Heatmap
            </h3>

            <p>
              Geographic distribution of
              traffic intensity.
            </p>
          </div>

          <span className="map-count">
            {heatmap.length} point
            {heatmap.length ===
            1
              ? ""
              : "s"}
          </span>
        </div>

        {heatmap.length > 0 ? (
          <div className="heatmap-visual">
            <div className="heatmap-grid">
              {heatmap
                .slice(0, 40)
                .map(
                  (point) => {
                    const normalized =
                      normalizeCongestion(
                        point.congestion
                      );

                    const level =
                      normalized ===
                      "critical"
                        ? "critical"
                        : point.intensity >=
                          70
                        ? "high"
                        : point.intensity >=
                          40
                        ? "medium"
                        : "low";

                    return (
                      <div
                        key={
                          point.id
                        }
                        className={`heatmap-point ${level}`}
                        title={`${point.road} • ${formatNumber(
                          point.intensity,
                          0
                        )}% intensity`}
                        style={{
                          opacity:
                            Math.max(
                              0.4,
                              Math.min(
                                1,
                                point.intensity /
                                  100
                              )
                            ),
                        }}
                      >
                        <span />
                      </div>
                    );
                  }
                )}
            </div>

            <div className="heatmap-legend">
              <span>
                <i className="legend-dot low" />
                Low
              </span>

              <span>
                <i className="legend-dot medium" />
                Medium
              </span>

              <span>
                <i className="legend-dot high" />
                High
              </span>

              <span>
                <i className="legend-dot critical" />
                Critical
              </span>
            </div>
          </div>
        ) : (
          <div className="empty-state compact analytics-empty">
            <div className="empty-state-icon">
              —
            </div>

            <h3>
              No heatmap data
            </h3>

            <p>
              Geographic traffic data is
              not available.
            </p>
          </div>
        )}
      </section>

      <section className="analytics-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>
                Road Performance
              </h3>

              <p>
                Observed speed and
                traffic conditions by
                road.
              </p>
            </div>
          </div>

          {sortedRoads.length >
          0 ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      Road
                    </th>

                    <th>
                      Avg. Speed
                    </th>

                    <th>
                      Free Flow
                    </th>

                    <th>
                      Vehicles
                    </th>

                    <th>
                      Congestion
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {sortedRoads.map(
                    (road) => (
                      <tr
                        key={
                          road.id
                        }
                      >
                        <td>
                          <strong>
                            {
                              road.road
                            }
                          </strong>
                        </td>

                        <td>
                          {road.averageSpeed >
                          0
                            ? `${formatNumber(
                                road.averageSpeed,
                                1
                              )} km/h`
                            : "—"}
                        </td>

                        <td>
                          {road.freeFlowSpeed >
                          0
                            ? `${formatNumber(
                                road.freeFlowSpeed,
                                1
                              )} km/h`
                            : "—"}
                        </td>

                        <td>
                          {formatNumber(
                            road.vehicleCount
                          )}
                        </td>

                        <td>
                          <span
                            className={`badge ${road.congestion}`}
                          >
                            {congestionLabel(
                              road.congestion
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state compact analytics-empty">
              <div className="empty-state-icon">
                —
              </div>

              <h3>
                No road performance
              </h3>

              <p>
                No road performance records
                are available.
              </p>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>
                Road Utilization
              </h3>

              <p>
                Relative utilization across
                monitored roads.
              </p>
            </div>
          </div>

          {roadUtilization.length >
          0 ? (
            <UtilizationGraph
              data={
                roadUtilization
              }
            />
          ) : (
            <div className="empty-state compact analytics-empty">
              <div className="empty-state-icon">
                —
              </div>

              <h3>
                No utilization data
              </h3>

              <p>
                Road utilization data is
                not available.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="analytics-update-status">
        <span className="status-dot" />

        {refreshing
          ? "Updating analytics..."
          : lastUpdated
          ? `Last updated ${lastUpdated.toLocaleTimeString(
              "en-IN",
              {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }
            )}`
          : "Analytics ready"}
      </div>
    </div>
  );
}