import React, { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

function getCoordinates(point) {
  const latitude = Number(
    point?.latitude ??
      point?.lat ??
      point?.location?.latitude ??
      point?.position?.latitude ??
      point?.position?.lat
  );

  const longitude = Number(
    point?.longitude ??
      point?.lon ??
      point?.lng ??
      point?.location?.longitude ??
      point?.position?.longitude ??
      point?.position?.lon
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }

  return [latitude, longitude];
}

function escapePopupValue(value) {
  return String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCongestion(point) {
  const value =
    point?.congestion_level ??
    point?.congestionLevel ??
    point?.traffic_level ??
    point?.trafficLevel ??
    point?.congestion ??
    point?.status ??
    "Unknown";

  const normalized = String(value)
    .trim()
    .toLowerCase();

  if (normalized === "critical" || normalized === "severe") {
    return "Critical";
  }

  if (normalized === "high") {
    return "High";
  }

  if (
    normalized === "medium" ||
    normalized === "moderate"
  ) {
    return "Medium";
  }

  if (
    normalized === "low" ||
    normalized === "free"
  ) {
    return "Low";
  }

  return "Unknown";
}

function getMarkerColor(congestion) {
  switch (congestion) {
    case "Critical":
      return "#991b1b";
    case "High":
      return "#dc2626";
    case "Medium":
      return "#f59e0b";
    case "Low":
      return "#16a34a";
    default:
      return "#2563eb";
  }
}

function getRoadName(point) {
  return (
    point?.road_name ??
    point?.road ??
    point?.name ??
    point?.location_name ??
    "Unknown Road"
  );
}

function getVehicleCount(point) {
  const value =
    point?.vehicle_count ??
    point?.vehicleCount ??
    point?.vehicles ??
    point?.total_vehicles;

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "—";
  }

  const numeric = Number(value);

  return Number.isFinite(numeric)
    ? numeric.toLocaleString()
    : String(value);
}

function getSpeed(point) {
  const value =
    point?.current_speed_kmph ??
    point?.avg_speed_kmph ??
    point?.average_speed_kmph ??
    point?.current_speed ??
    point?.currentSpeed ??
    point?.avg_speed ??
    point?.speed;

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "—";
  }

  const numeric = Number(value);

  return Number.isFinite(numeric)
    ? `${numeric.toFixed(1)} km/h`
    : String(value);
}

function getFreeFlowSpeed(point) {
  const value =
    point?.free_flow_speed_kmph ??
    point?.free_flow_speed ??
    point?.freeFlowSpeed;

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "—";
  }

  const numeric = Number(value);

  return Number.isFinite(numeric)
    ? `${numeric.toFixed(1)} km/h`
    : String(value);
}

function getTravelTime(point) {
  const minutes =
    point?.travel_time_minutes ??
    point?.travelTimeMinutes;

  if (
    minutes !== undefined &&
    minutes !== null &&
    minutes !== ""
  ) {
    const numeric = Number(minutes);

    if (Number.isFinite(numeric)) {
      return `${numeric.toFixed(1)} min`;
    }
  }

  const seconds =
    point?.travel_time_seconds ??
    point?.travelTimeSeconds;

  if (
    seconds !== undefined &&
    seconds !== null &&
    seconds !== ""
  ) {
    const numeric = Number(seconds);

    if (Number.isFinite(numeric)) {
      if (numeric < 60) {
        return `${Math.round(numeric)} sec`;
      }

      return `${(numeric / 60).toFixed(1)} min`;
    }
  }

  const generic =
    point?.travel_time ??
    point?.travelTime;

  if (
    generic !== undefined &&
    generic !== null &&
    generic !== ""
  ) {
    return String(generic);
  }

  return "—";
}

