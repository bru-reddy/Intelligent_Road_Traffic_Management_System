import districtData from "./india-states-districts.json";
import cityData from "./india-cities.json";

export const INDIA_STATES = [
  { name: "Andhra Pradesh", type: "State", capital: "Amaravati", latitude: 16.5745, longitude: 80.3575 },
  { name: "Arunachal Pradesh", type: "State", capital: "Itanagar", latitude: 27.0844, longitude: 93.6053 },
  { name: "Assam", type: "State", capital: "Dispur", latitude: 26.1433, longitude: 91.7898 },
  { name: "Bihar", type: "State", capital: "Patna", latitude: 25.5941, longitude: 85.1376 },
  { name: "Chhattisgarh", type: "State", capital: "Raipur", latitude: 21.2514, longitude: 81.6296 },
  { name: "Goa", type: "State", capital: "Panaji", latitude: 15.4909, longitude: 73.8278 },
  { name: "Gujarat", type: "State", capital: "Gandhinagar", latitude: 23.2156, longitude: 72.6369 },
  { name: "Haryana", type: "State", capital: "Chandigarh", latitude: 30.7333, longitude: 76.7794 },
  { name: "Himachal Pradesh", type: "State", capital: "Shimla", latitude: 31.1048, longitude: 77.1734 },
  { name: "Jharkhand", type: "State", capital: "Ranchi", latitude: 23.3441, longitude: 85.3096 },
  { name: "Karnataka", type: "State", capital: "Bengaluru", latitude: 12.9716, longitude: 77.5946 },
  { name: "Kerala", type: "State", capital: "Thiruvananthapuram", latitude: 8.5241, longitude: 76.9366 },
  { name: "Madhya Pradesh", type: "State", capital: "Bhopal", latitude: 23.2599, longitude: 77.4126 },
  { name: "Maharashtra", type: "State", capital: "Mumbai", latitude: 19.0760, longitude: 72.8777 },
  { name: "Manipur", type: "State", capital: "Imphal", latitude: 24.8170, longitude: 93.9368 },
  { name: "Meghalaya", type: "State", capital: "Shillong", latitude: 25.5788, longitude: 91.8933 },
  { name: "Mizoram", type: "State", capital: "Aizawl", latitude: 23.7271, longitude: 92.7176 },
  { name: "Nagaland", type: "State", capital: "Kohima", latitude: 25.6751, longitude: 94.1086 },
  { name: "Odisha", type: "State", capital: "Bhubaneswar", latitude: 20.2961, longitude: 85.8245 },
  { name: "Punjab", type: "State", capital: "Chandigarh", latitude: 30.7333, longitude: 76.7794 },
  { name: "Rajasthan", type: "State", capital: "Jaipur", latitude: 26.9124, longitude: 75.7873 },
  { name: "Sikkim", type: "State", capital: "Gangtok", latitude: 27.3389, longitude: 88.6065 },
  { name: "Tamil Nadu", type: "State", capital: "Chennai", latitude: 13.0827, longitude: 80.2707 },
  { name: "Telangana", type: "State", capital: "Hyderabad", latitude: 17.3850, longitude: 78.4867 },
  { name: "Tripura", type: "State", capital: "Agartala", latitude: 23.8315, longitude: 91.2868 },
  { name: "Uttar Pradesh", type: "State", capital: "Lucknow", latitude: 26.8467, longitude: 80.9462 },
  { name: "Uttarakhand", type: "State", capital: "Dehradun", latitude: 30.3165, longitude: 78.0322 },
  { name: "West Bengal", type: "State", capital: "Kolkata", latitude: 22.5726, longitude: 88.3639 },
  { name: "Andaman and Nicobar Islands", type: "Union Territory", capital: "Port Blair", latitude: 11.6234, longitude: 92.7265 },
  { name: "Chandigarh", type: "Union Territory", capital: "Chandigarh", latitude: 30.7333, longitude: 76.7794 },
  { name: "Dadra and Nagar Haveli and Daman and Diu", type: "Union Territory", capital: "Daman", latitude: 20.3974, longitude: 72.8328 },
  { name: "Delhi", type: "Union Territory", capital: "New Delhi", latitude: 28.6139, longitude: 77.2090 },
  { name: "Jammu and Kashmir", type: "Union Territory", capital: "Srinagar", latitude: 34.0837, longitude: 74.7973 },
  { name: "Ladakh", type: "Union Territory", capital: "Leh", latitude: 34.1526, longitude: 77.5771 },
  { name: "Lakshadweep", type: "Union Territory", capital: "Kavaratti", latitude: 10.5669, longitude: 72.6420 },
  { name: "Puducherry", type: "Union Territory", capital: "Puducherry", latitude: 11.9416, longitude: 79.8083 },
];

export const INDIA_STATE_NAMES = INDIA_STATES.map((state) => state.name);

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function getStateInfo(name) {
  const target = normalize(name);
  return INDIA_STATES.find(
    (state) => normalize(state.name) === target
  ) || null;
}

export function getAreasForState(stateName, query = "") {
  const target = normalize(stateName);
  const districtEntry = districtData.find(
    (entry) => normalize(entry.state) === target
  );

  const districts = (districtEntry?.districts || []).map((name) => ({
    name,
    label: `${name}, ${stateName}`,
    state: stateName,
    type: "District",
  }));

  const cities = cityData
    .filter((city) => normalize(city.state) === target)
    .map((city) => ({
      name: city.name,
      label: `${city.name}, ${stateName}`,
      state: stateName,
      type: "City",
    }));

  const capital = getStateInfo(stateName);
  const capitalItem = capital
    ? [{
        name: capital.capital,
        label: `${capital.capital}, ${stateName}`,
        state: stateName,
        type: "Capital",
        latitude: capital.latitude,
        longitude: capital.longitude,
      }]
    : [];

  const all = [...capitalItem, ...cities, ...districts];
  const seen = new Set();

  const unique = all.filter((item) => {
    const key = normalize(item.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const q = normalize(query);
  if (!q) return unique.slice(0, 50);

  return unique
    .map((item) => {
      const label = normalize(item.name);
      const starts = label.startsWith(q);
      const includes = label.includes(q);
      return { item, score: starts ? 0 : includes ? 10 : 100 };
    })
    .filter((entry) => entry.score < 100)
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.item)
    .slice(0, 20);
}

export function getDefaultMonitoringScope() {
  const state = getStateInfo("Telangana");
  return {
    state: state?.name || "Telangana",
    area: state?.capital || "Hyderabad",
    latitude: state?.latitude || 17.3850,
    longitude: state?.longitude || 78.4867,
  };
}

export function getStoredMonitoringScope() {
  try {
    const raw = localStorage.getItem("irtms_monitoring_scope");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state && parsed?.area) return parsed;
    }
  } catch {
    // Ignore malformed local state.
  }
  return getDefaultMonitoringScope();
}

export function storeMonitoringScope(scope) {
  const normalized = {
    state: scope?.state || "Telangana",
    area: scope?.area || "Hyderabad",
    latitude: Number(scope?.latitude),
    longitude: Number(scope?.longitude),
  };

  localStorage.setItem(
    "irtms_monitoring_scope",
    JSON.stringify(normalized)
  );

  window.dispatchEvent(
    new CustomEvent("irtms-monitoring-scope-changed", {
      detail: normalized,
    })
  );

  return normalized;
}
