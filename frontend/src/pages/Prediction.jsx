import React, { useEffect, useRef, useState } from "react";
import {
  getPeakHours,
  getPredictionReport,
  predictTraffic,
  searchRoutes,
} from "../services/api";
import TrafficLoading from "../components/TrafficLoading";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const HORIZONS = [15, 30, 45, 60, 90];

/*
 * Local city suggestions are a fallback for cases where
 * TomTom does not return a result for a city-level query.
 *
 * These do not replace TomTom road search.
 * TomTom results are still included whenever available.
 */
const CITY_SUGGESTIONS = [
  {
    name: "Hyderabad",
    label: "Hyderabad, Telangana",
    latitude: 17.385,
    longitude: 78.4867,
  },
  {
    name: "Pune",
    label: "Pune, Maharashtra",
    latitude: 18.5204,
    longitude: 73.8567,
  },
  {
    name: "Mumbai",
    label: "Mumbai, Maharashtra",
    latitude: 19.076,
    longitude: 72.8777,
  },
  {
    name: "Bengaluru",
    label: "Bengaluru, Karnataka",
    latitude: 12.9716,
    longitude: 77.5946,
  },
  {
    name: "Chennai",
    label: "Chennai, Tamil Nadu",
    latitude: 13.0827,
    longitude: 80.2707,
  },
  {
    name: "Delhi",
    label: "Delhi, India",
    latitude: 28.6139,
    longitude: 77.209,
  },
  {
    name: "New Delhi",
    label: "New Delhi, India",
    latitude: 28.6139,
    longitude: 77.209,
  },
  {
    name: "Kolkata",
    label: "Kolkata, West Bengal",
    latitude: 22.5726,
    longitude: 88.3639,
  },
  {
    name: "Ahmedabad",
    label: "Ahmedabad, Gujarat",
    latitude: 23.0225,
    longitude: 72.5714,
  },
  {
    name: "Jaipur",
    label: "Jaipur, Rajasthan",
    latitude: 26.9124,
    longitude: 75.7873,
  },
  {
    name: "Surat",
    label: "Surat, Gujarat",
    latitude: 21.1702,
    longitude: 72.8311,
  },
  {
    name: "Nagpur",
    label: "Nagpur, Maharashtra",
    latitude: 21.1458,
    longitude: 79.0882,
  },
  {
    name: "Indore",
    label: "Indore, Madhya Pradesh",
    latitude: 22.7196,
    longitude: 75.8577,
  },
  {
    name: "Kochi",
    label: "Kochi, Kerala",
    latitude: 9.9312,
    longitude: 76.2673,
  },
  {
    name: "Visakhapatnam",
    label: "Visakhapatnam, Andhra Pradesh",
    latitude: 17.6868,
    longitude: 83.2185,
  },
  {
    name: "Vijayawada",
    label: "Vijayawada, Andhra Pradesh",
    latitude: 16.5062,
    longitude: 80.648,
  },
];

const HYDERABAD_ROAD_SUGGESTIONS = [
  "Hayathnagar",
  "Uppal",
  "LB Nagar",
  "Gachibowli",
  "Hitech City",
  "Madhapur",
  "Kukatpally",
  "Mehdipatnam",
  "Secunderabad",
  "Banjara Hills",
  "Begumpet",
  "Raj Bhavan Road",
  "Outer Ring Road",
  "NH 65",
  "NH 163",
  "Gachibowli Main Road",
  "Hitech City Road",
  "LB Nagar Junction",
  "Madhapur Road",
  "Mehdipatnam-Tolichowki Road",
  "S.D. Road",
];

function createInitialForm() {
  const now = new Date();

  return {
    road_name: "",
    prediction_horizon: 30,
    hour: now.getHours(),
    day_of_week: now.getDay(),
    vehicle_count: "",
    current_speed_kmph: "",
    free_flow_speed_kmph: "",
  };
}

function extractData(response) {
  return response?.data ?? response;
}

