import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, registerCommissioner } from "../services/api";

const ROLE_OPTIONS = [
  {
    value: "commoner",
    label: "Commoner",
  },
  {
    value: "commissioner",
    label: "Commissioner",
  },
];

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "commoner",
    registration_code: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedRole = formData.role;

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "role" && value !== "commissioner"
        ? { registration_code: "" }
        : {}),
    }));

    setError("");
    setSuccess("");
  };

  const getErrorMessage = (err, fallback) => {
    const detail = err?.response?.data?.detail;

    if (Array.isArray(detail)) {
      return (
        detail
          .map((item) => item?.msg || String(item))
          .filter(Boolean)
          .join(", ") || fallback
      );
    }

    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }

    if (
      typeof err?.response?.data?.message === "string" &&
      err.response.data.message.trim()
    ) {
      return err.response.data.message;
    }

    if (err?.message) {
      return err.message;
    }

    return fallback;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const fullName = formData.full_name.trim();
    const email = formData.email.trim().toLowerCase();
    const password = formData.password;
    const role = formData.role;
    const registrationCode = formData.registration_code.trim();

    if (!fullName) {
      setError("Please enter your full name.");
      return;
    }

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please create a password.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (!["commoner", "commissioner"].includes(role)) {
      setError("Please choose a valid registration role.");
      return;
    }

    if (role === "commissioner" && !registrationCode) {
      setError("Please enter the Commissioner registration code.");
      return;
    }

    setLoading(true);

    try {
      if (role === "commissioner") {
        await registerCommissioner({
          full_name: fullName,
          email,
          password,
          registration_code: registrationCode,
        });
      } else {
        await api.post("/auth/register", {
          full_name: fullName,
          email,
          password,
          role: "commoner",
        });
      }

      setSuccess(
        "Account created successfully. Redirecting to the login page..."
      );

      setFormData({
        full_name: "",
        email,
        password: "",
        role: "commoner",
        registration_code: "",
      });

      window.setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1200);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to create the account. Please try again."
        )
      );
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
              <div className="auth-kicker">ACCOUNT REGISTRATION</div>

              <h2>Create your account</h2>

              <p>
                Register for access to the Intelligent Road Traffic
                Monitoring System.
              </p>
            </div>

            {error && (
              <div className="auth-error" role="alert">
                <span className="auth-error-icon">!</span>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="auth-success" role="status">
                <span>{success}</span>
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="full_name">Full name</label>

                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email address</label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email address"
                  autoComplete="email"
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
                  placeholder="Create a secure password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="role">Choose your role</label>

                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  disabled={loading}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <small className="role-description">
                  Commoner accounts can be registered directly. Commissioner
                  registration requires authorization.
                </small>
              </div>

              {selectedRole === "commissioner" && (
                <div className="form-group commissioner-code-group">
                  <label htmlFor="registration_code">
                    Commissioner registration code
                  </label>

                  <input
                    id="registration_code"
                    name="registration_code"
                    type="password"
                    value={formData.registration_code}
                    onChange={handleChange}
                    placeholder="Enter authorization code"
                    autoComplete="off"
                    required
                    disabled={loading}
                  />

                  <small className="role-description">
                    Authorized registration code required.
                  </small>
                </div>
              )}

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
                  "Create account"
                )}
              </button>
            </form>

            <div className="auth-register">
              <span>Already have an account?</span>

              <Link to="/login">Sign in</Link>
            </div>

            <div className="auth-security-note">
              <span>
                Account access is controlled by the IRTMS authentication and
                role-management system.
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Register;