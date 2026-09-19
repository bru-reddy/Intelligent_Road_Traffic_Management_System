function hashSeed(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function numeric(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Last-resort UI fallback for a selected Indian city/town.
 * These are synthetic observations and are explicitly labelled as such.
 * The backend remains the primary source for TomTom/OSM-backed traffic.
 */
export function buildSimulationPoints(scope = {}) {
  const latitude = numeric(scope?.latitude, 20.5937);
  const longitude = numeric(scope?.longitude, 78.9629);
  const state = String(scope?.state || "India").trim() || "India";
  const area =
    String(scope?.area || "Selected monitoring area").trim() ||
    "Selected monitoring area";

  const seed = hashSeed(
    `${state}|${area}|${latitude.toFixed(4)}|${longitude.toFixed(4)}`
  );

  const corridors = [
    "Central Corridor",
    "Main Arterial",
    "Market Road",
    "Ring Road",
    "Junction Corridor",
  ];

  const offsets = [
    [-0.0065, -0.0075],
    [0.0048, -0.0032],
    [-0.0032, 0.0062],
    [0.0072, 0.0046],
    [-0.0054, 0.0090],
  ];

  return corridors.map((corridor, index) => {
    const base = (seed + index * 7919) >>> 0;
    const freeFlowSpeed = 48 + (base % 25);
    const ratio = 0.48 + (((base >>> 8) % 34) / 100);
    const speed = Math.max(
      18,
      Math.min(freeFlowSpeed, freeFlowSpeed * ratio)
    );

    let congestion = "low";
    if (speed / freeFlowSpeed < 0.4) {
      congestion = "critical";
    } else if (speed / freeFlowSpeed < 0.7) {
      congestion = "high";
    } else if (speed / freeFlowSpeed < 0.85) {
      congestion = "medium";
    }

    return {
      id: `ui-sim-${base}-${index}`,
      road_name: `${area} — ${corridor}`,
      state,
      area,
      latitude: Number((latitude + offsets[index][0]).toFixed(6)),
      longitude: Number((longitude + offsets[index][1]).toFixed(6)),
      vehicle_count: 280 + (base % 850),
      avg_speed_kmph: Number(speed.toFixed(1)),
      free_flow_speed_kmph: freeFlowSpeed,
      current_speed: Number(speed.toFixed(1)),
      free_flow_speed: freeFlowSpeed,
      congestion_level: congestion,
      road_status:
        congestion === "critical"
          ? "Critical traffic"
          : congestion === "high"
            ? "Heavy traffic"
            : congestion === "medium"
              ? "Moderate traffic"
              : "Free flowing",
      data_source: "simulation-fallback",
      data_source_label: "Simulated demo traffic",
      is_simulated: true,
      vehicle_count_estimated: true,
      recorded_at: new Date().toISOString(),
    };
  });
}
