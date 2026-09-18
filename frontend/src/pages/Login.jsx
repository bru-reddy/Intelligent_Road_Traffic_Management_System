import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.email.trim() || !formData.password) {
      setError("Please enter your email address and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/login", {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      const data = response.data || {};
      const token = data.access_token;

      if (!token) {
        throw new Error("Authentication token was not returned.");
      }

      localStorage.setItem("irtms_token", token);

      if (data.user) {
        localStorage.setItem("irtms_user", JSON.stringify(data.user));
      } else {
        localStorage.removeItem("irtms_user");
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;

      let message = "Unable to sign in. Please check your credentials.";

      if (Array.isArray(detail)) {
        message =
          detail
            .map((item) => item?.msg)
            .filter(Boolean)
            .join(", ") || message;
      } else if (typeof detail === "string") {
        message = detail;
      } else if (typeof err.response?.data?.message === "string") {
        message = err.response.data.message;
      } else if (err.message) {
        message = err.message;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-background" aria-hidden="true">
        <div className="auth-glow auth-glow-one" />
        <div className="auth-glow auth-glow-two" />
      </div>

      <div className="auth-shell">
        <section className="auth-brand-panel">
          <div className="brand-content">
            <div className="brand-eyebrow">SMART MOBILITY PLATFORM</div>

            <h1 className="brand-title">
              Intelligent Road Traffic Monitoring System
            </h1>

            <p className="brand-subtitle">
              Intelligent Traffic Management
            </p>

            <div className="traffic-animation" aria-hidden="true">
              <div className="traffic-skyline">
                <span className="building building-one" />
                <span className="building building-two" />
                <span className="building building-three" />
                <span className="building building-four" />
                <span className="building building-five" />
              </div>

              <div className="traffic-road">
                <div className="road-line road-line-one" />
                <div className="road-line road-line-two" />
                <div className="road-line road-line-three" />
                <div className="road-line road-line-four" />

                <div className="animated-car">
                  <div className="car-shadow" />

                  <div className="car-body">
                    <div className="car-window car-window-front" />
                    <div className="car-window car-window-back" />

                    <div className="car-headlight car-headlight-left" />
                    <div className="car-headlight car-headlight-right" />

                    <div className="car-wheel car-wheel-left" />
                    <div className="car-wheel car-wheel-right" />
                  </div>
                </div>
              </div>

              <div className="traffic-road-glow" />
            </div>

            <div className="brand-feature-list">
              <div className="brand-feature">
                <span className="feature-dot" />
                <span>Real-time traffic monitoring</span>
              </div>

              <div className="brand-feature">
                <span className="feature-dot" />
                <span>AI-powered congestion prediction</span>
              </div>

              <div className="brand-feature">
                <span className="feature-dot" />
                <span>Intelligent route analysis</span>
              </div>
            </div>
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-card">
            <div className="auth-card-header">
              <div className="auth-kicker">SECURE ACCESS</div>

              <h2>Welcome back</h2>

              <p>
                Sign in to continue to your traffic
                <br />
                management dashboard.
              </p>
            </div>

            {error && (
              <div className="auth-error" role="alert">
                <span className="auth-error-icon">!</span>
                <span>{error}</span>
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email address</label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                className="auth-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="button-spinner" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            <div className="auth-register">
              <span>Don't have an account?</span>

              <Link to="/register">Create account</Link>
            </div>

            <div className="auth-security-note">
              <span>
                Your credentials are securely handled by the Intelligent Road
                Traffic Monitoring System backend.
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;