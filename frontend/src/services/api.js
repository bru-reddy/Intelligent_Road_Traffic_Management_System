import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000/api";

const client = axios.create({
  baseURL: API_BASE_URL.replace(/\/+$/, ""),
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 20000,
});

client.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("irtms_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("access_token");

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("irtms_token");
      localStorage.removeItem("access_token");
      localStorage.removeItem("token");
    }

    return Promise.reject(error);
  }
);

function extractData(response) {
  return response?.data ?? response;
}

function getErrorMessage(
  error,
  fallback = "Request failed."
) {
  if (error?.response?.data?.detail) {
    return String(error.response.data.detail);
  }

  if (error?.response?.data?.message) {
    return String(error.response.data.message);
  }

  if (error?.response?.status === 401) {
    return "Authentication credentials are invalid or expired. Please sign in again.";
  }

  if (error?.response?.status === 403) {
    return "You do not have permission to perform this action.";
  }

  if (error?.response?.status === 404) {
    return "The requested IRTMS service was not found.";
  }

  if (error?.code === "ECONNABORTED") {
    return "The backend request timed out.";
  }

  if (error?.message === "Network Error") {
    return (
      "Unable to connect to the IRTMS backend. " +
      "Make sure the FastAPI server is running on port 8000."
    );
  }

  return error?.message || fallback;
}

export async function get(url, config = {}) {
  return client.get(url, config);
}

export async function post(url, data, config = {}) {
  return client.post(url, data, config);
}

export async function put(url, data, config = {}) {
  return client.put(url, data, config);
}

export async function patch(url, data, config = {}) {
  return client.patch(url, data, config);
}

export async function remove(url, config = {}) {
  return client.delete(url, config);
}

export function getStoredUser() {
  try {
    const stored =
      localStorage.getItem("irtms_user") ||
      localStorage.getItem("user");

    if (!stored) {
      return null;
    }

    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const aliases = {
    public: "commoner",
    citizen: "commoner",
    user: "commoner",
    common: "commoner",

    trafficoperator: "traffic_operator",
    traffic_operator: "traffic_operator",
    traffic: "traffic_operator",

    operator: "system_operator",
    systemoperator: "system_operator",
    system_operator: "system_operator",
    admin: "commissioner",
    administrator: "commissioner",
    commissioner: "commissioner",
  };

  return aliases[value] || value || "commoner";
}

export function clearSessionData() {
  const keys = [
    "irtms_token",
    "access_token",
    "token",
    "auth_token",
    "irtms_user",
    "currentUser",
    "user",
    "auth_user",
  ];

  keys.forEach((key) => {
    localStorage.removeItem(key);
  });

  sessionStorage.clear();

  window.dispatchEvent(
    new Event("irtms-auth-changed")
  );
}

export function storeAuthenticatedUser(user) {
  if (!user) {
    return;
  }

  const normalizedUser = {
    ...user,
    role: normalizeRole(user.role),
  };

  localStorage.setItem(
    "irtms_user",
    JSON.stringify(normalizedUser)
  );

  localStorage.setItem(
    "user",
    JSON.stringify(normalizedUser)
  );
}

export function storeToken(token) {
  if (!token) {
    return;
  }

  localStorage.setItem("irtms_token", token);
  localStorage.setItem("access_token", token);
}

export async function register(payload) {
  try {
    const response = await client.post(
      "/auth/register",
      payload
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to register the account."
    );

    throw error;
  }
}

export async function registerCommissioner(payload) {
  try {
    const response = await client.post(
      "/auth/register/commissioner",
      payload
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to register the Commissioner account."
    );

    throw error;
  }
}

export async function login(email, password) {
  try {
    const response = await client.post(
      "/auth/login",
      {
        email,
        password,
      }
    );

    const data = extractData(response);

    const token =
      data?.access_token ||
      data?.token ||
      data?.accessToken;

    if (token) {
      storeToken(token);
    }

    const user =
      data?.user ||
      data?.current_user ||
      data?.profile;

    if (user) {
      storeAuthenticatedUser(user);
    }

    return data;
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to sign in."
    );

    throw error;
  }
}

export async function getCurrentUser() {
  try {
    const response = await client.get("/auth/me");
    const user = extractData(response);

    if (user) {
      storeAuthenticatedUser(user);
    }

    return user;
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to retrieve the current user."
    );

    throw error;
  }
}

