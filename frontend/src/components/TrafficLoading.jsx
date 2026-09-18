import React from "react";

export default function TrafficLoading({
  title = "Processing traffic data",
  message = "Please wait while IRTMS completes the request.",
  fullScreen = true,
}) {
  return (
    <div
      className={`irtms-traffic-loading${
        fullScreen ? " irtms-traffic-loading-fullscreen" : ""
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="irtms-traffic-loading-card">
        <div className="irtms-loader-scene" aria-hidden="true">
          <div className="irtms-loader-road">
            <span className="irtms-loader-road-line" />
          </div>

          <div className="irtms-loader-car">
            <span className="irtms-loader-window" />
            <span className="irtms-loader-wheel irtms-loader-wheel-left" />
            <span className="irtms-loader-wheel irtms-loader-wheel-right" />
          </div>
        </div>

        <h3 className="irtms-traffic-loading-title">
          {title}
        </h3>

        <p className="irtms-traffic-loading-message">
          {message}
        </p>

        <div className="irtms-loader-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}