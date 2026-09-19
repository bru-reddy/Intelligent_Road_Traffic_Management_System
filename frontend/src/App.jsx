import React, { Suspense } from "react";
import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

// Keep the application shell bootable even if one page module has a
// runtime/import problem. Pages are loaded only when their route is used.
const Login = React.lazy(() => import("./pages/Login"));
const Register = React.lazy(() => import("./pages/Register"));
const CommissionerRegister = React.lazy(() => import("./pages/CommissionerRegister"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const LiveMonitoring = React.lazy(() => import("./pages/LiveMonitoring"));
const Prediction = React.lazy(() => import("./pages/Prediction"));
const RoutePlanner = React.lazy(() => import("./pages/RoutePlanner"));
const Alerts = React.lazy(() => import("./pages/Alerts"));
const Analytics = React.lazy(() => import("./pages/Analytics"));
const UserManagement = React.lazy(() => import("./pages/UserManagement"));

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("IRTMS application error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="irtms-app-error">
        <div className="irtms-app-error-card">
          <div className="irtms-app-error-mark">!</div>
          <span className="irtms-app-error-eyebrow">IRTMS APPLICATION</span>
          <h1>Unable to load this page</h1>
          <p>
            The application shell is running, but this screen encountered an
            unexpected error. Reload the application to retry the page.
          </p>
          <button type="button" onClick={this.handleReload}>
            Reload IRTMS
          </button>
        </div>
      </div>
    );
  }
}

function PageLoader() {
  return (
    <div className="irtms-page-loader" role="status" aria-live="polite">
      <div className="irtms-page-loader-spinner" />
      <strong>Loading IRTMS</strong>
      <span>Preparing the traffic management workspace...</span>
    </div>
  );
}

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/register/commissioner"
          element={<CommissionerRegister />}
        />

        <Route element={<ProtectedLayout />}>
          <Route
            index
            element={<Navigate to="/dashboard" replace />}
          />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/live" element={<LiveMonitoring />} />
          <Route
            path="/monitoring"
            element={<Navigate to="/live" replace />}
          />
          <Route path="/prediction" element={<Prediction />} />
          <Route path="/routes" element={<RoutePlanner />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/users" element={<UserManagement />} />
        </Route>

        <Route
          path="*"
          element={
            <Navigate
              to={
                localStorage.getItem("irtms_token")
                  ? "/dashboard"
                  : "/login"
              }
              replace
            />
          }
        />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppRoutes />
    </AppErrorBoundary>
  );
}