function extractSuggestions(response) {
  const data = extractData(response);

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.suggestions)) {
    return data.suggestions;
  }

  if (Array.isArray(data?.locations)) {
    return data.locations;
  }

  return [];
}

function getValue(data, keys, fallback = null) {
  for (const key of keys) {
    if (
      data?.[key] !== undefined &&
      data?.[key] !== null
    ) {
      return data[key];
    }
  }

  return fallback;
}

function locationLabel(item) {
  if (typeof item === "string") {
    return item;
  }

  if (!item || typeof item !== "object") {
    return "Location";
  }

  const address = item.address;

  if (typeof address === "string") {
    return address;
  }

  if (address && typeof address === "object") {
    return (
      address.freeformAddress ||
      address.freeform_address ||
      address.streetName ||
      address.municipality ||
      address.country ||
      item.name ||
      "Location"
    );
  }

  return (
    item.name ||
    item.label ||
    item.display_name ||
    item.displayName ||
    "Location"
  );
}

/*
 * Finds city suggestions locally.
 *
 * Examples:
 * Hyderabad
 * Hyd
 * Pune
 * Mumbai
 */
function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function editDistance(a, b) {
  const left = normalizeSearchText(a);
  const right = normalizeSearchText(b);

  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index
  );

  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;

      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }

    for (let j = 0; j < current.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length];
}

function getLocalCitySuggestions(query) {
  const normalized = normalizeSearchText(query);

  if (normalized.length < 2) {
    return [];
  }

  const roadSuggestions =
    HYDERABAD_ROAD_SUGGESTIONS.map((name) => ({
      name,
      label: name,
      source: "local-road",
    }));

  const candidates = [
    ...CITY_SUGGESTIONS,
    ...roadSuggestions,
  ];

  return candidates
    .map((item) => {
      const label = normalizeSearchText(
        locationLabel(item)
      );

      const startsWith = label.startsWith(normalized);
      const includes = label.includes(normalized);
      const distance = editDistance(normalized, label);

      const allowedDistance =
        normalized.length >= 8
          ? 2
          : normalized.length >= 5
            ? 1
            : 0;

      let score = 1000;

      if (startsWith) {
        score = 0;
      } else if (includes) {
        score = 10;
      } else if (distance <= allowedDistance) {
        score = 20 + distance;
      }

      return { item, score };
    })
    .filter((entry) => entry.score < 1000)
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.item)
    .slice(0, 8);
}

/*
 * Combines local city suggestions with TomTom results.
 *
 * Local suggestions appear first so city-level searches
 * remain useful even if TomTom returns no result.
 */
function mergeLocationSuggestions(
  apiSuggestions,
  query
) {
  const localSuggestions =
    getLocalCitySuggestions(query);

  const combined = [
    ...localSuggestions,
    ...(apiSuggestions || []),
  ];

  const seen = new Set();

  return combined
    .filter((item) => {
      const label = locationLabel(item)
        .trim()
        .toLowerCase();

      if (!label || seen.has(label)) {
        return false;
      }

      seen.add(label);

      return true;
    })
    .slice(0, 8);
}

function formatConfidence(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  return `${(
    numeric <= 1
      ? numeric * 100
      : numeric
  ).toFixed(1)}%`;
}

function normalizeLevel(level) {
  const value = String(level || "")
    .trim()
    .toLowerCase();

  if (
    value === "critical" ||
    value === "severe"
  ) {
    return "Critical";
  }

  if (value === "high") {
    return "High";
  }

  if (
    value === "medium" ||
    value === "moderate"
  ) {
    return "Medium";
  }

  if (
    value === "low" ||
    value === "free" ||
    value === "free flowing"
  ) {
    return "Low";
  }

  return level
    ? String(level)
    : "Unknown";
}

