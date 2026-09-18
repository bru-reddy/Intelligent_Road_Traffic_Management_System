import React from "react";
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

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/register"
        element={<Register />}
      />

      <Route
        path="/register/commissioner"
        element={<CommissionerRegister />}
      />

      <Route element={<ProtectedLayout />}>
        <Route
          index
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        <Route
          path="/live"
          element={<LiveMonitoring />}
        />

        <Route
          path="/monitoring"
          element={
            <Navigate
              to="/live"
              replace
            />
          }
        />

        <Route
          path="/prediction"
          element={<Prediction />}
        />

        <Route
          path="/routes"
          element={<RoutePlanner />}
        />

        <Route
          path="/alerts"
          element={<Alerts />}
        />

        <Route
          path="/analytics"
          element={<Analytics />}
        />

        <Route
          path="/users"
          element={<UserManagement />}
        />
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
  );
}
