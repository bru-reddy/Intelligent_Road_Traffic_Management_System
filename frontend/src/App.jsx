import React, { Suspense } from "react";
import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import CommissionerRegister from "./pages/CommissionerRegister";
import Dashboard from "./pages/Dashboard";
import LiveMonitoring from "./pages/LiveMonitoring";
import Prediction from "./pages/Prediction";
import RoutePlanner from "./pages/RoutePlanner";
import Alerts from "./pages/Alerts";
import Analytics from "./pages/Analytics";
import UserManagement from "./pages/UserManagement";

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

    const message =
      this.state.error?.message ||
      String(this.state.error) ||
      "Unknown application error.";

    return (
      <div className="irtms-app-error">
        <div className="irtms-app-error-card">
          <div className="irtms-app-error-mark">!</div>
          <span className="irtms-app-error-eyebrow">IRTMS APPLICATION</span>
          <h1>Unable to load this page</h1>
          <p>
            The application encountered an unexpected runtime error.
            Reload the application to retry.
          </p>
          <details className="irtms-app-error-details">
            <summary>Technical error</summary>
            <code>{message}</code>
          </details>
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
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/live" element={<LiveMonitoring />} />
          <Route path="/monitoring" element={<Navigate to="/live" replace />} />
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
