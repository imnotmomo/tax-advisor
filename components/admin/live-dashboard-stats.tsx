"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import type { DashboardStats } from "@/lib/dashboard-stats";

const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const STAT_KEYS = [
  "profiles",
  "superadmins",
  "images",
  "captions",
  "captionsPerImage",
  "publicImageRatio",
] as const;

type StatKey = (typeof STAT_KEYS)[number];

type LiveDashboardStatsProps = {
  initialStats: DashboardStats;
};

function formatStatValue(key: StatKey, value: number) {
  if (key === "captionsPerImage") {
    return value.toFixed(2);
  }

  if (key === "publicImageRatio") {
    return percentFormatter.format(value);
  }

  return numberFormatter.format(value);
}

const STAT_CONFIG: Array<{ key: StatKey; label: string }> = [
  { key: "profiles", label: "Profiles" },
  { key: "superadmins", label: "Superadmins" },
  { key: "images", label: "Images" },
  { key: "captions", label: "Captions" },
  { key: "captionsPerImage", label: "Captions / Image" },
  { key: "publicImageRatio", label: "Public Image Ratio" },
];

async function parseError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload.error) return payload.error;
  } catch {
    // Ignore parse failures and fall back to a generic error.
  }

  return "Could not refresh dashboard stats.";
}

export function LiveDashboardStats({ initialStats }: LiveDashboardStatsProps) {
  const [stats, setStats] = useState(initialStats);
  const [changedKeys, setChangedKeys] = useState<Set<StatKey>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const statsRef = useRef(initialStats);
  const timeoutsRef = useRef<Record<StatKey, number | undefined>>({
    profiles: undefined,
    superadmins: undefined,
    images: undefined,
    captions: undefined,
    captionsPerImage: undefined,
    publicImageRatio: undefined,
  });

  useEffect(() => {
    let isActive = true;
    let nextPollId: number | undefined;
    const timeoutHandles = timeoutsRef.current;

    async function poll() {
      try {
        const response = await fetch("/admin/api/dashboard/stats", {
          cache: "no-store",
        });

        if (!response.ok) {
          const message = await parseError(response);
          if (isActive) {
            setError(message);
          }
          return;
        }

        const nextStats = (await response.json()) as DashboardStats;
        if (!isActive) return;

        const changed = STAT_KEYS.filter((key) => nextStats[key] !== statsRef.current[key]);
        statsRef.current = nextStats;

        startTransition(() => {
          setStats(nextStats);
        });

        if (changed.length > 0) {
          setChangedKeys((current) => {
            const next = new Set(current);
            changed.forEach((key) => next.add(key));
            return next;
          });

          changed.forEach((key) => {
            if (timeoutHandles[key]) {
              window.clearTimeout(timeoutHandles[key]);
            }

            timeoutHandles[key] = window.setTimeout(() => {
              setChangedKeys((current) => {
                const next = new Set(current);
                next.delete(key);
                return next;
              });
            }, 900);
          });
        }

        setError(null);
      } catch (pollError) {
        if (!isActive) return;
        const message =
          pollError instanceof Error ? pollError.message : "Could not refresh dashboard stats.";
        setError(message);
      } finally {
        if (isActive) {
          nextPollId = window.setTimeout(poll, 2000);
        }
      }
    }

    nextPollId = window.setTimeout(poll, 2000);

    return () => {
      isActive = false;
      if (nextPollId) {
        window.clearTimeout(nextPollId);
      }

      STAT_KEYS.forEach((key) => {
        if (timeoutHandles[key]) {
          window.clearTimeout(timeoutHandles[key]);
        }
      });
    };
  }, []);

  return (
    <div className="stack-sm">
      <div className="grid grid-cards">
        {STAT_CONFIG.map((stat) => {
          const isChanged = changedKeys.has(stat.key);

          return (
            <article
              key={stat.key}
              className={isChanged ? "stat-card stat-card-updated" : "stat-card"}
            >
              <p className="stat-label">{stat.label}</p>
              <p className={isChanged ? "stat-value stat-value-updated" : "stat-value"}>
                {formatStatValue(stat.key, stats[stat.key])}
              </p>
            </article>
          );
        })}
      </div>

      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
