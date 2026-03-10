"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EntityPreviewModal, type PreviewTarget } from "@/components/admin/entity-preview-modal";
import { getPaginationSummary } from "@/lib/pagination-summary";
import { getProfileLabel } from "@/lib/profile-display";
import { createClient } from "@/lib/supabase/client";

type UsersTableProps = {
  rows: Array<Record<string, unknown>>;
  totalProfileCount: number;
};

const PROFILE_PAGE_SIZE = 1000;

function firstNonEmptyString(candidates: unknown[]) {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

export function UsersTable({ rows: initialRows, totalProfileCount }: UsersTableProps) {
  const [rows, setRows] = useState(initialRows);
  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState("");
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget>(null);
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(false);

  const supabase = useMemo(() => createClient(), []);
  const totalPages = Math.max(1, Math.ceil(totalProfileCount / PROFILE_PAGE_SIZE));

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;

    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(normalized));
  }, [query, rows]);
  const profilePaginationSummary = getPaginationSummary({
    currentPage,
    pageSize: PROFILE_PAGE_SIZE,
    totalCount: totalProfileCount,
    pageRowCount: rows.length,
    filteredRowCount: filteredRows.length,
    hasFilter: query.trim().length > 0,
    recordLabel: "profile records",
  });

  async function loadPage(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) {
      return;
    }

    setError(null);
    setIsPageLoading(true);

    const from = (page - 1) * PROFILE_PAGE_SIZE;
    const to = from + PROFILE_PAGE_SIZE - 1;
    const { data, error: loadError } = await supabase
      .from("profiles")
      .select("*")
      .order("id", { ascending: true })
      .range(from, to);

    if (loadError) {
      setError(loadError.message);
      setIsPageLoading(false);
      return;
    }

    setRows(((data ?? []) as Array<Record<string, unknown>>) ?? []);
    setCurrentPage(page);
    setIsPageLoading(false);
  }

  useEffect(() => {
    function handleScroll() {
      setShowScrollTopButton(window.scrollY > 420);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div className="stack-sm">
      {error ? <p className="error-text">{error}</p> : null}

      <div className="table-toolbar-combined">
        <label className="stack-xs table-toolbar-left">
          <span className="kicker">Filter Profiles</span>
          <input
            type="search"
            placeholder="Search by name, email, id, or any raw field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="table-toolbar-meta">
          <p className="muted data-count">{profilePaginationSummary.primary}</p>
          {profilePaginationSummary.secondary ? (
            <p className="muted data-count">{profilePaginationSummary.secondary}</p>
          ) : null}
          <div className="table-pagination">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => loadPage(currentPage - 1)}
              disabled={currentPage === 1 || isPageLoading}
            >
              Previous
            </button>
            <p className="muted data-count">
              Page {currentPage} of {totalPages}
            </p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => loadPage(currentPage + 1)}
              disabled={currentPage === totalPages || isPageLoading}
            >
              {isPageLoading ? "Loading..." : "Next"}
            </button>
          </div>
        </div>
      </div>

      <div className="table-wrap panel panel-pad">
        <table>
          <thead>
            <tr>
              <th>Profile</th>
              <th>ID</th>
              <th>Email</th>
              <th>Superadmin</th>
              <th>Created</th>
              <th>Open</th>
              <th>Raw</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7}>No profiles found.</td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const id = typeof row.id === "string" ? row.id : "-";
                const email = firstNonEmptyString([row.email]) ?? "-";
                const created = firstNonEmptyString([row.created_datetime_utc]) ?? "-";
                const isSuperadmin = row.is_superadmin === true;
                const label = getProfileLabel(row, id);

                return (
                  <tr key={id}>
                    <td>
                      {id === "-" ? (
                        label
                      ) : (
                        <button
                          type="button"
                          className="inline-text-button"
                          onClick={() => setPreviewTarget({ kind: "profile", id })}
                        >
                          {label}
                        </button>
                      )}
                    </td>
                    <td>
                      {id === "-" ? (
                        <code>{id}</code>
                      ) : (
                        <button
                          type="button"
                          className="inline-code-button"
                          onClick={() => setPreviewTarget({ kind: "profile", id })}
                        >
                          {id}
                        </button>
                      )}
                    </td>
                    <td>{email}</td>
                    <td>{isSuperadmin ? <span className="badge">TRUE</span> : "FALSE"}</td>
                    <td>{created}</td>
                    <td>
                      {id === "-" ? null : (
                        <Link href={`/admin/users/${id}`} className="inline-admin-link">
                          View page
                        </Link>
                      )}
                    </td>
                    <td>
                      <details>
                        <summary>View</summary>
                        <pre className="raw-json">{JSON.stringify(row, null, 2)}</pre>
                      </details>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <EntityPreviewModal target={previewTarget} onClose={() => setPreviewTarget(null)} />

      {showScrollTopButton ? (
        <button
          type="button"
          className="btn btn-ghost floating-scroll-top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
        >
          Top
        </button>
      ) : null}
    </div>
  );
}
