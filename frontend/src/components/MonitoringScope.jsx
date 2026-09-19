import React, { useEffect, useMemo, useRef, useState } from "react";
import { searchRoutes } from "../services/api";
import {
  INDIA_STATES,
  getAreasForState,
  getStateInfo,
  getStoredMonitoringScope,
  storeMonitoringScope,
} from "../data/indiaLocations";

export default function MonitoringScope({
  compact = false,
  className = "",
}) {
  const initial = getStoredMonitoringScope();
  const [state, setState] = useState(initial.state);
  const [area, setArea] = useState(initial.area);
  const initialResolutionAttempted = useRef(false);

  const localSuggestions = useMemo(
    () =>
      getAreasForState(state, "").filter((item) =>
        ["Capital", "City / Town"].includes(item?.type)
      ),
    [state]
  );

  useEffect(() => {
    const handler = (event) => {
      const next = event.detail || getStoredMonitoringScope();
      setState(next.state || "Telangana");
      setArea(next.area || "Hyderabad");
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

  const chooseArea = async (item) => {
    const info = getStateInfo(state);

    let latitude = item?.latitude;
    let longitude = item?.longitude;

    if (
      !Number.isFinite(Number(latitude)) ||
      !Number.isFinite(Number(longitude))
    ) {
      try {
        const response = await searchRoutes({
          q: item?.name || item?.label || "",
          state,
        });

        const remote = Array.isArray(response?.results)
          ? response.results
          : [];

        const match = remote.find(
          (result) =>
            Number.isFinite(Number(result?.latitude)) &&
            Number.isFinite(Number(result?.longitude))
        );

        if (match) {
          latitude = Number(match.latitude);
          longitude = Number(match.longitude);
        }
      } catch {
        // State-capital coordinates remain the final fallback.
      }
    }

    storeMonitoringScope({
      state,
      area: item?.name || item?.label || state,
      latitude:
        Number.isFinite(Number(latitude))
          ? Number(latitude)
          : info?.latitude,
      longitude:
        Number.isFinite(Number(longitude))
          ? Number(longitude)
          : info?.longitude,
    });

    setArea(item?.name || item?.label || state);
  };

  useEffect(() => {
    if (
      initialResolutionAttempted.current ||
      initial?.coordinatesResolved !== false
    ) {
      return;
    }

    const selected = localSuggestions.find(
      (item) =>
        item?.name === initial.area &&
        ["Capital", "City / Town"].includes(item?.type)
    );

    if (!selected) {
      initialResolutionAttempted.current = true;
      return;
    }

    initialResolutionAttempted.current = true;
    chooseArea(selected);
  }, [initial, localSuggestions]);

  const selectState = (nextState) => {
    const info = getStateInfo(nextState);
    const nextArea = info?.capital || nextState;

    storeMonitoringScope({
      state: nextState,
      area: nextArea,
      latitude: info?.latitude,
      longitude: info?.longitude,
    });

    setState(nextState);
    setArea(nextArea);
  };

  return (
    <div
      className={`monitoring-scope ${compact ? "compact" : ""} ${className}`}
    >
      <div className="monitoring-scope-title">
        <span className="scope-indicator" />
        <div>
          <strong>Monitoring Scope</strong>
          <small>
            Select the state and city or town to monitor
          </small>
        </div>
      </div>

      <div className="monitoring-scope-controls">
        <label>
          <span>State / UT</span>
          <select
            value={state}
            onChange={(event) =>
              selectState(event.target.value)
            }
          >
            {INDIA_STATES.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="scope-area-field">
          <span>City / Town</span>
          <select
            value={area}
            onChange={(event) => {
              const selected = localSuggestions.find(
                (item) =>
                  item?.name === event.target.value
              );

              if (selected) {
                chooseArea(selected);
              }
            }}
          >
            {localSuggestions.map((item) => (
              <option
                key={`${item?.type}-${item?.name}`}
                value={item?.name}
              >
                {item?.name}
                {item?.type === "Capital"
                  ? " (Capital)"
                  : ""}
              </option>
            ))}
          </select>

          <small
            style={{
              display: "block",
              marginTop: "5px",
              color: "#6f96b4",
              fontSize: "9px",
              lineHeight: 1.3,
            }}
          >
            {localSuggestions.length} cities and towns
            available in {state}
          </small>
        </label>
      </div>

      <small className="scope-attribution">
        The dropdown uses the local India city/town catalog.
        Coordinates are used to request live traffic for the
        selected monitoring point; OpenStreetMap / Photon remains
        available for route-location search.
      </small>
    </div>
  );
}
