import React, { useEffect, useMemo, useState } from "react";
import { searchRoutes } from "../services/api";
import {
  INDIA_STATES,
  getAreasForState,
  getStateInfo,
  getStoredMonitoringScope,
  storeMonitoringScope,
} from "../data/indiaLocations";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export default function MonitoringScope({
  compact = false,
  className = "",
}) {
  const initial = getStoredMonitoringScope();
  const [state, setState] = useState(initial.state);
  const [area, setArea] = useState(initial.area);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const localSuggestions = useMemo(
    () => getAreasForState(state, area),
    [state, area]
  );

  useEffect(() => {
    const handler = (event) => {
      const next = event.detail || getStoredMonitoringScope();
      setState(next.state || "Telangana");
      setArea(next.area || "Hyderabad");
    };
    window.addEventListener("irtms-monitoring-scope-changed", handler);
    return () =>
      window.removeEventListener("irtms-monitoring-scope-changed", handler);
  }, []);

  const chooseArea = (item) => {
    const info = getStateInfo(state);
    storeMonitoringScope({
      state,
      area: item.name,
      latitude: item.latitude ?? info?.latitude,
      longitude: item.longitude ?? info?.longitude,
    });
    setArea(item.name);
    setSuggestions([]);
  };

  const searchArea = async (value) => {
    setArea(value);
    setSuggestions(getAreasForState(state, value).slice(0, 8));

    if (value.trim().length < 2) return;

    setLoading(true);
    try {
      const response = await searchRoutes({ q: value, state });
      const remote = Array.isArray(response?.results) ? response.results : [];
      const merged = [...remote, ...getAreasForState(state, value)];
      const seen = new Set();
      setSuggestions(
        merged.filter((item) => {
          const key = normalize(item?.name || item?.label || item?.address);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 8)
      );
    } catch {
      // Local state/district/city data remains available.
    } finally {
      setLoading(false);
    }
  };

  const selectState = (nextState) => {
    setState(nextState);
    const info = getStateInfo(nextState);
    chooseArea({
      name: info?.capital || nextState,
      latitude: info?.latitude,
      longitude: info?.longitude,
    });
  };

  return (
    <div className={`monitoring-scope ${compact ? "compact" : ""} ${className}`}>
      <div className="monitoring-scope-title">
        <span className="scope-indicator" />
        <div>
          <strong>Monitoring Scope</strong>
          <small>Select the state and area to monitor</small>
        </div>
      </div>

      <div className="monitoring-scope-controls">
        <label>
          <span>State / UT</span>
          <select value={state} onChange={(event) => selectState(event.target.value)}>
            {INDIA_STATES.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="scope-area-field">
          <span>Area / City / District</span>
          <div className="scope-input-wrap">
            <input
              value={area}
              onChange={(event) => searchArea(event.target.value)}
              onFocus={() => setSuggestions(localSuggestions.slice(0, 8))}
              placeholder="Search any place in the selected state"
              autoComplete="off"
            />
            {loading && <span className="scope-spinner" />}
          </div>

          {suggestions.length > 0 && (
            <div className="monitoring-suggestions">
              {suggestions.map((item, index) => (
                <button
                  key={`${item?.name || item?.label}-${index}`}
                  type="button"
                  onClick={() => chooseArea(item)}
                >
                  <strong>
                    {item?.name || item?.label || item?.address || "Location"}
                  </strong>
                  <span>
                    {item?.state || state}
                    {item?.type ? ` · ${item.type}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </label>
      </div>
    </div>
  );
}