function congestionClass(level) {
  return normalizeLevel(level)
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function getCongestionDescription(level) {
  switch (
    normalizeLevel(level).toLowerCase()
  ) {
    case "critical":
      return "Severe traffic conditions are expected for the selected horizon.";

    case "high":
      return "Heavy traffic conditions are expected for the selected horizon.";

    case "medium":
      return "Moderate congestion is expected for the selected horizon.";

    case "low":
      return "Traffic is expected to remain relatively free flowing.";

    default:
      return "The prediction service returned a traffic assessment.";
  }
}

function getPredictionSpeed(prediction) {
  return getValue(
    prediction,
    [
      "predicted_speed_kmph",
      "estimated_speed_kmph",
      "predicted_speed",
      "estimated_speed",
      "speed",
    ],
    null
  );
}

function getPredictionLevel(prediction) {
  return getValue(
    prediction,
    [
      "predicted_congestion",
      "predicted_congestion_level",
      "congestion_level",
      "congestionLevel",
      "prediction",
      "level",
    ],
    "Unknown"
  );
}

function getPredictionConfidence(
  prediction
) {
  return getValue(
    prediction,
    [
      "confidence",
      "confidence_score",
      "prediction_confidence",
    ],
    null
  );
}

function getHistoricalCount(report) {
  return getValue(
    report,
    [
      "historical_records",
      "record_count",
      "historical_data_count",
      "training_records",
      "observation_count",
    ],
    null
  );
}

function getModelStatus(report) {
  const status = getValue(
    report,
    [
      "model_status",
      "training_status",
      "status",
      "model_type",
    ],
    null
  );

  if (
    typeof status === "object" &&
    status !== null
  ) {
    return (
      status.status ||
      status.model_type ||
      "Available"
    );
  }

  return status;
}

function extractPeakHours(data) {
  if (!data) {
    return [];
  }

  if (Array.isArray(data)) {
    return data;
  }

  return (
    data?.peak_hours ||
    data?.hours ||
    data?.data ||
    data?.results ||
    []
  );
}

function PeakHoursContent({ data }) {
  const values = extractPeakHours(data);

  if (!values.length) {
    return (
      <div className="empty-state compact">
        <h3>No peak-hour data</h3>
        <p>
          No peak-hour information is currently
          available.
        </p>
      </div>
    );
  }

  return (
    <div className="peak-hours-list">
      {values
        .slice(0, 8)
        .map((item, index) => {
          const value =
            typeof item === "object"
              ? item?.hour ??
                item?.time ??
                item?.start_hour ??
                item?.label ??
                `Peak period ${index + 1}`
              : item;

          const detail =
            typeof item === "object"
              ? item?.congestion ??
                item?.level ??
                item?.vehicle_count ??
                item?.description ??
                ""
              : "";

          return (
            <div
              className="peak-hour-item"
              key={`${String(value)}-${index}`}
            >
              <div>
                <strong>
                  {String(value)}
                </strong>

                {detail !== "" && (
                  <small>
                    {String(detail)}
                  </small>
                )}
              </div>

              <span className="badge medium">
                Peak
              </span>
            </div>
          );
        })}
    </div>
  );
}

export default function Prediction() {
  const [form, setForm] = useState(
    createInitialForm
  );

  const [prediction, setPrediction] =
    useState(null);

  const [history, setHistory] =
    useState(null);

  const [peakHours, setPeakHours] =
    useState(null);

  const [suggestions, setSuggestions] =
    useState([]);

  const [
    suggestionsLoading,
    setSuggestionsLoading,
  ] = useState(false);

  const [
    showSuggestions,
    setShowSuggestions,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const [
    loadingInformation,
    setLoadingInformation,
  ] = useState(true);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const searchTimerRef =
    useRef(null);

  const searchRequestRef =
    useRef(0);

  useEffect(() => {
    let mounted = true;

    async function loadPredictionInformation() {
      setLoadingInformation(true);

      const [
        reportResult,
        peakResult,
      ] = await Promise.allSettled([
        getPredictionReport(),
        getPeakHours(),
      ]);

      if (!mounted) {
        return;
      }

      if (
        reportResult.status ===
        "fulfilled"
      ) {
        setHistory(
          extractData(
            reportResult.value
          )
        );
      }

      if (
        peakResult.status ===
        "fulfilled"
      ) {
        setPeakHours(
          extractData(
            peakResult.value
          )
        );
      }

      setLoadingInformation(false);
    }

    loadPredictionInformation();

    return () => {
      mounted = false;
      clearTimeout(
        searchTimerRef.current
      );
    };
  }, []);

  function handleChange(event) {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        name === "hour" ||
        name === "day_of_week" ||
        name === "prediction_horizon"
          ? Number(value)
          : value,
    }));

    setPrediction(null);
    setError("");
    setMessage("");

    if (name !== "road_name") {
      return;
    }

    clearTimeout(
      searchTimerRef.current
    );

    const query = value.trim();

    if (query.length < 2) {
      searchRequestRef.current += 1;

      setSuggestions([]);
      setSuggestionsLoading(false);
      setShowSuggestions(false);

      return;
    }

    setShowSuggestions(true);
    setSuggestionsLoading(true);

    /*
     * Show local city suggestions immediately.
     * This means "Hyderabad" will not appear empty
     * while TomTom is being queried.
     */
    const localSuggestions =
      getLocalCitySuggestions(query);

    setSuggestions(
      localSuggestions
    );

    const requestId =
      ++searchRequestRef.current;

    searchTimerRef.current =
      setTimeout(async () => {
        try {
          const response =
            await searchRoutes({
              q: query,
            });

          if (
            requestId !==
            searchRequestRef.current
          ) {
            return;
          }

          const apiSuggestions =
            extractSuggestions(
              response
            );

          const combined =
            mergeLocationSuggestions(
              apiSuggestions,
              query
            );

          setSuggestions(
            combined
          );
        } catch (err) {
          console.error(
            "Road search failed:",
            err
          );

          /*
           * Important:
           * Do NOT erase local city suggestions
           * if TomTom fails.
           */
          if (
            requestId ===
            searchRequestRef.current
          ) {
            setSuggestions(
              getLocalCitySuggestions(
                query
              )
            );
          }
        } finally {
          if (
            requestId ===
            searchRequestRef.current
          ) {
            setSuggestionsLoading(
              false
            );
          }
        }
      }, 300);
  }

  function chooseSuggestion(item) {
    const label =
      locationLabel(item);

    setForm((current) => ({
      ...current,
      road_name: label,
    }));

    setSuggestions([]);
    setShowSuggestions(false);
    setSuggestionsLoading(false);
    setPrediction(null);
    setError("");
    setMessage("");
  }

  async function handlePrediction(event) {
    event.preventDefault();

    const roadName =
      form.road_name.trim();

    const vehicleCount =
      Number(form.vehicle_count);

    const currentSpeed =
      Number(
        form.current_speed_kmph
      );

    const freeFlowSpeed =
      Number(
        form.free_flow_speed_kmph
      );

    const horizon =
      Number(
        form.prediction_horizon
      );

    const hour =
      Number(form.hour);

    const dayOfWeek =
      Number(form.day_of_week);

    if (!roadName) {
      setError(
        "Enter a road name."
      );
      return;
    }

    if (
      !Number.isFinite(
        vehicleCount
      ) ||
      vehicleCount <= 0
    ) {
      setError(
        "Enter a valid vehicle count greater than zero."
      );
      return;
    }

    if (
      !Number.isFinite(
        currentSpeed
      ) ||
      currentSpeed <= 0
    ) {
      setError(
        "Enter a valid current speed greater than zero."
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

    if (
      !HORIZONS.includes(
        horizon
      )
    ) {
      setError(
        "Select a valid prediction horizon."
      );
      return;
    }

    if (
      !Number.isInteger(hour) ||
      hour < 0 ||
      hour > 23
    ) {
      setError(
        "Select a valid hour."
      );
      return;
    }

    if (
      !Number.isInteger(
        dayOfWeek
      ) ||
      dayOfWeek < 0 ||
      dayOfWeek > 6
    ) {
      setError(
        "Select a valid day."
      );
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setPrediction(null);
    setShowSuggestions(false);

    try {
      const result =
        await predictTraffic({
          road_name: String(
            roadName
          ),
          prediction_horizon:
            String(horizon),
          vehicle_count:
            String(vehicleCount),
          current_speed_kmph:
            String(currentSpeed),
          free_flow_speed_kmph:
            String(freeFlowSpeed),
          hour: String(hour),
          day_of_week:
            String(dayOfWeek),
        });

      setPrediction(
        extractData(result)
      );

      setMessage(
        "Traffic prediction generated successfully."
      );
    } catch (err) {
      console.error(
        "Prediction failed:",
        err
      );

      const detail =
        err?.response?.data?.detail;

      if (
        Array.isArray(detail)
      ) {
        setError(
          detail
            .map(
              (item) =>
                item?.msg ||
                item?.message
            )
            .filter(Boolean)
            .join(" ")
        );
      } else {
        setError(
          detail ||
            err?.response?.data
              ?.message ||
            err?.userMessage ||
            err?.message ||
            "Unable to generate traffic prediction."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(
      createInitialForm()
    );

    setPrediction(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setError("");
    setMessage("");
  }

  const predictedLevel =
    getPredictionLevel(
      prediction
    );

  const predictedSpeed =
    getPredictionSpeed(
      prediction
    );

  const confidence =
    getPredictionConfidence(
      prediction
    );

  const historicalRecords =
    getHistoricalCount(
      history
    );

  const modelStatus =
    getModelStatus(history);

  return (
    <div className="page-content prediction-page">
      <section className="page-title">
        <div>
          <h1>
            Traffic Prediction
          </h1>

          <p>
            Predict congestion from
            historical traffic data and
            current road conditions.
          </p>
        </div>

        <div className="page-title-actions">
          <div className="prediction-status">
            <span className="status-dot" />
            Prediction service
          </div>
        </div>
      </section>

      {error && (
        <div className="alert alert-error">
          <strong>
            Prediction error.
          </strong>

          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="alert alert-success">
          <strong>
            Success.
          </strong>

          <span>{message}</span>
        </div>
      )}

      <section className="prediction-layout">
        <div className="panel prediction-input-panel">
          <div className="panel-header">
            <div>
              <h3>
                Prediction Inputs
              </h3>

              <p>
                Enter the current
                traffic conditions.
              </p>
            </div>
          </div>

          <form
            onSubmit={
              handlePrediction
            }
            className="prediction-form"
          >
            <div className="form-group prediction-road-field">
              <label htmlFor="road_name">
                Road Name
              </label>

              <div className="prediction-autocomplete">
                <input
                  id="road_name"
                  name="road_name"
                  type="text"
                  value={
                    form.road_name
                  }
                  onChange={
                    handleChange
                  }
                  onFocus={() => {
                    if (
                      form.road_name
                        .trim()
                        .length >= 2
                    ) {
                      setShowSuggestions(
                        true
                      );

                      /*
                       * Recreate local suggestions
                       * when the field receives focus.
                       */
                      const local =
                        getLocalCitySuggestions(
                          form.road_name
                        );

                      if (local.length) {
                        setSuggestions(
                          local
                        );
                      }
                    }
                  }}
                  onBlur={() => {
                    window.setTimeout(
                      () => {
                        setShowSuggestions(
                          false
                        );
                      },
                      180
                    );
                  }}
                  placeholder="e.g. Outer Ring Road"
                  autoComplete="off"
                />

                {showSuggestions && (
                  <div className="route-suggestions prediction-suggestions">
                    {suggestionsLoading &&
                    !suggestions.length ? (
                      <div className="route-suggestion-status">
                        Searching roads...
                      </div>
                    ) : suggestions.length ? (
                      suggestions.map(
                        (
                          item,
                          index
                        ) => (
                          <button
                            type="button"
                            className="route-suggestion"
                            key={`${locationLabel(
                              item
                            )}-${index}`}
                            onMouseDown={(
                              event
                            ) =>
                              event.preventDefault()
                            }
                            onClick={() =>
                              chooseSuggestion(
                                item
                              )
                            }
                          >
                            <strong>
                              {locationLabel(
                                item
                              )}
                            </strong>

                            {item?.source ===
                              "city-fallback" && (
                              <small>
                                City
                              </small>
                            )}
                          </button>
                        )
                      )
                    ) : (
                      <div className="route-suggestion-status">
                        No matching roads found.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="prediction_horizon">
                  Prediction Horizon
                </label>

                <select
                  id="prediction_horizon"
                  name="prediction_horizon"
                  value={
                    form.prediction_horizon
                  }
                  onChange={
                    handleChange
                  }
                >
                  {HORIZONS.map(
                    (minutes) => (
                      <option
                        key={minutes}
                        value={minutes}
                      >
                        {minutes} minutes
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="hour">
                  Hour of Day
                </label>

                <select
                  id="hour"
                  name="hour"
                  value={form.hour}
                  onChange={
                    handleChange
                  }
                >
                  {Array.from(
                    {
                      length: 24,
                    },
                    (_, hour) => (
                      <option
                        key={hour}
                        value={hour}
                      >
                        {String(
                          hour
                        ).padStart(
                          2,
                          "0"
                        )}
                        :00
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="day_of_week">
                Day of Week
              </label>

              <select
                id="day_of_week"
                name="day_of_week"
                value={
                  form.day_of_week
                }
                onChange={
                  handleChange
                }
              >
                {DAYS.map(
                  (
                    day,
                    index
                  ) => (
                    <option
                      key={day}
                      value={index}
                    >
                      {day}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="vehicle_count">
                  Vehicle Count
                </label>

                <input
                  id="vehicle_count"
                  name="vehicle_count"
                  type="number"
                  min="1"
                  step="1"
                  value={
                    form.vehicle_count
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. 850"
                />
              </div>

              <div className="form-group">
                <label htmlFor="current_speed_kmph">
                  Current Speed (km/h)
                </label>

                <input
                  id="current_speed_kmph"
                  name="current_speed_kmph"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={
                    form.current_speed_kmph
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. 32.5"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="free_flow_speed_kmph">
                Free-Flow Speed (km/h)
              </label>

              <input
                id="free_flow_speed_kmph"
                name="free_flow_speed_kmph"
                type="number"
                min="0.1"
                step="0.1"
                value={
                  form.free_flow_speed_kmph
                }
                onChange={
                  handleChange
                }
                placeholder="e.g. 60"
              />
            </div>

            <div className="prediction-form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={
                  resetForm
                }
                disabled={loading}
              >
                Clear
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading
                  ? "Predicting..."
                  : "Predict Traffic"}
              </button>
            </div>
          </form>
        </div>

        <div className="panel prediction-result-panel">
          <div className="panel-header">
            <div>
              <h3>
                Prediction Result
              </h3>

              <p>
                Expected traffic
                condition from the
                submitted conditions.
              </p>
            </div>
          </div>

          {!prediction &&
          !loading ? (
            <div className="prediction-placeholder">
              <div className="prediction-placeholder-icon">
                P
              </div>

              <h3>
                No prediction
                generated
              </h3>

              <p>
                Enter valid traffic
                conditions and select{" "}
                <strong>
                  Predict Traffic
                </strong>
                .
              </p>
            </div>
          ) : loading ? (
            <TrafficLoading
              fullScreen={false}
              title="Analyzing traffic"
              message="IRTMS is processing the current and historical traffic conditions."
            />
          ) : (
            <div className="prediction-result">
              <div
                className={`prediction-level ${congestionClass(
                  predictedLevel
                )}`}
              >
                <span className="prediction-level-label">
                  Predicted
                  Congestion
                </span>

                <strong>
                  {normalizeLevel(
                    predictedLevel
                  )}
                </strong>
              </div>

              <div className="prediction-metrics">
                <div className="prediction-metric">
                  <span>
                    Estimated Speed
                  </span>

                  <strong>
                    {predictedSpeed !==
                      null &&
                    Number.isFinite(
                      Number(
                        predictedSpeed
                      )
                    )
                      ? `${Number(
                          predictedSpeed
                        ).toFixed(
                          1
                        )} km/h`
                      : "—"}
                  </strong>
                </div>

                <div className="prediction-metric">
                  <span>
                    Confidence
                  </span>

                  <strong>
                    {formatConfidence(
                      confidence
                    )}
                  </strong>
                </div>

                <div className="prediction-metric">
                  <span>
                    Prediction Horizon
                  </span>

                  <strong>
                    {
                      form.prediction_horizon
                    }{" "}
                    min
                  </strong>
                </div>

                <div className="prediction-metric">
                  <span>
                    Road
                  </span>

                  <strong>
                    {form.road_name}
                  </strong>
                </div>
              </div>

              <div className="prediction-description">
                <h4>
                  Traffic Assessment
                </h4>

                <p>
                  {getCongestionDescription(
                    predictedLevel
                  )}
                </p>
              </div>

              <div className="prediction-input-summary">
                <h4>
                  Input Conditions
                </h4>

                <div className="input-summary-grid">
                  <div>
                    <span>
                      Vehicle count
                    </span>

                    <strong>
                      {Number(
                        form.vehicle_count
                      ).toLocaleString()}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Current speed
                    </span>

                    <strong>
                      {Number(
                        form.current_speed_kmph
                      ).toFixed(
                        1
                      )}{" "}
                      km/h
                    </strong>
                  </div>

                  <div>
                    <span>
                      Free-flow speed
                    </span>

                    <strong>
                      {Number(
                        form.free_flow_speed_kmph
                      ).toFixed(
                        1
                      )}{" "}
                      km/h
                    </strong>
                  </div>

                  <div>
                    <span>
                      Time
                    </span>

                    <strong>
                      {String(
                        form.hour
                      ).padStart(
                        2,
                        "0"
                      )}
                      :00 ·{" "}
                      {
                        DAYS[
                          Number(
                            form.day_of_week
                          )
                        ]
                      }
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="prediction-information-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>
                Prediction Model
              </h3>

              <p>
                Current model and
                historical data status.
              </p>
            </div>
          </div>

          {loadingInformation ? (
            <TrafficLoading
              fullScreen={false}
              title="Loading model"
              message="Reading prediction model information."
            />
          ) : (
            <div className="model-information">
              <div className="model-information-row">
                <span>
                  Model status
                </span>

                <strong>
                  {modelStatus ||
                    "Available"}
                </strong>
              </div>

              <div className="model-information-row">
                <span>
                  Historical records
                </span>

                <strong>
                  {historicalRecords !==
                  null
                    ? Number(
                        historicalRecords
                      ).toLocaleString()
                    : "—"}
                </strong>
              </div>

              <div className="model-information-row">
                <span>
                  Prediction method
                </span>

                <strong>
                  Historical traffic
                  model
                </strong>
              </div>

              <div className="model-information-row">
                <span>
                  Data basis
                </span>

                <strong>
                  Historical traffic
                  records
                </strong>
              </div>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>
                Peak Traffic Hours
              </h3>

              <p>
                Traffic periods identified
                by the prediction service.
              </p>
            </div>
          </div>

          {loadingInformation ? (
            <TrafficLoading
              fullScreen={false}
              title="Loading peak hours"
              message="Reading historical traffic patterns."
            />
          ) : (
            <PeakHoursContent
              data={peakHours}
            />
          )}
        </div>
      </section>
    </div>
  );
}
