"use client";

import { useEffect, useMemo, useState } from "react";
import { EntityPreviewModal, type PreviewTarget } from "@/components/admin/entity-preview-modal";
import { getPaginationSummary } from "@/lib/pagination-summary";
import { createClient } from "@/lib/supabase/client";

type CaptionsTableProps = {
  rows: Array<Record<string, unknown>>;
  totalCaptionCount: number;
};

type CaptionDraft = {
  content: string;
  is_public: boolean;
  is_featured: boolean;
};

const CAPTION_SELECT_COLUMNS =
  "id,content,image_id,profile_id,is_public,is_featured,caption_request_id,like_count,created_datetime_utc";
const CAPTION_PAGE_SIZE = 1000;

const EMPTY_DRAFT: CaptionDraft = {
  content: "",
  is_public: false,
  is_featured: false,
};

function firstNonEmptyString(candidates: unknown[]) {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function toNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value ?? Number.NaN);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function draftFromRow(row: Record<string, unknown>): CaptionDraft {
  return {
    content: firstNonEmptyString([row.content]) ?? "",
    is_public: row.is_public === true,
    is_featured: row.is_featured === true,
  };
}

export function CaptionsTable({
  rows: initialRows,
  totalCaptionCount: initialTotalCaptionCount,
}: CaptionsTableProps) {
  const [rows, setRows] = useState(initialRows);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCaptionCount] = useState(initialTotalCaptionCount);
  const [query, setQuery] = useState("");
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget>(null);
  const [editCaptionId, setEditCaptionId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CaptionDraft>(EMPTY_DRAFT);
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);
  const totalPages = Math.max(1, Math.ceil(totalCaptionCount / CAPTION_PAGE_SIZE));

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(normalized));
  }, [query, rows]);
  const captionPaginationSummary = getPaginationSummary({
    currentPage,
    pageSize: CAPTION_PAGE_SIZE,
    totalCount: totalCaptionCount,
    pageRowCount: rows.length,
    filteredRowCount: filteredRows.length,
    hasFilter: query.trim().length > 0,
    recordLabel: "caption records",
  });

  function closeEditModal() {
    setEditCaptionId(null);
    setEditDraft(EMPTY_DRAFT);
  }

  function updateEditDraft<K extends keyof CaptionDraft>(key: K, value: CaptionDraft[K]) {
    setEditDraft((current) => ({ ...current, [key]: value }));
  }

  function beginEdit(row: Record<string, unknown>) {
    const id = firstNonEmptyString([row.id]);
    if (!id) return;

    setEditCaptionId(id);
    setEditDraft(draftFromRow(row));
    setNotice(null);
    setError(null);
  }

  async function loadPage(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) {
      return;
    }

    setError(null);
    setIsPageLoading(true);

    const from = (page - 1) * CAPTION_PAGE_SIZE;
    const to = from + CAPTION_PAGE_SIZE - 1;
    const { data, error: loadError } = await supabase
      .from("captions")
      .select(CAPTION_SELECT_COLUMNS)
      .order("created_datetime_utc", { ascending: false })
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

  useEffect(() => {
    if (!editCaptionId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeEditModal();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [editCaptionId]);

  async function handleUpdateCaption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editCaptionId) {
      setError("Select a caption first.");
      return;
    }

    setNotice(null);
    setError(null);
    setIsUpdating(true);

    const { data, error: updateError } = await supabase
      .from("captions")
      .update({
        content: normalizeText(editDraft.content),
        is_public: editDraft.is_public,
        is_featured: editDraft.is_featured,
        modified_datetime_utc: new Date().toISOString(),
      })
      .eq("id", editCaptionId)
      .select(CAPTION_SELECT_COLUMNS)
      .single();

    if (updateError) {
      setError(updateError.message);
      setIsUpdating(false);
      return;
    }

    const updatedRow = ((data ?? {}) as Record<string, unknown>) ?? {};
    const updatedId = firstNonEmptyString([updatedRow.id]) ?? editCaptionId;
    setRows((current) =>
      current.map((row) => (firstNonEmptyString([row.id]) === updatedId ? updatedRow : row))
    );
    setNotice(`Updated caption ${updatedId}.`);
    closeEditModal();
    setIsUpdating(false);
  }

  return (
    <div className="stack-sm">
      {notice ? <p className="badge">{notice}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <div className="table-toolbar-combined">
        <label className="stack-xs table-toolbar-left">
          <span className="kicker">Filter Captions</span>
          <input
            type="search"
            placeholder="Search by text, image_id, profile_id, id"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="table-toolbar-meta">
          <p className="muted data-count">{captionPaginationSummary.primary}</p>
          {captionPaginationSummary.secondary ? (
            <p className="muted data-count">{captionPaginationSummary.secondary}</p>
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
              <th>Caption</th>
              <th>Caption ID</th>
              <th>Image ID</th>
              <th>Profile ID</th>
              <th>Likes</th>
              <th>Public</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8}>No captions found.</td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const id = firstNonEmptyString([row.id]) ?? "-";
                const imageId = firstNonEmptyString([row.image_id]) ?? "-";
                const profileId = firstNonEmptyString([row.profile_id]) ?? "-";
                const content = firstNonEmptyString([row.content]) ?? "(No content)";
                const likes = toNumber(row.like_count);
                const created = firstNonEmptyString([row.created_datetime_utc]) ?? "-";
                const isPublic = row.is_public === true;

                return (
                  <tr key={id}>
                    <td className="caption-cell">{content}</td>
                    <td>
                      <code>{id}</code>
                    </td>
                    <td>
                      {imageId === "-" ? (
                        <code>{imageId}</code>
                      ) : (
                        <button
                          type="button"
                          className="inline-code-button"
                          onClick={() => setPreviewTarget({ kind: "image", id: imageId })}
                        >
                          {imageId}
                        </button>
                      )}
                    </td>
                    <td>
                      {profileId === "-" ? (
                        <code>{profileId}</code>
                      ) : (
                        <button
                          type="button"
                          className="inline-code-button"
                          onClick={() => setPreviewTarget({ kind: "profile", id: profileId })}
                        >
                          {profileId}
                        </button>
                      )}
                    </td>
                    <td>{likes ?? "-"}</td>
                    <td>{isPublic ? <span className="badge">TRUE</span> : "FALSE"}</td>
                    <td>{created}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-compact-action"
                        onClick={() => beginEdit(row)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <EntityPreviewModal target={previewTarget} onClose={() => setPreviewTarget(null)} />

      {editCaptionId ? (
        <div className="preview-overlay" role="presentation" onClick={closeEditModal}>
          <div
            className="preview-modal panel"
            role="dialog"
            aria-modal="true"
            aria-label="Update caption"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="preview-modal-head">
              <div className="stack-xs">
                <p className="kicker">Update caption</p>
                <p className="flush-text">Editing {editCaptionId}</p>
              </div>
              <button type="button" className="preview-close" onClick={closeEditModal}>
                Close
              </button>
            </div>

            <form className="preview-modal-body stack-md" onSubmit={handleUpdateCaption}>
              <div className="form-grid">
                <label className="stack-xs">
                  <span>Caption text</span>
                  <textarea
                    value={editDraft.content}
                    onChange={(event) => updateEditDraft("content", event.target.value)}
                    placeholder="Write caption text..."
                  />
                </label>
                <label className="flex">
                  <input
                    type="checkbox"
                    checked={editDraft.is_public}
                    onChange={(event) => updateEditDraft("is_public", event.target.checked)}
                  />
                  <span>Public caption</span>
                </label>
                <label className="flex">
                  <input
                    type="checkbox"
                    checked={editDraft.is_featured}
                    onChange={(event) => updateEditDraft("is_featured", event.target.checked)}
                  />
                  <span>Featured caption</span>
                </label>
              </div>
              <div className="flex">
                <button type="submit" className="btn btn-primary btn-image-update" disabled={isUpdating}>
                  {isUpdating ? "Updating..." : "Update caption"}
                </button>
                <button type="button" className="btn btn-ghost btn-image-cancel" onClick={closeEditModal}>
                  Cancel edit
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

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