export async function getProfile() {
  try {
    const response = await client.get("/auth/profile");
    const user = extractData(response);

    if (user) {
      storeAuthenticatedUser(user);
    }

    return user;
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to retrieve the user profile."
    );

    throw error;
  }
}

export async function getUsers() {
  try {
    const response = await client.get("/auth/users");
    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to load user accounts."
    );

    throw error;
  }
}

export async function getUser(userId) {
  try {
    const response = await client.get(
      `/auth/users/${encodeURIComponent(userId)}`
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to load the user account."
    );

    throw error;
  }
}

export async function updateUserRole(userId, role) {
  try {
    const normalizedRole = normalizeRole(role);

    const response = await client.put(
      `/auth/users/${encodeURIComponent(userId)}/role`,
      {
        role: normalizedRole,
      }
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to update the user role."
    );

    throw error;
  }
}

export async function updateUserStatus(
  userId,
  isActive
) {
  try {
    const response = await client.patch(
      `/auth/users/${encodeURIComponent(userId)}/status`,
      {
        is_active: Boolean(isActive),
      }
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to update account status."
    );

    throw error;
  }
}

export async function deleteUser(userId) {
  try {
    const response = await client.delete(
      `/auth/users/${encodeURIComponent(userId)}`
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to delete the user account."
    );

    throw error;
  }
}

export async function getLiveTraffic(options = {}) {
  try {
    const params = {};

    if (options.roadName) {
      params.road_name = options.roadName;
    }

    if (options.limit !== undefined) {
      params.limit = options.limit;
    }

    const response = await client.get(
      "/traffic/live",
      { params }
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to load stored traffic data."
    );

    throw error;
  }
}

export async function getLiveTomTomTraffic(
  latitude,
  longitude,
  state,
  area
) {
  try {
    const lat =
      latitude !== undefined &&
      latitude !== null
        ? Number(latitude)
        : 17.4399;

    const lon =
      longitude !== undefined &&
      longitude !== null
        ? Number(longitude)
        : 78.4866;

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      throw new Error(
        "Invalid traffic monitoring coordinates."
      );
    }

    const params = {
      latitude: lat,
      longitude: lon,
    };

    if (state) {
      params.state = state;
    }

    if (area) {
      params.area = area;
    }

    const response = await client.get(
      "/traffic/live-tomtom",
      { params }
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to retrieve live TomTom traffic."
    );

    throw error;
  }
}

export async function getLiveTomTomTrafficPoints(
  points = []
) {
  const validPoints = Array.isArray(points)
    ? points.filter(
        (point) =>
          Number.isFinite(
            Number(point?.latitude)
          ) &&
          Number.isFinite(
            Number(point?.longitude)
          )
      )
    : [];

  if (!validPoints.length) {
    return [];
  }

  const results = await Promise.allSettled(
    validPoints.map(async (point) => {
      const data =
        await getLiveTomTomTraffic(
          point.latitude,
          point.longitude
        );

      return {
        ...point,
        ...data,
      };
    })
  );

  return results
    .filter(
      (result) =>
        result.status === "fulfilled"
    )
    .map((result) => result.value);
}

export async function ingestTraffic(payload) {
  try {
    const response = await client.post(
      "/traffic/ingest",
      payload
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to store traffic data."
    );

    throw error;
  }
}

export async function getRoadUtilization() {
  try {
    const response = await client.get(
      "/traffic/road-utilization"
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to load road utilization."
    );

    throw error;
  }
}

export async function getAlerts(options = {}) {
  try {
    const params = {};

    if (options.active !== undefined) {
      params.active = options.active;
    }

    if (options.status) {
      params.status = options.status;
    }

    if (options.severity) {
      params.severity = options.severity;
    }

    const response = await client.get(
      "/alerts",
      { params }
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to load traffic alerts."
    );

    throw error;
  }
}

export async function getActiveAlerts() {
  try {
    const response = await client.get(
      "/alerts/active"
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to load active alerts."
    );

    throw error;
  }
}

export async function getAlertSummary() {
  try {
    const response = await client.get(
      "/alerts/summary"
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to load alert summary."
    );

    throw error;
  }
}

export async function generateAlerts() {
  try {
    const response = await client.post(
      "/alerts/generate"
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to generate traffic alerts."
    );

    throw error;
  }
}

