"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState } from "react";

export type PreviewTarget =
  | {
      kind: "profile" | "image" | "caption";
      id: string;
    }
  | null;

type ProfilePreview = {
  id: string;
  label: string;
  email: string | null;
  username: string | null;
  photoUrl: string | null;
  createdAt: string | null;
  isSuperadmin: boolean;
  counts: {
    captions: number;
    images: number;
  };
  recentCaptions: Array<{
    id: string | null;
    content: string | null;
    imageId: string | null;
    likeCount: number;
    createdAt: string | null;
    isPublic: boolean;
  }>;
  recentImages: Array<{
    id: string | null;
    url: string | null;
    createdAt: string | null;
    isPublic: boolean;
    isCommonUse: boolean;
  }>;
};

type ImagePreview = {
  id: string;
  url: string | null;
  description: string | null;
  additionalContext: string | null;
  profileId: string | null;
  createdAt: string | null;
  modifiedAt: string | null;
  isPublic: boolean;
  isCommonUse: boolean;
  captionCount: number;
  owner: {
    id: string | null;
    label: string;
    photoUrl: string | null;
  } | null;
  recentCaptions: Array<{
    id: string | null;
    content: string | null;
    profileId: string | null;
    likeCount: number;
    createdAt: string | null;
    isPublic: boolean;
  }>;
};

type CaptionPreview = {
  id: string;
  content: string | null;
  likeCount: number;
  createdAt: string | null;
  isPublic: boolean;
  isFeatured: boolean;
  captionRequestId: string | null;
  profile: {
    id: string | null;
    label: string;
    photoUrl: string | null;
  } | null;
  image: {
    id: string | null;
    url: string | null;
    description: string | null;
    additionalContext: string | null;
    isPublic: boolean;
    isCommonUse: boolean;
  } | null;
};

type PreviewState =
  | {
      status: "idle";
      error: null;
      payload: null;
      cacheKey: null;
    }
  | {
      status: "error";
      error: string;
      payload: null;
      cacheKey: string;
    }
  | {
      status: "success";
      error: null;
      payload: ProfilePreview | ImagePreview | CaptionPreview;
      cacheKey: string;
    };

type EntityPreviewModalProps = {
  target: PreviewTarget;
  onClose: () => void;
};

async function parseError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload.error) return payload.error;
  } catch {
    // Ignore parse failures and fall back to the HTTP status text.
  }

  return response.statusText || "Preview request failed.";
}

function formatFlag(value: boolean) {
  return value ? "Yes" : "No";
}

function PlaceholderPhoto({ label }: { label: string }) {
  const initial = label.trim().charAt(0).toUpperCase() || "U";
  return <div className="preview-photo preview-photo-placeholder">{initial}</div>;
}

