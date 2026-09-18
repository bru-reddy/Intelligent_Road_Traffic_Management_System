import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../services/api.js";

const ROLE_ORDER = [
  "commoner",
  "traffic_operator",
  "system_operator",
  "commissioner",
];

const ROLE_LABELS = {
  commoner: "Commoner",
  traffic_operator: "Traffic Operator",
  system_operator: "System Operator",
  commissioner: "Commissioner",
};

const ROLE_DESCRIPTIONS = {
  commoner: "Traffic information and public services",
  traffic_operator: "Live traffic and alert operations",
  system_operator: "Traffic data and system operations",
  commissioner: "Full administration and role management",
};

function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (value === "operator") {
    return "system_operator";
  }

  if (value === "systemoperator") {
    return "system_operator";
  }

  if (value === "trafficoperator") {
    return "traffic_operator";
  }

  return ROLE_LABELS[value] ? value : "commoner";
}

function getStoredUser() {
  const keys = [
    "irtms_user",
    "currentUser",
    "user",
    "auth_user",
  ];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return {};
}

function extractUsers(response) {
  const data = response?.data ?? response;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.users)) {
    return data.users;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
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

function normalizeUser(item, index) {
  const rawRole = getValue(
    item,
    ["role", "user_role", "userRole"],
    "commoner"
  );

  return {
    id: getValue(
      item,
      ["id", "user_id", "userId"],
      `user-${index}`
    ),

    fullName: getValue(
      item,
      [
        "full_name",
        "fullName",
        "name",
        "display_name",
        "displayName",
      ],
      "Unnamed user"
    ),

    email: getValue(
      item,
      ["email"],
      "—"
    ),

    role: normalizeRole(rawRole),

    createdAt: getValue(
      item,
      [
        "created_at",
        "createdAt",
        "registration_date",
        "registered_at",
      ],
      null
    ),

    isActive:
      getValue(
        item,
        ["is_active", "isActive", "active"],
        true
      ) !== false,

    raw: item,
  };
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getInitials(name) {
  const value = String(name || "User")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (value.length === 0) {
    return "U";
  }

  if (value.length === 1) {
    return value[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    value[0][0] +
    value[value.length - 1][0]
  ).toUpperCase();
}

function roleClass(role) {
  return normalizeRole(role).replace(/_/g, "-");
}

function PermissionRow({ label, values }) {
  return (
    <tr>
      <td>
        <strong>{label}</strong>
      </td>

      {values.map((allowed, index) => (
        <td key={`${label}-${index}`}>
          <span
            className={`permission-icon ${
              allowed ? "allowed" : "denied"
            }`}
            aria-label={
              allowed
                ? "Allowed"
                : "Not allowed"
            }
          >
            {allowed ? "✓" : "—"}
          </span>
        </td>
      ))}
    </tr>
  );
}

export default function UserManagement() {
  const currentUser = useMemo(
    () => getStoredUser(),
    []
  );

  const currentRole = normalizeRole(
    currentUser?.role ||
      currentUser?.user_role ||
      currentUser?.userRole
  );

  const canManageUsers =
    currentRole === "commissioner";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [updatingUserId, setUpdatingUserId] =
    useState(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] =
    useState("all");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadUsers = useCallback(
    async (silent = false) => {
      if (!canManageUsers) {
        setLoading(false);
        return;
      }

      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await api.get(
          "/auth/users"
        );

        const normalized = extractUsers(
          response
        ).map(normalizeUser);

        setUsers(normalized);
      } catch (err) {
        console.error(
          "Unable to load users:",
          err
        );

        setError(
          err?.response?.data?.detail ||
            err?.response?.data?.message ||
            err?.message ||
            "Unable to load user accounts."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canManageUsers]
  );

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function changeRole(
    userId,
    newRole
  ) {
    if (!canManageUsers) {
      return;
    }

    const normalizedRole =
      normalizeRole(newRole);

    if (!ROLE_LABELS[normalizedRole]) {
      return;
    }

    const targetUser = users.find(
      (user) =>
        String(user.id) ===
        String(userId)
    );

    if (!targetUser) {
      return;
    }

    const isCurrentUser =
      String(userId) ===
      String(
        currentUser?.id ||
          currentUser?.user_id
      );

    if (isCurrentUser) {
      setError(
        "Your own role cannot be changed from User Management."
      );
      return;
    }

    if (
      targetUser.role === normalizedRole
    ) {
      return;
    }

    setUpdatingUserId(userId);
    setError("");
    setMessage("");

    try {
      const response = await api.patch(
        `/auth/users/${encodeURIComponent(
          userId
        )}/role`,
        {
          role: normalizedRole,
        }
      );

      const data =
        response?.data ?? response;

      setUsers((current) =>
        current.map((user) =>
          String(user.id) ===
          String(userId)
            ? {
                ...user,
                role: normalizedRole,
              }
            : user
        )
      );

      setMessage(
        data?.message ||
          `${targetUser.fullName}'s role was changed to ${ROLE_LABELS[normalizedRole]}.`
      );

      window.setTimeout(() => {
        setMessage("");
      }, 4000);
    } catch (err) {
      console.error(
        "Unable to update user role:",
        err
      );

      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          "Unable to update the user role."
      );
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function changeStatus(
    userId,
    currentStatus
  ) {
    if (!canManageUsers) {
      return;
    }

    const targetUser = users.find(
      (user) =>
        String(user.id) ===
        String(userId)
    );

    if (!targetUser) {
      return;
    }

    const isCurrentUser =
      String(userId) ===
      String(
        currentUser?.id ||
          currentUser?.user_id
      );

    if (isCurrentUser) {
      setError(
        "Your own account status cannot be changed here."
      );
      return;
    }

    setUpdatingUserId(userId);
    setError("");
    setMessage("");

    try {
      const response = await api.patch(
        `/auth/users/${encodeURIComponent(
          userId
        )}/status`,
        {
          is_active: !currentStatus,
        }
      );

      const data =
        response?.data ?? response;

      const nextStatus = !currentStatus;

      setUsers((current) =>
        current.map((user) =>
          String(user.id) ===
          String(userId)
            ? {
                ...user,
                isActive: nextStatus,
              }
            : user
        )
      );

      setMessage(
        data?.message ||
          `${targetUser.fullName} is now ${
            nextStatus
              ? "active"
              : "inactive"
          }.`
      );

      window.setTimeout(() => {
        setMessage("");
      }, 4000);
    } catch (err) {
      console.error(
        "Unable to update user status:",
        err
      );

      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          "Unable to update account status."
      );
    } finally {
      setUpdatingUserId(null);
    }
  }

  const filteredUsers = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole =
        roleFilter === "all" ||
        user.role === roleFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" &&
          user.isActive) ||
        (statusFilter === "inactive" &&
          !user.isActive);

      if (
        !matchesRole ||
        !matchesStatus
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        user.fullName,
        user.email,
        user.role,
        ROLE_LABELS[user.role],
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query)
        );
    });
  }, [
    users,
    search,
    roleFilter,
    statusFilter,
  ]);

  const statistics = useMemo(() => {
    return {
      total: users.length,

      active: users.filter(
        (user) => user.isActive
      ).length,

      inactive: users.filter(
        (user) => !user.isActive
      ).length,

      commoners: users.filter(
        (user) =>
          user.role === "commoner"
      ).length,

      trafficOperators: users.filter(
        (user) =>
          user.role ===
          "traffic_operator"
      ).length,

      systemOperators: users.filter(
        (user) =>
          user.role ===
          "system_operator"
      ).length,

      commissioners: users.filter(
        (user) =>
          user.role ===
          "commissioner"
      ).length,
    };
  }, [users]);

  if (!canManageUsers) {
    return (
      <div className="page-content user-management-page">
        <section className="page-title">
          <div>
            <h1>User Management</h1>

            <p>
              User account administration
              and access control.
            </p>
          </div>
        </section>

        <section className="panel access-denied-panel">
          <div className="empty-state">
            <div className="empty-state-icon">
              🔒
            </div>

            <h3>Access Restricted</h3>

            <p>
              User management is available
              only to the Commissioner.
            </p>

            <span className="access-role-message">
              Your current role:{" "}
              <strong>
                {ROLE_LABELS[currentRole] ||
                  currentRole}
              </strong>
            </span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-content user-management-page">
      <section className="page-title">
        <div>
          <h1>User Management</h1>

          <p>
            Manage registered users, roles,
            and account access.
          </p>
        </div>

        <div className="page-title-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              loadUsers(true)
            }
            disabled={
              loading || refreshing
            }
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh Users"}
          </button>
        </div>
      </section>

      {error && (
        <div
          className="alert alert-error"
          role="alert"
        >
          <strong>
            User management error.
          </strong>

          <span>{error}</span>
        </div>
      )}

      {message && (
        <div
          className="alert alert-success"
          role="status"
        >
          <strong>Updated.</strong>

          <span>{message}</span>
        </div>
      )}

      <section className="stats">
        <div className="stat-card">
          <div className="stat-card-content">
            <span className="stat-label">
              Registered Users
            </span>

            <strong className="stat-value">
              {loading
                ? "—"
                : statistics.total}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-content">
            <span className="stat-label">
              Active Accounts
            </span>

            <strong className="stat-value">
              {loading
                ? "—"
                : statistics.active}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-content">
            <span className="stat-label">
              Traffic Operators
            </span>

            <strong className="stat-value">
              {loading
                ? "—"
                : statistics.trafficOperators}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-content">
            <span className="stat-label">
              System Operators
            </span>

            <strong className="stat-value">
              {loading
                ? "—"
                : statistics.systemOperators}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-content">
            <span className="stat-label">
              Commissioners
            </span>

            <strong className="stat-value">
              {loading
                ? "—"
                : statistics.commissioners}
            </strong>
          </div>
        </div>
      </section>

      <section className="panel role-overview-panel">
        <div className="panel-header">
          <div>
            <h3>Access Roles</h3>

            <p>
              The Commissioner can assign any
              of the four supported IRTMS roles.
            </p>
          </div>
        </div>

        <div className="role-overview-grid">
          {ROLE_ORDER.map((role) => (
            <div
              className="role-overview-card"
              key={role}
            >
              <div
                className={`role-icon ${roleClass(
                  role
                )}`}
              >
                {role === "commoner"
                  ? "C"
                  : role ===
                      "traffic_operator"
                    ? "T"
                    : role ===
                        "system_operator"
                      ? "S"
                      : "M"}
              </div>

              <div>
                <strong>
                  {ROLE_LABELS[role]}
                </strong>

                <p>
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel users-table-panel">
        <div className="panel-header">
          <div>
            <h3>Registered Users</h3>

            <p>
              Change roles or activate and
              deactivate user accounts.
            </p>
          </div>
        </div>

        <div className="filter-bar user-filter-bar">
          <div className="search-field">
            <span aria-hidden="true">
              ⌕
            </span>

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search by name or email..."
              aria-label="Search users"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(
                event.target.value
              )
            }
            className="filter-select"
            aria-label="Filter by role"
          >
            <option value="all">
              All Roles
            </option>

            {ROLE_ORDER.map((role) => (
              <option
                key={role}
                value={role}
              >
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
            className="filter-select"
            aria-label="Filter by status"
          >
            <option value="all">
              All Statuses
            </option>

            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>
          </select>

          {(search ||
            roleFilter !== "all" ||
            statusFilter !== "all") && (
            <button
              type="button"
              className="btn btn-small btn-secondary"
              onClick={() => {
                setSearch("");
                setRoleFilter("all");
                setStatusFilter("all");
              }}
            >
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner" />

            <span>
              Loading registered users...
            </span>
          </div>
        ) : filteredUsers.length ===
          0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              👥
            </div>

            <h3>No users found</h3>

            <p>
              {search ||
              roleFilter !== "all" ||
              statusFilter !== "all"
                ? "No accounts match the current filters."
                : "There are currently no registered users."}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Registered</th>
                  <th>Status</th>
                  <th>Role Control</th>
                  <th>Account</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map(
                  (user) => {
                    const isCurrentUser =
                      String(user.id) ===
                      String(
                        currentUser?.id ||
                          currentUser?.user_id
                      );

                    const updating =
                      String(
                        updatingUserId
                      ) ===
                      String(user.id);

                    return (
                      <tr
                        key={user.id}
                      >
                        <td>
                          <div className="user-table-identity">
                            <div className="user-avatar">
                              {getInitials(
                                user.fullName
                              )}
                            </div>

                            <div>
                              <strong>
                                {user.fullName}
                              </strong>

                              {isCurrentUser && (
                                <small>
                                  Current account
                                </small>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          {user.email}
                        </td>

                        <td>
                          <span
                            className={`role-badge ${roleClass(
                              user.role
                            )}`}
                          >
                            {ROLE_LABELS[
                              user.role
                            ] ||
                              user.role}
                          </span>
                        </td>

                        <td>
                          {formatDate(
                            user.createdAt
                          )}
                        </td>

                        <td>
                          <span
                            className={`user-status ${
                              user.isActive
                                ? "active"
                                : "inactive"
                            }`}
                          >
                            <span className="status-dot" />

                            {user.isActive
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        <td>
                          <div className="user-role-action">
                            <select
                              value={
                                user.role
                              }
                              disabled={
                                updating ||
                                isCurrentUser
                              }
                              onChange={(
                                event
                              ) =>
                                changeRole(
                                  user.id,
                                  event.target
                                    .value
                                )
                              }
                              title={
                                isCurrentUser
                                  ? "Your own role cannot be changed here."
                                  : "Change user role"
                              }
                              aria-label={`Change role for ${user.fullName}`}
                            >
                              {ROLE_ORDER.map(
                                (
                                  role
                                ) => (
                                  <option
                                    key={
                                      role
                                    }
                                    value={
                                      role
                                    }
                                  >
                                    {
                                      ROLE_LABELS[
                                        role
                                      ]
                                    }
                                  </option>
                                )
                              )}
                            </select>

                            {updating && (
                              <span className="input-spinner" />
                            )}
                          </div>
                        </td>

                        <td>
                          <button
                            type="button"
                            className={`btn btn-small ${
                              user.isActive
                                ? "btn-secondary"
                                : "btn-primary"
                            }`}
                            disabled={
                              updating ||
                              isCurrentUser
                            }
                            onClick={() =>
                              changeStatus(
                                user.id,
                                user.isActive
                              )
                            }
                            title={
                              isCurrentUser
                                ? "Your own account cannot be disabled here."
                                : user.isActive
                                  ? "Deactivate account"
                                  : "Activate account"
                            }
                          >
                            {updating
                              ? "Updating..."
                              : user.isActive
                                ? "Deactivate"
                                : "Activate"}
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel permissions-panel">
        <div className="panel-header">
          <div>
            <h3>Permission Matrix</h3>

            <p>
              Operational capabilities assigned
              to each IRTMS role.
            </p>
          </div>
        </div>

        <div className="permissions-table-wrapper">
          <table className="data-table permissions-table">
            <thead>
              <tr>
                <th>Capability</th>
                <th>Commoner</th>
                <th>
                  Traffic Operator
                </th>
                <th>
                  System Operator
                </th>
                <th>Commissioner</th>
              </tr>
            </thead>

            <tbody>
              <PermissionRow
                label="View live traffic"
                values={[
                  true,
                  true,
                  true,
                  true,
                ]}
              />

              <PermissionRow
                label="View traffic analytics"
                values={[
                  true,
                  true,
                  true,
                  true,
                ]}
              />

              <PermissionRow
                label="Traffic prediction"
                values={[
                  true,
                  true,
                  true,
                  true,
                ]}
              />

              <PermissionRow
                label="Route analysis"
                values={[
                  true,
                  true,
                  true,
                  true,
                ]}
              />

              <PermissionRow
                label="Create and manage traffic alerts"
                values={[
                  false,
                  true,
                  true,
                  true,
                ]}
              />

              <PermissionRow
                label="Refresh operational traffic data"
                values={[
                  false,
                  false,
                  true,
                  true,
                ]}
              />

              <PermissionRow
                label="Trigger prediction model retraining"
                values={[
                  false,
                  false,
                  true,
                  true,
                ]}
              />

              <PermissionRow
                label="Manage users and roles"
                values={[
                  false,
                  false,
                  false,
                  true,
                ]}
              />

              <PermissionRow
                label="Activate or deactivate accounts"
                values={[
                  false,
                  false,
                  false,
                  true,
                ]}
              />
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}