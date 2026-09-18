import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerCommissioner } from "../services/api";

export default function CommissionerRegister() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    registration_code: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const fullName = form.full_name.trim();
    const email = form.email.trim().toLowerCase();
    const registrationCode = form.registration_code.trim();

    if (!fullName) {
      setError("Please enter your full name.");
      return;
    }

    if (fullName.length < 2) {
      setError("Full name must contain at least 2 characters.");
      return;
    }

    if (!email) {
      setError("Please enter your official email address.");
      return;
    }

    if (!form.password) {
      setError("Please enter a password.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (!registrationCode) {
      setError("Please enter the Commissioner registration code.");
      return;
    }

    try {
      setLoading(true);

      await registerCommissioner({
        full_name: fullName,
        email,
        password: form.password,
        registration_code: registrationCode,
      });

      setSuccess(
        "Commissioner registration successful. Redirecting to login..."
      );

      window.setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1200);
    } catch (err) {
      const detail = err?.response?.data?.detail;

      let message =
        "Commissioner registration failed. Please try again.";

      if (Array.isArray(detail)) {
        message =
          detail
            .map((item) => item?.msg || String(item))
            .filter(Boolean)
            .join(", ") || message;
      } else if (typeof detail === "string") {
        message = detail;
      } else if (typeof err?.response?.data?.message === "string") {
        message = err.response.data.message;
      } else if (err?.message) {
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
            <div className="brand-eyebrow">
              MUNICIPAL TRAFFIC ADMINISTRATION
            </div>

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
                <span className="road-line road-line-one" />
                <span className="road-line road-line-two" />
                <span className="road-line road-line-three" />
                <span className="road-line road-line-four" />

                <div className="animated-car">
                  <div className="car-shadow" />

                  <div className="car-body">
                    <span className="car-window car-window-back" />
                    <span className="car-window car-window-front" />

                    <span className="car-headlight car-headlight-left" />
                    <span className="car-headlight car-headlight-right" />

                    <span className="car-wheel car-wheel-left" />
                    <span className="car-wheel car-wheel-right" />
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
              <div className="auth-kicker">AUTHORIZED ACCESS</div>

              <h2>Commissioner Registration</h2>

              <p>
                Create an authorized Commissioner account for municipal
                traffic administration.
              </p>
            </div>

            {error && (
              <div className="auth-error" role="alert">
                <span className="auth-error-icon">!</span>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="success-message" role="status">
                {success}
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="full_name">Full Name</label>

                <div className="input-wrapper">
                  <span className="input-icon" aria-hidden="true">
                    👤
                  </span>

                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    value={form.full_name}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    autoFocus
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>

                <div className="input-wrapper">
                  <span className="input-icon" aria-hidden="true">
                    @
                  </span>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter your official email"
                    autoComplete="email"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>

                <div className="input-wrapper">
                  <span className="input-icon" aria-hidden="true">
                    •
                  </span>

                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Create a secure password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="registration_code">
                  Commissioner Registration Code
                </label>

                <div className="input-wrapper">
                  <span className="input-icon" aria-hidden="true">
                    🔑
                  </span>

                  <input
                    id="registration_code"
                    name="registration_code"
                    type="password"
                    value={form.registration_code}
                    onChange={handleChange}
                    placeholder="Enter authorization code"
                    autoComplete="off"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="account-role-info">
                <div className="account-role-icon">✓</div>

                <div>
                  <strong>Commissioner Account</strong>
                  <span>
                    This account provides the highest administrative
                    access level.
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="auth-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="button-spinner" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create Commissioner Account
                    <span className="button-arrow">→</span>
                  </>
                )}
              </button>
            </form>

            <div className="auth-register">
              <span>Already have an account?</span>

              <Link to="/login">Sign in</Link>
            </div>

            <div className="commissioner-register-link">
              <span>Public user?</span>

              <Link to="/register">Create a public account</Link>
            </div>

            <div className="auth-security-note">
              <span className="security-icon" aria-hidden="true">
                🔒
              </span>

              <span>
                Commissioner access is restricted to authorized personnel.
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}