export async function autoGenerateAlerts() {
  return generateAlerts();
}

export async function resolveAlert(alertId) {
  try {
    const response = await client.patch(
      `/alerts/${encodeURIComponent(alertId)}/resolve`
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to resolve the traffic alert."
    );

    throw error;
  }
}

export async function createAlert(payload) {
  try {
    const response = await client.post(
      "/alerts",
      payload
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to create the traffic alert."
    );

    throw error;
  }
}

export async function getAnalyticsHeatmap() {
  try {
    const response = await client.get(
      "/analytics/heatmap"
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to load the traffic heatmap."
    );

    throw error;
  }
}

export async function getRoadPerformance() {
  try {
    const response = await client.get(
      "/analytics/road-performance"
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to load road performance."
    );

    throw error;
  }
}

export async function getTrafficTrends() {
  try {
    const response = await client.get(
      "/analytics/trends"
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to load traffic trends."
    );

    throw error;
  }
}

export async function predictTraffic(payload) {
  try {
    const response = await client.post(
      "/prediction/predict",
      payload
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to generate traffic prediction."
    );

    throw error;
  }
}

export async function retrainPredictionModel() {
  try {
    const response = await client.post(
      "/prediction/retrain"
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to retrain the prediction model."
    );

    throw error;
  }
}

export async function getPredictionPeakHours(
  roadName
) {
  try {
    const params = {};

    if (roadName) {
      params.road_name = roadName;
    }

    const response = await client.get(
      "/prediction/peak-hours",
      { params }
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to load peak-hour information."
    );

    throw error;
  }
}

export async function getPeakHours(roadName) {
  return getPredictionPeakHours(roadName);
}

export async function getPredictionReport(
  roadName
) {
  try {
    const params = {};

    if (roadName) {
      params.road_name = roadName;
    }

    const response = await client.get(
      "/prediction/report",
      { params }
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to load the prediction report."
    );

    throw error;
  }
}

export async function searchRoutes(query) {
  try {
    const value =
      typeof query === "string"
        ? query
        : query?.q || "";

    const state =
      typeof query === "object"
        ? query?.state
        : undefined;

    const latitude =
      typeof query === "object"
        ? query?.latitude
        : undefined;

    const longitude =
      typeof query === "object"
        ? query?.longitude
        : undefined;

    const params = { q: value };

    if (state) {
      params.state = state;
    }

    if (latitude !== undefined) {
      params.latitude = latitude;
    }

    if (longitude !== undefined) {
      params.longitude = longitude;
    }

    const response = await client.get(
      "/routes/search",
      { params }
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to search for roads."
    );

    throw error;
  }
}

export async function recommendRoute(payload) {
  try {
    const response = await client.post(
      "/routes/recommend",
      payload
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to calculate the recommended route."
    );

    throw error;
  }
}

export async function recommendRoutes(payload) {
  return recommendRoute(payload);
}

export async function getWorkflowStatus() {
  try {
    const response = await client.get(
      "/workflow/status"
    );

    return extractData(response);
  } catch (error) {
    error.userMessage = getErrorMessage(
      error,
      "Unable to load workflow status."
    );

    throw error;
  }
}

export const api = {
  get,
  post,
  put,
  patch,
  delete: remove,

  register,
  registerCommissioner,
  login,
  me: getCurrentUser,
  getCurrentUser,
  getProfile,

  getStoredUser,
  normalizeRole,
  clearSessionData,
  storeAuthenticatedUser,
  storeToken,

  getUsers,
  getUser,
  updateUserRole,
  updateUserStatus,
  deleteUser,

  getLiveTraffic,
  getLiveTomTomTraffic,
  getLiveTomTomTrafficPoints,
  ingestTraffic,
  getRoadUtilization,

  getAlerts,
  getActiveAlerts,
  getAlertSummary,
  generateAlerts,
  autoGenerateAlerts,
  resolveAlert,
  createAlert,

  getAnalyticsHeatmap,
  getRoadPerformance,
  getTrafficTrends,

  predictTraffic,
  retrainPredictionModel,
  getPredictionPeakHours,
  getPeakHours,
  getPredictionReport,

  searchRoutes,
  recommendRoute,
  recommendRoutes,

  getWorkflowStatus,
};

export default api;

export {
  client,
  getErrorMessage,
};