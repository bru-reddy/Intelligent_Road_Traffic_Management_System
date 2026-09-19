import React, { useEffect, useRef, useState } from "react";
import {
  searchRoutes,
  recommendRoute,
} from "../services/api";
import "leaflet/dist/leaflet.css";
import TrafficLoading from "../components/TrafficLoading.jsx";
import { getStoredMonitoringScope, searchIndiaLocations } from "../data/indiaLocations";

function extractData(response) {
  return response?.data ?? response;
}

function extractSuggestions(response) {
  const data = extractData(response);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.suggestions)) return data.suggestions;
  if (Array.isArray(data?.locations)) return data.locations;

  return [];
}

function extractRoutes(response) {
  const data = extractData(response);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.routes)) return data.routes;
  if (Array.isArray(data?.alternatives)) return data.alternatives;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function routeName(route, index) {
  return (
    route?.name ||
    route?.route_name ||
    route?.summary?.name ||
    route?.description ||
    `Route ${index + 1}`
  );
}

async function calculateBrowserRoutingFallback(
  sourceLat,
  sourceLon,
  destinationLat,
  destinationLon
) {
  const coordinates =
    `${sourceLon},${sourceLat};${destinationLon},${destinationLat}`;

  const url =
    `https://router.project-osrm.org/route/v1/driving/${coordinates}` +
    "?overview=full&geometries=geojson&alternatives=true&steps=false";

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Fallback routing service returned HTTP ${response.status}.`
    );
  }

  const data = await response.json();

  if (data?.code !== "Ok" || !Array.isArray(data?.routes)) {
    return [];
  }

  return data.routes.map((route, index) => {
    const distanceKm =
      Number(route?.distance || 0) / 1000;

    const durationMinutes =
      Number(route?.duration || 0) / 60;

    const geometry =
      route?.geometry?.coordinates
        ?.map((point) => {
          if (!Array.isArray(point) || point.length < 2) {
            return null;
          }

          const longitude = Number(point[0]);
          const latitude = Number(point[1]);

          if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
          ) {
            return null;
          }

          return [latitude, longitude];
        })
        .filter(Boolean) || [];

    return {
      name:
        index === 0
          ? "Best Route"
          : `Alternative Route ${index}`,
      distance_km: Number(distanceKm.toFixed(2)),
      estimated_time_minutes:
        Number(durationMinutes.toFixed(1)),
      traffic_delay_minutes: 0,
      base_time_minutes:
        Number(durationMinutes.toFixed(1)),
      traffic_level: "unknown",
      traffic_delay_seconds: 0,
      geometry,
      fallback_provider: "OpenStreetMap routing",
    };
  });
}

function getDistance(route) {
  const value =
    route?.distance_km ??
    route?.distance ??
    route?.summary?.distance_km ??
    route?.summary?.distance;

  if (value === undefined || value === null || value === "") {
    return "—";
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  if (numeric >= 1000) {
    return `${(numeric / 1000).toFixed(1)} km`;
  }

  return `${numeric.toFixed(1)} km`;
}

function getDurationMinutes(route) {
  const minutes =
    route?.duration_minutes ??
    route?.travel_time_minutes ??
    route?.travelTimeMinutes ??
    route?.estimated_time_minutes ??
    route?.summary?.duration_minutes ??
    route?.summary?.travel_time_minutes ??
    route?.summary?.estimated_time_minutes;

  if (minutes !== undefined && minutes !== null && minutes !== "") {
    const numeric = Number(minutes);
    return Number.isFinite(numeric) ? numeric : null;
  }

  // Common routing APIs return duration in seconds.
  const seconds =
    route?.duration_seconds ??
    route?.travel_time_seconds ??
    route?.travelTimeSeconds ??
    route?.summary?.duration_seconds ??
    route?.summary?.travel_time_seconds;

  if (seconds !== undefined && seconds !== null && seconds !== "") {
    const numeric = Number(seconds);
    return Number.isFinite(numeric) ? numeric / 60 : null;
  }

  // Support nested route/leg responses.
  const nestedDuration =
    route?.route?.duration_minutes ??
    route?.route?.travel_time_minutes ??
    route?.route?.duration_seconds ??
    route?.route?.legs?.[0]?.duration_minutes ??
    route?.route?.legs?.[0]?.duration_seconds ??
    route?.legs?.[0]?.duration_minutes ??
    route?.legs?.[0]?.duration_seconds;

  if (
    nestedDuration !== undefined &&
    nestedDuration !== null &&
    nestedDuration !== ""
  ) {
    const numeric = Number(nestedDuration);

    if (!Number.isFinite(numeric)) {
      return null;
    }

    const isSeconds =
      String(nestedDuration).toLowerCase().includes("second") ||
      route?.route?.duration_seconds !== undefined ||
      route?.route?.legs?.[0]?.duration_seconds !== undefined ||
      route?.legs?.[0]?.duration_seconds !== undefined;

    return isSeconds ? numeric / 60 : numeric;
  }

  return null;
}

function getDuration(route) {
  const numeric = getDurationMinutes(route);

  if (numeric === null) {
    return "—";
  }

  if (numeric < 1) {
    return `${Math.round(numeric * 60)} sec`;
  }

  if (numeric >= 60) {
    const hours = Math.floor(numeric / 60);
    const minutes = Math.round(numeric % 60);

    return minutes
      ? `${hours} hr ${minutes} min`
      : `${hours} hr`;
  }

  return `${Math.round(numeric)} min`;
}

function getCongestion(route) {
  const value =
    route?.traffic_level ??
    route?.congestion_level ??
    route?.congestion ??
    route?.traffic ??
    "Unknown";

  const normalized = String(value)
    .trim()
    .toLowerCase();

  if (
    normalized === "critical" ||
    normalized === "severe"
  ) {
    return "Critical";
  }

  if (
    normalized === "moderate" ||
    normalized === "medium"
  ) {
    return "Medium";
  }

  if (normalized === "free" || normalized === "low") {
    return "Low";
  }

  if (normalized === "high") {
    return "High";
  }

  return String(value);
}

function getSpeed(route) {
  const value =
    route?.avg_speed_kmph ??
    route?.average_speed_kmph ??
    route?.speed_kmph ??
    route?.current_speed_kmph ??
    route?.average_speed ??
    route?.speed ??
    route?.summary?.avg_speed_kmph ??
    route?.summary?.average_speed_kmph;

  if (value !== undefined && value !== null && value !== "") {
    const numeric = Number(value);

    if (Number.isFinite(numeric)) {
      return `${numeric.toFixed(1)} km/h`;
    }

    return String(value);
  }

  // If the API gives distance + travel time, calculate the average speed.
  const distance =
    route?.distance_km ??
    route?.distance ??
    route?.summary?.distance_km ??
    route?.summary?.distance;

  const durationMinutes = getDurationMinutes(route);

  if (
    distance !== undefined &&
    distance !== null &&
    Number.isFinite(Number(distance)) &&
    durationMinutes !== null &&
    durationMinutes > 0
  ) {
    const calculatedSpeed =
      Number(distance) / (durationMinutes / 60);

    return `${calculatedSpeed.toFixed(1)} km/h`;
  }

  return "—";
}

function getRecommendationScore(route) {
  const value =
    route?.recommendation_score ??
    route?.score ??
    route?.traffic_score;

  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function badgeClass(value) {
  return String(value || "unknown")
    .toLowerCase()
    .replace(/\s+/g, "-");
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

function getRouteGeometry(route) {
  return (
    route?.geometry ||
    route?.route_geometry ||
    route?.polyline ||
    route?.route?.geometry ||
    route?.route?.legs?.[0]?.points ||
    null
  );
}

function normalizeCoordinate(value) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value) && value.length >= 2) {
    const first = Number(value[0]);
    const second = Number(value[1]);

    if (
      !Number.isFinite(first) ||
      !Number.isFinite(second)
    ) {
      return null;
    }

    if (
      Math.abs(first) <= 90 &&
      Math.abs(second) <= 180
    ) {
      return [first, second];
    }

    if (
      Math.abs(second) <= 90 &&
      Math.abs(first) <= 180
    ) {
      return [second, first];
    }

    return null;
  }

  if (typeof value === "object") {
    const latitude = Number(
      value.latitude ??
        value.lat ??
        value.position?.lat
    );

    const longitude = Number(
      value.longitude ??
        value.lng ??
        value.lon ??
        value.position?.lon
    );

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      return [latitude, longitude];
    }
  }

  return null;
}

function extractGeometryCoordinates(geometry) {
  if (!geometry) {
    return [];
  }

  let value = geometry;

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (
    value?.type === "FeatureCollection" &&
    Array.isArray(value.features)
  ) {
    return value.features.flatMap((feature) =>
      extractGeometryCoordinates(feature)
    );
  }

  if (value?.type === "Feature") {
    return extractGeometryCoordinates(
      value.geometry
    );
  }

  if (value?.type === "LineString") {
    return extractGeometryCoordinates(
      value.coordinates
    );
  }

  if (value?.type === "MultiLineString") {
    return (value.coordinates || []).flatMap(
      (line) => extractGeometryCoordinates(line)
    );
  }

  if (Array.isArray(value)) {
    if (
      value.length >= 2 &&
      typeof value[0] === "number"
    ) {
      const coordinate = normalizeCoordinate(value);

      return coordinate ? [coordinate] : [];
    }

    return value.flatMap((item) =>
      extractGeometryCoordinates(item)
    );
  }

  if (value?.points) {
    return extractGeometryCoordinates(value.points);
  }

  if (value?.coordinates) {
    return extractGeometryCoordinates(
      value.coordinates
    );
  }

  return [];
}

function getRouteColor(route, selected) {
  if (selected) {
    return "#1d4ed8";
  }

  const congestion = getCongestion(route)
    .toLowerCase();

  if (congestion === "critical") {
    return "#991b1b";
  }

  if (congestion === "high") {
    return "#dc2626";
  }

  if (congestion === "medium") {
    return "#f59e0b";
  }

  if (congestion === "low") {
    return "#16a34a";
  }

  return "#64748b";
}

export default function RoutePlanner() {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");

  const [sourceLocation, setSourceLocation] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(null);

  const [sourceSuggestions, setSourceSuggestions] =
    useState([]);

  const [
    destinationSuggestions,
    setDestinationSuggestions,
  ] = useState([]);

  const [activeField, setActiveField] =
    useState(null);

  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] =
    useState(null);

  const [searchingSource, setSearchingSource] =
    useState(false);

  const [
    searchingDestination,
    setSearchingDestination,
  ] = useState(false);

  const [calculating, setCalculating] =
    useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const sourceTimerRef = useRef(null);
  const destinationTimerRef = useRef(null);

// Common city-level fallback coordinates. These are used only when
// the location-search endpoint has no road suggestion for a city name.
// Selecting a suggestion from the API still takes priority.
const CITY_COORDINATES = {
  hyderabad: [17.385, 78.4867],
  pune: [18.5204, 73.8567],
  mumbai: [19.076, 72.8777],
  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  chennai: [13.0827, 80.2707],
  delhi: [28.6139, 77.209],
  "new delhi": [28.6139, 77.209],
  kolkata: [22.5726, 88.3639],
  ahmedabad: [23.0225, 72.5714],
  jaipur: [26.9124, 75.7873],
  surat: [21.1702, 72.8311],
  nagpur: [21.1458, 79.0882],
  indore: [22.7196, 75.8577],
  kochi: [9.9312, 76.2673],
  visakhapatnam: [17.6868, 83.2185],
  vijayawada: [16.5062, 80.648],
};

const CITY_SUGGESTIONS = [
  { name: "Hyderabad", label: "Hyderabad, Telangana", latitude: 17.385, longitude: 78.4867 },
  { name: "Pune", label: "Pune, Maharashtra", latitude: 18.5204, longitude: 73.8567 },
  { name: "Mumbai", label: "Mumbai, Maharashtra", latitude: 19.076, longitude: 72.8777 },
  { name: "Bengaluru", label: "Bengaluru, Karnataka", latitude: 12.9716, longitude: 77.5946 },
  { name: "Chennai", label: "Chennai, Tamil Nadu", latitude: 13.0827, longitude: 80.2707 },
  { name: "Delhi", label: "Delhi, India", latitude: 28.6139, longitude: 77.209 },
  { name: "New Delhi", label: "New Delhi, India", latitude: 28.6139, longitude: 77.209 },
  { name: "Kolkata", label: "Kolkata, West Bengal", latitude: 22.5726, longitude: 88.3639 },
  { name: "Ahmedabad", label: "Ahmedabad, Gujarat", latitude: 23.0225, longitude: 72.5714 },
  { name: "Jaipur", label: "Jaipur, Rajasthan", latitude: 26.9124, longitude: 75.7873 },
  { name: "Surat", label: "Surat, Gujarat", latitude: 21.1702, longitude: 72.8311 },
  { name: "Nagpur", label: "Nagpur, Maharashtra", latitude: 21.1458, longitude: 79.0882 },
  { name: "Indore", label: "Indore, Madhya Pradesh", latitude: 22.7196, longitude: 75.8577 },
  { name: "Kochi", label: "Kochi, Kerala", latitude: 9.9312, longitude: 76.2673 },
  { name: "Visakhapatnam", label: "Visakhapatnam, Andhra Pradesh", latitude: 17.6868, longitude: 83.2185 },
  { name: "Vijayawada", label: "Vijayawada, Andhra Pradesh", latitude: 16.5062, longitude: 80.648 },
];

const HYDERABAD_ROAD_SUGGESTIONS = [
  { name: "Hayathnagar", label: "Hayathnagar, Hyderabad", latitude: 17.3281, longitude: 78.6045 },
  { name: "Uppal", label: "Uppal, Hyderabad", latitude: 17.4058, longitude: 78.5591 },
  { name: "LB Nagar", label: "LB Nagar, Hyderabad", latitude: 17.3457, longitude: 78.5522 },
  { name: "Gachibowli", label: "Gachibowli, Hyderabad", latitude: 17.4401, longitude: 78.3489 },
  { name: "Hitech City", label: "Hitech City, Hyderabad", latitude: 17.4435, longitude: 78.3772 },
  { name: "Madhapur", label: "Madhapur, Hyderabad", latitude: 17.4483, longitude: 78.3915 },
  { name: "Kukatpally", label: "Kukatpally, Hyderabad", latitude: 17.4849, longitude: 78.4138 },
  { name: "Mehdipatnam", label: "Mehdipatnam, Hyderabad", latitude: 17.3930, longitude: 78.4397 },
  { name: "Secunderabad", label: "Secunderabad, Hyderabad", latitude: 17.4399, longitude: 78.4983 },
  { name: "Banjara Hills", label: "Banjara Hills, Hyderabad", latitude: 17.4156, longitude: 78.4347 },
  { name: "Begumpet", label: "Begumpet, Hyderabad", latitude: 17.4431, longitude: 78.4639 },
  { name: "Outer Ring Road", label: "Outer Ring Road, Hyderabad", latitude: 17.3850, longitude: 78.4867 },
  { name: "NH 65", label: "NH 65, Hyderabad", latitude: 17.3281, longitude: 78.6045 },
  { name: "NH 163", label: "NH 163, Hyderabad", latitude: 17.4500, longitude: 78.5800 },
  { name: "Gachibowli Main Road", label: "Gachibowli Main Road, Hyderabad", latitude: 17.4401, longitude: 78.3489 },
  { name: "Hitech City Road", label: "Hitech City Road, Hyderabad", latitude: 17.4435, longitude: 78.3772 },
  { name: "LB Nagar Junction", label: "LB Nagar Junction, Hyderabad", latitude: 17.3527, longitude: 78.5510 },
  { name: "Madhapur Road", label: "Madhapur Road, Hyderabad", latitude: 17.4483, longitude: 78.3915 },
  { name: "Mehdipatnam-Tolichowki Road", label: "Mehdipatnam-Tolichowki Road, Hyderabad", latitude: 17.3930, longitude: 78.4397 },
  { name: "S.D. Road", label: "S.D. Road, Secunderabad", latitude: 17.4399, longitude: 78.4983 },
];

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

  if (normalized.length < 2) return [];

  const scope = getStoredMonitoringScope();

  const indiaMatches = searchIndiaLocations(
    query,
    scope?.state || ""
  ).map((item) => ({
    ...item,
    label: item.label || `${item.name}, ${item.state || ""}`,
  }));

  const globalMatches = searchIndiaLocations(query, "")
    .slice(0, 20);

  const candidates = [
    ...indiaMatches,
    ...globalMatches,
    ...CITY_SUGGESTIONS,
    ...HYDERABAD_ROAD_SUGGESTIONS,
  ];

  const seen = new Set();

  return candidates
    .map((item) => {
      const label = normalizeSearchText(
        locationLabel(item)
      );
      const startsWith = label.startsWith(normalized);
      const includes = label.includes(normalized);
      const distance = editDistance(normalized, label);

      const allowedDistance =
        normalized.length >= 8 ? 2 :
        normalized.length >= 5 ? 1 : 0;

      let score = 1000;
      if (startsWith) score = 0;
      else if (includes) score = 10;
      else if (distance <= allowedDistance) score = 20 + distance;

      return { item, score };
    })
    .filter((entry) => {
      const key = normalizeSearchText(
        locationLabel(entry.item)
      );

      if (entry.score >= 1000 || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.item)
    .slice(0, 8);
}

function mergeLocationSuggestions(apiSuggestions, query) {
  const localSuggestions = getLocalCitySuggestions(query);
  const combined = [...localSuggestions, ...(apiSuggestions || [])];
  const seen = new Set();

  return combined.filter((item) => {
    const label = locationLabel(item).trim().toLowerCase();

    if (!label || seen.has(label)) return false;

    seen.add(label);
    return true;
  }).slice(0, 6);
}

function getLocationCoordinates(location) {
  if (!location || typeof location !== "object") {
    return null;
  }

  const directLatitude = Number(
    location.latitude ??
      location.lat ??
      location.position?.latitude ??
      location.position?.lat ??
      location.coordinates?.latitude ??
      location.coordinates?.lat
  );

  const directLongitude = Number(
    location.longitude ??
      location.lng ??
      location.lon ??
      location.position?.longitude ??
      location.position?.lon ??
      location.coordinates?.longitude ??
      location.coordinates?.lng ??
      location.coordinates?.lon
  );

  if (
    Number.isFinite(directLatitude) &&
    Number.isFinite(directLongitude) &&
    directLatitude >= -90 &&
    directLatitude <= 90 &&
    directLongitude >= -180 &&
    directLongitude <= 180
  ) {
    return [directLatitude, directLongitude];
  }

  const coordinateArray =
    Array.isArray(location.coordinates)
      ? location.coordinates
      : null;

  if (coordinateArray?.length >= 2) {
    const first = Number(coordinateArray[0]);
    const second = Number(coordinateArray[1]);

    if (
      Number.isFinite(first) &&
      Number.isFinite(second)
    ) {
      if (
        Math.abs(first) <= 90 &&
        Math.abs(second) <= 180
      ) {
        return [first, second];
      }

      if (
        Math.abs(second) <= 90 &&
        Math.abs(first) <= 180
      ) {
        return [second, first];
      }
    }
  }

  const nested =
    location.geometry?.coordinates ??
    location.geometry?.position ??
    location.location;

  if (nested && nested !== location) {
    return getLocationCoordinates(
      Array.isArray(nested)
        ? { coordinates: nested }
        : nested
    );
  }

  return null;
}

function getCityFallback(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  const coordinates = CITY_COORDINATES[key];

  if (!coordinates) {
    return null;
  }

  return {
    name: String(value).trim(),
    label: String(value).trim(),
    latitude: coordinates[0],
    longitude: coordinates[1],
    source: "city-fallback",
  };
}

function resolveLocation(value, selectedLocation) {
  const selectedCoordinates =
    getLocationCoordinates(selectedLocation);

  if (selectedCoordinates) {
    return {
      location: selectedLocation,
      coordinates: selectedCoordinates,
    };
  }

  const fallback = getCityFallback(value);

  if (fallback) {
    return {
      location: fallback,
      coordinates: [
        fallback.latitude,
        fallback.longitude,
      ],
    };
  }

  return null;
}


  async function resolveLocationWithSearch(
    value,
    selectedLocation
  ) {
    const direct = resolveLocation(
      value,
      selectedLocation
    );

    if (direct) {
      return direct;
    }

    try {
      const scope = getStoredMonitoringScope();
      const response = await searchRoutes({
        q: value,
        state: scope?.state,
      });

      const suggestions =
        extractSuggestions(response);

      for (const item of suggestions) {
        const coordinates =
          getLocationCoordinates(item);

        if (coordinates) {
          return {
            location: item,
            coordinates,
          };
        }
      }
    } catch {
      // The caller will display the normal unresolved-location message.
    }

    return null;
  }

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const routeLayersRef = useRef([]);

  useEffect(() => {
    return () => {
      clearTimeout(sourceTimerRef.current);
      clearTimeout(destinationTimerRef.current);

      routeLayersRef.current.forEach((layer) => {
        try {
          layer.remove();
        } catch {
          // Ignore cleanup errors.
        }
      });

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      if (
        mapRef.current ||
        !mapContainerRef.current
      ) {
        return;
      }

      try {
        const module = await import("leaflet");

        if (cancelled || !mapContainerRef.current) {
          return;
        }

        const L = module.default ?? module;

        leafletRef.current = L;

        const map = L.map(
          mapContainerRef.current,
          {
            preferCanvas: true,
            zoomControl: true,
          }
        ).setView(
          [17.385, 78.4867],
          11
        );

        L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }
        ).addTo(map);

        mapRef.current = map;

        requestAnimationFrame(() => {
          map.invalidateSize();
        });
      } catch (err) {
        console.error(
          "Unable to initialize route map:",
          err
        );
      }
    }

    initializeMap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function drawRoutes() {
      if (!mapRef.current) {
        return;
      }

      let L = leafletRef.current;

      if (!L) {
        const module = await import("leaflet");

        if (cancelled) {
          return;
        }

        L = module.default ?? module;
        leafletRef.current = L;
      }

      const map = mapRef.current;

      routeLayersRef.current.forEach((layer) => {
        try {
          layer.remove();
        } catch {
          // Ignore layer cleanup errors.
        }
      });

      routeLayersRef.current = [];

      if (!selectedRoute) {
        map.setView(
          [17.385, 78.4867],
          11,
          { animate: false }
        );

        return;
      }

      const geometry = getRouteGeometry(
        selectedRoute
      );

      const coordinates =
        extractGeometryCoordinates(geometry);

      if (coordinates.length < 2) {
        map.setView(
          [17.385, 78.4867],
          11,
          { animate: false }
        );

        requestAnimationFrame(() =>
          map.invalidateSize()
        );

        return;
      }

      const routeIndex = Math.max(
        routes.indexOf(selectedRoute),
        0
      );

      const line = L.polyline(coordinates, {
        color: getRouteColor(
          selectedRoute,
          true
        ),
        weight: 6,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      routeLayersRef.current.push(line);

      const start = coordinates[0];
      const end =
        coordinates[coordinates.length - 1];

      const startIcon = L.divIcon({
        className: "route-map-marker-wrapper",
        html: `
          <div class="route-map-marker route-map-marker-start">
            A
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const endIcon = L.divIcon({
        className: "route-map-marker-wrapper",
        html: `
          <div class="route-map-marker route-map-marker-end">
            B
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const startMarker = L.marker(start, {
        icon: startIcon,
      })
        .addTo(map)
        .bindPopup(
          `<strong>Starting Location</strong><br />${source || "Origin"}`
        );

      const endMarker = L.marker(end, {
        icon: endIcon,
      })
        .addTo(map)
        .bindPopup(
          `<strong>Destination</strong><br />${destination || "Destination"}`
        );

      routeLayersRef.current.push(
        startMarker,
        endMarker
      );

      const bounds = L.latLngBounds(coordinates);

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [40, 40],
          maxZoom: 15,
          animate: false,
        });
      }

      requestAnimationFrame(() =>
        map.invalidateSize()
      );

      console.debug(
        `Displayed route ${routeIndex + 1}`
      );
    }

    drawRoutes();

    return () => {
      cancelled = true;
    };
  }, [selectedRoute, routes, source, destination]);

  async function searchLocation(value, field) {
    const query = value.trim();

    if (query.length < 2) {
      if (field === "source") {
        setSourceSuggestions([]);
      } else {
        setDestinationSuggestions([]);
      }

      return;
    }

    try {
      if (field === "source") {
        setSearchingSource(true);
      } else {
        setSearchingDestination(true);
      }

      const scope = getStoredMonitoringScope();

      const response = await searchRoutes({
        q: query,
        state: scope?.state,
      });

      const apiSuggestions =
        extractSuggestions(response);

      const suggestions = mergeLocationSuggestions(
        apiSuggestions,
        query
      );

      if (field === "source") {
        setSourceSuggestions(suggestions);
      } else {
        setDestinationSuggestions(suggestions);
      }
    } catch (err) {
      console.error(
        "Location search failed:",
        err
      );

      const fallbackSuggestions =
        getLocalCitySuggestions(query);

      if (field === "source") {
        setSourceSuggestions(fallbackSuggestions);
      } else {
        setDestinationSuggestions(fallbackSuggestions);
      }
    } finally {
      if (field === "source") {
        setSearchingSource(false);
      } else {
        setSearchingDestination(false);
      }
    }
  }

  function handleLocationChange(value, field) {
    if (field === "source") {
      setSource(value);
      setSourceLocation(null);

      clearTimeout(sourceTimerRef.current);

      sourceTimerRef.current = setTimeout(() => {
        searchLocation(value, "source");
      }, 350);
    } else {
      setDestination(value);
      setDestinationLocation(null);

      clearTimeout(
        destinationTimerRef.current
      );

      destinationTimerRef.current = setTimeout(() => {
        searchLocation(
          value,
          "destination"
        );
      }, 350);
    }

    setRoutes([]);
    setSelectedRoute(null);
    setError("");
    setMessage("");
  }

  function chooseSuggestion(item, field) {
    const label = locationLabel(item);

    if (field === "source") {
      setSource(label);
      setSourceLocation(item);
      setSourceSuggestions([]);
    } else {
      setDestination(label);
      setDestinationLocation(item);
      setDestinationSuggestions([]);
    }

    setActiveField(null);
    setError("");
  }

  async function calculateRoutes(event) {
    event.preventDefault();

    const sourceValue = source.trim();
    const destinationValue =
      destination.trim();

    if (!sourceValue || !destinationValue) {
      setError(
        "Please enter both a source and destination."
      );
      return;
    }

    if (
      sourceValue.toLowerCase() ===
      destinationValue.toLowerCase()
    ) {
      setError(
        "Source and destination must be different locations."
      );
      return;
    }

    const resolvedSource =
      await resolveLocationWithSearch(
        sourceValue,
        sourceLocation
      );

    const resolvedDestination =
      await resolveLocationWithSearch(
        destinationValue,
        destinationLocation
      );

    if (!resolvedSource) {
      setError(
        "We could not resolve the starting location. Select a suggestion or enter a supported city name."
      );
      return;
    }

    if (!resolvedDestination) {
      setError(
        "We could not resolve the destination. Select a suggestion or enter a supported city name."
      );
      return;
    }

    const [sourceLat, sourceLon] =
      resolvedSource.coordinates;

    const [destinationLat, destinationLon] =
      resolvedDestination.coordinates;

    setCalculating(true);
    setError("");
    setMessage("");
    setRoutes([]);
    setSelectedRoute(null);

    setSourceSuggestions([]);
    setDestinationSuggestions([]);
    setActiveField(null);

    try {
      const response = await recommendRoute({
        source: sourceValue,
        destination: destinationValue,
        source_latitude: sourceLat,
        source_longitude: sourceLon,
        destination_latitude: destinationLat,
        destination_longitude: destinationLon,
        max_alternatives: 2,
      });

      const data = extractData(response);
      let calculatedRoutes =
        extractRoutes(response);

      if (calculatedRoutes.length === 0) {
        try {
          calculatedRoutes =
            await calculateBrowserRoutingFallback(
              sourceLat,
              sourceLon,
              destinationLat,
              destinationLon
            );
        } catch (fallbackError) {
          console.warn(
            "Browser routing fallback failed:",
            fallbackError
          );
        }
      }

      setRoutes(calculatedRoutes);

      if (calculatedRoutes.length > 0) {
        setSelectedRoute(
          calculatedRoutes[0]
        );

        const usingFallback =
          calculatedRoutes[0]?.fallback_provider;

        setMessage(
          `${calculatedRoutes.length} route option${
            calculatedRoutes.length === 1
              ? ""
              : "s"
          } found${
            usingFallback
              ? " using the fallback road network because live TomTom routing was unavailable."
              : "."
          }`
        );
      } else {
        setMessage(
          data?.message ||
            "No route could be calculated for the selected locations."
        );
      }
    } catch (err) {
      console.error(
        "Route calculation failed:",
        err
      );

      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          "Unable to calculate the requested route."
      );
    } finally {
      setCalculating(false);
    }
  }

  function clearPlanner() {
    clearTimeout(sourceTimerRef.current);
    clearTimeout(destinationTimerRef.current);

    setSource("");
    setDestination("");
    setSourceLocation(null);
    setDestinationLocation(null);

    setSourceSuggestions([]);
    setDestinationSuggestions([]);

    setRoutes([]);
    setSelectedRoute(null);

    setError("");
    setMessage("");
    setActiveField(null);
  }

  function renderSuggestions(items, field) {
    if (
      activeField !== field ||
      items.length === 0
    ) {
      return null;
    }

    return (
      <div className="location-suggestions">
        {items.slice(0, 6).map((item, index) => (
          <button
            type="button"
            key={`${field}-${index}`}
            className="suggestion-item"
            onClick={() =>
              chooseSuggestion(
                item,
                field
              )
            }
          >
            <span>
              {locationLabel(item)}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="page-content route-planner-page">
      <section className="page-title">
        <div>
          <h1>Route Planner</h1>

          <p>
            Find traffic-aware routes and compare
            alternative paths between locations.
          </p>
        </div>

        <div className="page-title-actions">
          <div className="route-status">
            <span className="status-dot" />
            Traffic-aware routing
          </div>
        </div>
      </section>

      {error && (
        <div className="alert alert-error">
          <strong>
            Route planning error.
          </strong>

          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="alert alert-success">
          <strong>
            Route analysis complete.
          </strong>

          <span>{message}</span>
        </div>
      )}

      <section className="panel route-search-panel">
        <div className="panel-header">
          <div>
            <h3>Plan Your Route</h3>

            <p>
              Enter the starting location and
              destination to analyze available
              routes.
            </p>
          </div>
        </div>

        <form
          onSubmit={calculateRoutes}
          className="route-form"
        >
          <div className="route-location-row">
            <div
              className={`form-group route-location-field ${
                activeField === "source"
                  ? "active"
                  : ""
              }`}
            >
              <label htmlFor="route-source">
                From
              </label>

              <div className="route-input-wrapper">
                <input
                  id="route-source"
                  type="text"
                  value={source}
                  onChange={(event) =>
                    handleLocationChange(
                      event.target.value,
                      "source"
                    )
                  }
                  onFocus={() =>
                    setActiveField("source")
                  }
                  placeholder="Enter starting location"
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={
                    activeField ===
                      "source" &&
                    sourceSuggestions.length > 0
                  }
                />

                {searchingSource && (
                  <span className="input-spinner" />
                )}
              </div>

              {renderSuggestions(
                sourceSuggestions,
                "source"
              )}
            </div>

            <div
              className="route-direction-arrow"
              aria-hidden="true"
            >
              →
            </div>

            <div
              className={`form-group route-location-field ${
                activeField ===
                "destination"
                  ? "active"
                  : ""
              }`}
            >
              <label htmlFor="route-destination">
                To
              </label>

              <div className="route-input-wrapper">
                <input
                  id="route-destination"
                  type="text"
                  value={destination}
                  onChange={(event) =>
                    handleLocationChange(
                      event.target.value,
                      "destination"
                    )
                  }
                  onFocus={() =>
                    setActiveField(
                      "destination"
                    )
                  }
                  placeholder="Enter destination"
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={
                    activeField ===
                      "destination" &&
                    destinationSuggestions.length > 0
                  }
                />

                {searchingDestination && (
                  <span className="input-spinner" />
                )}
              </div>

              {renderSuggestions(
                destinationSuggestions,
                "destination"
              )}
            </div>
          </div>

          <div className="route-form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearPlanner}
              disabled={calculating}
            >
              Clear
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={calculating}
            >
              {calculating
                ? "Analyzing Routes..."
                : "Find Best Route"}
            </button>
          </div>
        </form>
      </section>

      <section className="route-results-layout">
        <div className="panel route-options-panel">
          <div className="panel-header">
            <div>
              <h3>Route Alternatives</h3>

              <p>
                Compare distance, travel time
                and current traffic conditions.
              </p>
            </div>
          </div>

          {calculating ? (
            <div className="loading-state">
              <div className="spinner" />

              <span>
                Calculating traffic-aware
                routes...
              </span>
            </div>
          ) : routes.length === 0 ? (
            <div className="empty-state">
              <h3>No routes to display</h3>

              <p>
                Enter your source and destination
                above to view route alternatives.
              </p>
            </div>
          ) : (
            <div className="route-list">
              {routes.map((route, index) => {
                const congestion =
                  getCongestion(route);

                const score =
                  getRecommendationScore(
                    route
                  );

                const isSelected =
                  selectedRoute === route ||
                  selectedRoute?.id ===
                    route?.id;

                return (
                  <button
                    type="button"
                    key={
                      route?.id ??
                      `${route?.route_name ?? "route"}-${index}`
                    }
                    className={`route-option ${
                      isSelected
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedRoute(route)
                    }
                  >
                    <div className="route-option-header">
                      <div>
                        <span className="route-option-title">
                          {routeName(
                            route,
                            index
                          )}
                        </span>

                        {index === 0 && (
                          <span className="recommended-label">
                            Recommended
                          </span>
                        )}
                      </div>

                      <span
                        className={`badge ${badgeClass(
                          congestion
                        )}`}
                      >
                        {congestion}
                      </span>
                    </div>

                    <div className="route-option-metrics">
                      <div>
                        <span>Distance</span>

                        <strong>
                          {getDistance(route)}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Travel time
                        </span>

                        <strong>
                          {getDuration(route)}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Avg. speed
                        </span>

                        <strong>
                          {getSpeed(route)}
                        </strong>
                      </div>
                    </div>

                    {score !== null && (
                      <div className="route-score">
                        <span>
                          Traffic-aware score
                        </span>

                        <strong>
                          {score.toFixed(1)}
                        </strong>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel route-map-panel">
          <div className="panel-header">
            <div>
              <h3>Route Map</h3>

              <p>
                Geographic representation of the
                selected route.
              </p>
            </div>
          </div>

          <div
            ref={mapContainerRef}
            className="route-map"
            style={{
              width: "100%",
              minHeight: "420px",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          />

          {!selectedRoute && (
            <div className="route-map-overlay">
              <div className="empty-state">
                <h3>Route map</h3>

                <p>
                  Calculate alternatives and
                  select a route to view its
                  geographic information.
                </p>
              </div>
            </div>
          )}

          {selectedRoute &&
            extractGeometryCoordinates(
              getRouteGeometry(
                selectedRoute
              )
            ).length < 2 && (
              <div className="route-map-overlay route-map-no-geometry">
                <div>
                  <strong>
                    Route geometry unavailable
                  </strong>

                  <span>
                    Route metrics are available,
                    but the routing response did
                    not include map coordinates.
                  </span>
                </div>
              </div>
            )}
        </div>
      </section>

      {selectedRoute && (
        <section className="panel selected-route-panel">
          <div className="panel-header">
            <div>
              <h3>
                Selected Route Details
              </h3>

              <p>
                Detailed traffic information for
                the selected alternative.
              </p>
            </div>
          </div>

          <div className="selected-route-details">
            <div className="selected-route-title">
              <span className="route-marker source-marker">
                A
              </span>

              <div>
                <small>From</small>

                <strong>
                  {source ||
                    "Starting location"}
                </strong>
              </div>
            </div>

            <div className="selected-route-connector" />

            <div className="selected-route-title">
              <span className="route-marker destination-marker">
                B
              </span>

              <div>
                <small>To</small>

                <strong>
                  {destination ||
                    "Destination"}
                </strong>
              </div>
            </div>
          </div>

          <div className="route-detail-grid">
            <div className="route-detail-card">
              <span>Distance</span>

              <strong>
                {getDistance(selectedRoute)}
              </strong>
            </div>

            <div className="route-detail-card">
              <span>
                Estimated travel time
              </span>

              <strong>
                {getDuration(selectedRoute)}
              </strong>
            </div>

            <div className="route-detail-card">
              <span>Average speed</span>

              <strong>
                {getSpeed(selectedRoute)}
              </strong>
            </div>

            <div className="route-detail-card">
              <span>Congestion</span>

              <strong
                className={`traffic-text ${badgeClass(
                  getCongestion(
                    selectedRoute
                  )
                )}`}
              >
                {getCongestion(
                  selectedRoute
                )}
              </strong>
            </div>
          </div>

          {(selectedRoute?.traffic_summary ||
            selectedRoute?.traffic_delay_minutes !==
              undefined ||
            selectedRoute?.description ||
            selectedRoute?.reason) && (
            <div className="route-analysis-note">
              <h4>Traffic Analysis</h4>

              <p>
                {selectedRoute?.traffic_summary ||
                  (selectedRoute?.traffic_delay_minutes !==
                    undefined &&
                  selectedRoute?.traffic_delay_minutes !==
                    null
                    ? `Estimated traffic delay: ${selectedRoute.traffic_delay_minutes} minutes.`
                    : null) ||
                  selectedRoute?.description ||
                  selectedRoute?.reason}
              </p>
            </div>
          )}
        </section>
      )}
      {calculating && (
        <TrafficLoading
          title="Optimizing Route"
          message="Analyzing traffic conditions and calculating the best route."
        />
      )}
    </div>
  );
}