function ProfilePreviewPanel({ data, onClose }: { data: ProfilePreview; onClose: () => void }) {
  return (
    <>
      <div className="preview-header">
        {data.photoUrl ? (
          <img src={data.photoUrl} alt={data.label} className="preview-photo" />
        ) : (
          <PlaceholderPhoto label={data.label} />
        )}

        <div className="preview-header-copy">
          <p className="kicker">Profile Preview</p>
          <h2 className="panel-heading">{data.label}</h2>
          <p className="flush-text">
            {data.email ?? "No email available"}
            {data.username ? ` · @${data.username}` : ""}
          </p>
        </div>
      </div>

      <div className="preview-meta-grid">
        <div>
          <span>ID</span>
          <strong>{data.id}</strong>
        </div>
        <div>
          <span>Superadmin</span>
          <strong>{formatFlag(data.isSuperadmin)}</strong>
        </div>
        <div>
          <span>Images</span>
          <strong>{data.counts.images}</strong>
        </div>
        <div>
          <span>Captions</span>
          <strong>{data.counts.captions}</strong>
        </div>
        <div>
          <span>Created</span>
          <strong>{data.createdAt ?? "-"}</strong>
        </div>
      </div>

      <div className="preview-actions">
        <Link href={`/admin/users/${data.id}`} className="btn btn-primary" onClick={onClose}>
          Open user page
        </Link>
      </div>

      <section className="preview-section stack-sm">
        <p className="kicker">Recent Captions</p>
        {data.recentCaptions.length === 0 ? (
          <p className="flush-text">No captions found for this profile.</p>
        ) : (
          <ul className="preview-list">
            {data.recentCaptions.map((caption, index) => (
              <li key={`${caption.id ?? "caption"}-${index}`} className="preview-list-item">
                <strong className="preview-caption-id">{caption.id ?? "Unknown caption"}</strong>
                <p className="preview-caption-text">{caption.content ?? "(No content)"}</p>
                <span>
                  Image {caption.imageId ?? "-"} · Likes {caption.likeCount} · Public{" "}
                  {formatFlag(caption.isPublic)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="preview-section stack-sm">
        <p className="kicker">Recent Images</p>
        {data.recentImages.length === 0 ? (
          <p className="flush-text">No images found for this profile.</p>
        ) : (
          <ul className="preview-list">
            {data.recentImages.map((image, index) => (
              <li key={`${image.id ?? "image"}-${index}`} className="preview-list-item">
                <strong>{image.id ?? "Unknown image"}</strong>
                <p>{image.url ?? "No image URL available."}</p>
                <span>
                  Public {formatFlag(image.isPublic)} · Common use {formatFlag(image.isCommonUse)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function ImagePreviewPanel({ data }: { data: ImagePreview }) {
  return (
    <>
      <div className="preview-header">
        {data.url ? (
          <img src={data.url} alt={data.id} className="preview-photo preview-photo-image" />
        ) : (
          <PlaceholderPhoto label="Image" />
        )}

        <div className="preview-header-copy">
          <p className="kicker">Image Preview</p>
          <h2 className="panel-heading">{data.id}</h2>
          <p className="flush-text">{data.description ?? "No image description."}</p>
        </div>
      </div>

      <div className="preview-meta-grid">
        <div>
          <span>Owner</span>
          <strong>{data.owner?.label ?? data.profileId ?? "Unknown"}</strong>
        </div>
        <div>
          <span>Captions</span>
          <strong>{data.captionCount}</strong>
        </div>
        <div>
          <span>Public</span>
          <strong>{formatFlag(data.isPublic)}</strong>
        </div>
        <div>
          <span>Common Use</span>
          <strong>{formatFlag(data.isCommonUse)}</strong>
        </div>
        <div>
          <span>Created</span>
          <strong>{data.createdAt ?? "-"}</strong>
        </div>
        <div>
          <span>Modified</span>
          <strong>{data.modifiedAt ?? "-"}</strong>
        </div>
      </div>

      <div className="preview-actions">
        {data.owner?.id ? (
          <Link href={`/admin/users/${data.owner.id}`} className="btn btn-primary">
            Open owner profile
          </Link>
        ) : null}
        {data.url ? (
          <a href={data.url} target="_blank" rel="noreferrer" className="btn btn-ghost">
            Open image URL
          </a>
        ) : null}
      </div>

      {data.additionalContext ? (
        <section className="preview-section stack-sm">
          <p className="kicker">Additional Context</p>
          <p className="flush-text">{data.additionalContext}</p>
        </section>
      ) : null}

      <section className="preview-section stack-sm">
        <p className="kicker">Recent Captions On This Image</p>
        {data.recentCaptions.length === 0 ? (
          <p className="flush-text">No captions found for this image.</p>
        ) : (
          <ul className="preview-list">
            {data.recentCaptions.map((caption, index) => (
              <li key={`${caption.id ?? "caption"}-${index}`} className="preview-list-item">
                <strong className="preview-caption-id">{caption.id ?? "Unknown caption"}</strong>
                <p className="preview-caption-text">{caption.content ?? "(No content)"}</p>
                <span>
                  Profile {caption.profileId ?? "-"} · Likes {caption.likeCount} · Public{" "}
                  {formatFlag(caption.isPublic)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function CaptionPreviewPanel({ data }: { data: CaptionPreview }) {
  return (
    <>
      <div className="preview-header">
        {data.image?.url ? (
          <img src={data.image.url} alt={data.id} className="preview-photo preview-photo-image" />
        ) : (
          <PlaceholderPhoto label="Caption" />
        )}

        <div className="preview-header-copy">
          <p className="kicker">Caption Preview</p>
          <h2 className="panel-heading">{data.content ?? "(No caption text)"}</h2>
          <p className="flush-text">{data.id}</p>
        </div>
      </div>

      <div className="preview-meta-grid">
        <div>
          <span>Score</span>
          <strong>{data.likeCount}</strong>
        </div>
        <div>
          <span>Author</span>
          <strong>{data.profile?.label ?? "Unknown"}</strong>
        </div>
        <div>
          <span>Public</span>
          <strong>{formatFlag(data.isPublic)}</strong>
        </div>
        <div>
          <span>Featured</span>
          <strong>{formatFlag(data.isFeatured)}</strong>
        </div>
        <div>
          <span>Created</span>
          <strong>{data.createdAt ?? "-"}</strong>
        </div>
        <div>
          <span>Request ID</span>
          <strong>{data.captionRequestId ?? "-"}</strong>
        </div>
      </div>

      <div className="preview-actions">
        {data.profile?.id ? (
          <Link href={`/admin/users/${data.profile.id}`} className="btn btn-primary">
            Open author profile
          </Link>
        ) : null}
        {data.image?.url ? (
          <a href={data.image.url} target="_blank" rel="noreferrer" className="btn btn-ghost">
            Open image URL
          </a>
        ) : null}
      </div>

      {data.image ? (
        <section className="preview-section stack-sm">
          <p className="kicker">Image</p>
          {data.image.url ? <img src={data.image.url} alt={data.id} className="preview-feature-image" /> : null}
          <p className="flush-text">{data.image.description ?? "No image description."}</p>
          {data.image.additionalContext ? (
            <p className="flush-text">{data.image.additionalContext}</p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

export function EntityPreviewModal({ target, onClose }: EntityPreviewModalProps) {
  const [state, setState] = useState<PreviewState>({
    status: "idle",
    error: null,
    payload: null,
    cacheKey: null,
  });

  useEffect(() => {
    if (!target) return;

    const activeTarget = target;
    const controller = new AbortController();
    const cacheKey = `${activeTarget.kind}:${activeTarget.id}`;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    async function loadPreview() {
      const resource =
        activeTarget.kind === "profile"
          ? "profiles"
          : activeTarget.kind === "image"
            ? "images"
            : "captions";

      try {
        const response = await fetch(`/admin/api/${resource}/${activeTarget.id}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorMessage = await parseError(response);
          setState({ status: "error", error: errorMessage, payload: null, cacheKey });
          return;
        }

        const payload = (await response.json()) as ProfilePreview | ImagePreview | CaptionPreview;
        setState({ status: "success", error: null, payload, cacheKey });
      } catch (error) {
        if (controller.signal.aborted) return;

        const message = error instanceof Error ? error.message : "Preview request failed.";
        setState({ status: "error", error: message, payload: null, cacheKey });
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    void loadPreview();
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      controller.abort();
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, target]);

  if (!target) return null;

  const activeCacheKey = `${target.kind}:${target.id}`;
  const isLoading = state.cacheKey !== activeCacheKey;

  return (
    <div className="preview-overlay" role="presentation" onClick={onClose}>
      <div
        className="preview-modal panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${target.kind} preview`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="preview-modal-head">
          <p className="kicker">Quick View</p>
          <button type="button" className="preview-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="preview-modal-body stack-md">
          {isLoading ? <p className="flush-text">Loading preview...</p> : null}
          {state.status === "error" ? <p className="error-text">{state.error}</p> : null}
          {!isLoading && state.status === "success" && target.kind === "profile" ? (
            <ProfilePreviewPanel data={state.payload as ProfilePreview} onClose={onClose} />
          ) : null}
          {!isLoading && state.status === "success" && target.kind === "image" ? (
            <ImagePreviewPanel data={state.payload as ImagePreview} />
          ) : null}
          {!isLoading && state.status === "success" && target.kind === "caption" ? (
            <CaptionPreviewPanel data={state.payload as CaptionPreview} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