function createTrafficIcon(L, congestion) {
  const markerColor = getMarkerColor(congestion);

  return L.divIcon({
    className: "traffic-map-marker-wrapper",
    html: `
      <div
        class="traffic-map-marker"
        style="
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${markerColor};
          border: 3px solid #ffffff;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.35);
        "
      ></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -8],
  });
}

function createPopup(point) {
  const roadName = getRoadName(point);
  const congestion = getCongestion(point);
  const vehicles = getVehicleCount(point);
  const speed = getSpeed(point);
  const freeFlowSpeed = getFreeFlowSpeed(point);
  const travelTime = getTravelTime(point);

  const source =
    point?.data_source ??
    point?.dataSource ??
    point?.source ??
    null;

  const recordedAt =
    point?.recorded_at ??
    point?.observation_time ??
    point?.observationTime ??
    point?.timestamp ??
    null;

  return `
    <div class="traffic-map-popup">
      <div class="traffic-map-popup-title">
        ${escapePopupValue(roadName)}
      </div>

      <div class="traffic-map-popup-row">
        <span>Congestion</span>
        <strong>${escapePopupValue(congestion)}</strong>
      </div>

      <div class="traffic-map-popup-row">
        <span>Current Speed</span>
        <strong>${escapePopupValue(speed)}</strong>
      </div>

      <div class="traffic-map-popup-row">
        <span>Free-Flow Speed</span>
        <strong>${escapePopupValue(freeFlowSpeed)}</strong>
      </div>

      <div class="traffic-map-popup-row">
        <span>Vehicles</span>
        <strong>${escapePopupValue(vehicles)}</strong>
      </div>

      <div class="traffic-map-popup-row">
        <span>Travel Time</span>
        <strong>${escapePopupValue(travelTime)}</strong>
      </div>

      ${
        source
          ? `
            <div class="traffic-map-popup-source">
              Source: ${escapePopupValue(source)}
            </div>
          `
          : ""
      }

      ${
        recordedAt
          ? `
            <div class="traffic-map-popup-source">
              Observed: ${escapePopupValue(recordedAt)}
            </div>
          `
          : ""
      }
    </div>
  `;
}

export default function TrafficMap({
  points = [],
  height = 420,
  center = [17.385, 78.4867],
  zoom = 11,
  title = "Live Traffic Map",
  selectedLocation = null,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const loadPromiseRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function initializeMap() {
      if (
        !mapContainerRef.current ||
        mapInstanceRef.current
      ) {
        return;
      }

      try {
        if (!loadPromiseRef.current) {
          loadPromiseRef.current = import("leaflet");
        }

        const module = await loadPromiseRef.current;
        const L = module.default ?? module;

        if (
          !mounted ||
          !mapContainerRef.current ||
          mapInstanceRef.current
        ) {
          return;
        }

        leafletRef.current = L;

        const map = L.map(
          mapContainerRef.current,
          {
            preferCanvas: true,
            zoomControl: true,
            attributionControl: true,
          }
        ).setView(center, zoom);

        L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }
        ).addTo(map);

        mapInstanceRef.current = map;

        requestAnimationFrame(() => {
          if (mounted && mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        });
      } catch (error) {
        console.error(
          "Unable to initialize traffic map:",
          error
        );
      }
    }

    initializeMap();

    return () => {
      mounted = false;

      markersRef.current.forEach((marker) => {
        try {
          marker.remove();
        } catch {
          // Ignore marker cleanup errors.
        }
      });

      markersRef.current = [];

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function updateMap() {
      let L = leafletRef.current;
      let map = mapInstanceRef.current;

      if (!map || !L) {
        try {
          if (!loadPromiseRef.current) {
            loadPromiseRef.current = import("leaflet");
          }

          const module = await loadPromiseRef.current;

          if (cancelled) {
            return;
          }

          L = module.default ?? module;
          map = mapInstanceRef.current;

          if (!map) {
            return;
          }

          leafletRef.current = L;
        } catch (error) {
          console.error(
            "Unable to load Leaflet:",
            error
          );
          return;
        }
      }

      markersRef.current.forEach((marker) => {
        try {
          marker.remove();
        } catch {
          // Ignore marker cleanup errors.
        }
      });

      markersRef.current = [];

      const validPoints = points
        .map((point) => ({
          point,
          coordinates: getCoordinates(point),
        }))
        .filter(
          (item) => item.coordinates !== null
        );

      validPoints.forEach(
        ({ point, coordinates }) => {
          const congestion =
            getCongestion(point);

          const marker = L.marker(
            coordinates,
            {
              icon: createTrafficIcon(
                L,
                congestion
              ),
              title: getRoadName(point),
            }
          ).addTo(map);

          marker.bindPopup(
            createPopup(point),
            {
              maxWidth: 320,
              minWidth: 220,
              closeButton: true,
              autoPan: true,
            }
          );

          markersRef.current.push(marker);
        }
      );

      if (cancelled) {
        return;
      }

      if (validPoints.length === 1) {
        map.setView(
          validPoints[0].coordinates,
          Math.max(zoom, 13),
          {
            animate: false,
          }
        );
      } else if (validPoints.length > 1) {
        const bounds = L.latLngBounds(
          validPoints.map(
            (item) => item.coordinates
          )
        );

        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            padding: [32, 32],
            maxZoom: 14,
            animate: false,
          });
        }
      } else {
        const selectedCoordinates = getCoordinates(selectedLocation);

        map.setView(
          selectedCoordinates || center,
          selectedCoordinates ? Math.max(zoom, 12) : zoom,
          { animate: false }
        );

        if (selectedCoordinates) {
          const selectedMarker = L.marker(
            selectedCoordinates,
            {
              icon: L.divIcon({
                className: "traffic-map-selected-location-wrapper",
                html: '<div class="traffic-map-selected-location"></div>',
                iconSize: [22, 22],
                iconAnchor: [11, 11],
              }),
              title:
                selectedLocation?.name ||
                "Selected monitoring location",
            }
          ).addTo(map);

          selectedMarker.bindPopup(
            '<div class="traffic-map-popup">' +
              '<div class="traffic-map-popup-title">' +
                escapePopupValue(
                  selectedLocation?.name ||
                  "Selected monitoring location"
                ) +
              '</div>' +
              '<div class="traffic-map-popup-row">' +
                '<span>Monitoring scope</span>' +
                '<strong>Selected location</strong>' +
              '</div>' +
              (selectedLocation?.state
                ? '<div class="traffic-map-popup-row">' +
                    '<span>State / UT</span>' +
                    '<strong>' +
                      escapePopupValue(selectedLocation.state) +
                    '</strong>' +
                  '</div>'
                : '') +
              '<div class="traffic-map-popup-source">' +
                'Live traffic observations are not currently available here.' +
              '</div>' +
            '</div>',
            {
              maxWidth: 320,
              minWidth: 220,
              closeButton: true,
              autoPan: true,
            }
          );

          markersRef.current.push(selectedMarker);
        }
      }

      requestAnimationFrame(() => {
        if (!cancelled && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
    }

    updateMap();

    return () => {
      cancelled = true;
    };
  }, [points, center, zoom, selectedLocation]);

  return (
    <div className="traffic-map-card">
      {title && (
        <div className="traffic-map-card-header">
          <h3>{title}</h3>

          <span>
            {points.length} monitoring point
            {points.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      <div
        ref={mapContainerRef}
        className="traffic-map"
        style={{
          height: `${height}px`,
          width: "100%",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      />
    </div>
  );
}