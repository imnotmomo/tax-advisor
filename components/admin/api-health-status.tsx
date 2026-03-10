"use client";

import { useEffect, useState } from "react";

type HealthState =
  | {
      status: "checking";
      detail: string;
    }
  | {
      status: "healthy";
      detail: string;
    }
  | {
      status: "unhealthy";
      detail: string;
    };

function getStatusLabel(status: HealthState["status"]) {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "unhealthy":
      return "Unavailable";
    default:
      return "Checking";
  }
}

function getStatusClassName(status: HealthState["status"]) {
  if (status === "healthy") {
    return "status-word status-word-success";
  }

  if (status === "unhealthy") {
    return "status-word status-word-danger";
  }

  return "status-word";
}

export function ApiHealthStatus() {
  const [health, setHealth] = useState<HealthState>({
    status: "checking",
    detail: "Checking backend /health.",
  });

  useEffect(() => {
    let disposed = false;

    async function loadHealth() {
      try {
        const response = await fetch("/api/tax-advisor", {
          method: "GET",
          cache: "no-store",
        });

        const data = (await response.json().catch(() => null)) as
          | { ok?: unknown; healthy?: unknown; error?: unknown }
          | null;

        if (!response.ok || data?.healthy !== true) {
          const detail =
            typeof data?.error === "string" && data.error.trim().length > 0
              ? data.error
              : "Backend /health is not reachable.";

          if (!disposed) {
            setHealth({
              status: "unhealthy",
              detail,
            });
          }

          return;
        }

        if (!disposed) {
          setHealth({
            status: "healthy",
            detail: "",
          });
        }
      } catch {
        if (!disposed) {
          setHealth({
            status: "unhealthy",
            detail: "Backend /health is not reachable.",
          });
        }
      }
    }

    void loadHealth();
    const intervalId = window.setInterval(() => {
      void loadHealth();
    }, 30000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="admin-profile-block" aria-live="polite">
      <span>API Health</span>
      <strong className={getStatusClassName(health.status)}>{getStatusLabel(health.status)}</strong>
      {health.detail ? <p>{health.detail}</p> : null}
    </div>
  );
}
