"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import { EntityPreviewModal, type PreviewTarget } from "@/components/admin/entity-preview-modal";
import {
  getProfileCreatedAt,
  getProfileEmail,
  getProfileLabel,
  getProfilePhotoUrl,
  getProfileUsername,
} from "@/lib/profile-display";

type UserProfileViewProps = {
  profile: Record<string, unknown>;
  captionCount: number;
  imageCount: number;
  captions: Array<Record<string, unknown>>;
  images: Array<Record<string, unknown>>;
  errors?: string[];
};

function textValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function numberValue(value: unknown) {
  const n = typeof value === "number" ? value : Number(value ?? Number.NaN);
  return Number.isFinite(n) ? n : null;
}

function boolLabel(value: unknown) {
  return value === true ? "Yes" : "No";
}

function PlaceholderPhoto({ label }: { label: string }) {
  const initial = label.trim().charAt(0).toUpperCase() || "U";
  return <div className="preview-photo preview-photo-placeholder profile-hero-photo">{initial}</div>;
}

export function UserProfileView({
  profile,
  captionCount,
  imageCount,
  captions,
  images,
  errors = [],
}: UserProfileViewProps) {
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget>(null);

  const isSuperadmin = profile.is_superadmin === true;
  const id = textValue(profile.id) ?? "-";
  const label = getProfileLabel(profile, id);
  const email = getProfileEmail(profile);
  const username = getProfileUsername(profile);
  const photoUrl = getProfilePhotoUrl(profile);
  const createdAt = getProfileCreatedAt(profile);
  const superadminStatusClass = isSuperadmin ? "status-word status-word-success" : "status-word status-word-danger";

  return (
    <section className="stack-md">
      <div className="panel panel-pad stack-sm">
        <Link href="/admin/users" className="inline-admin-link">
          Back to profiles
        </Link>
        <p className="kicker">Profile Detail</p>

        <div className="profile-hero">
          {photoUrl ? (
            <img src={photoUrl} alt={label} className="profile-hero-photo" />
          ) : (
            <PlaceholderPhoto label={label} />
          )}

          <div className="profile-hero-copy">
            <h1 className="title section-title profile-hero-title">{label}</h1>
            <div className="profile-hero-meta">
              <p className="section-copy">
                {email ?? "No email recorded"}
                {username ? ` · @${username}` : ""}
              </p>
            </div>
            <div className="profile-hero-status">
              <span className="badge superadmin-badge">
                <span>Superadmin</span>
                <span className={superadminStatusClass}>{boolLabel(profile.is_superadmin)}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {errors.length > 0 ? (
        <div className="panel panel-pad stack-sm">
          <p className="kicker">Query Warnings</p>
          {errors.map((error) => (
            <p key={error} className="error-text">
              {error}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cards">
        <article className="stat-card">
          <p className="stat-label">Captions</p>
          <p className="stat-value">{captionCount}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Images</p>
          <p className="stat-value">{imageCount}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Profile ID</p>
          <p className="stat-value profile-stat-copy">{id === "-" ? "-" : id.slice(0, 8)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Created</p>
          <p className="stat-value profile-stat-copy">{createdAt ?? "-"}</p>
        </article>
      </div>

      <div className="grid feature-grid">
        <article className="panel panel-pad stack-sm">
          <p className="kicker">Basic Info</p>
          <div className="preview-meta-grid">
            <div>
              <span>Email</span>
              <strong>{email ?? "-"}</strong>
            </div>
            <div>
              <span>Username</span>
              <strong>{username ? `@${username}` : "-"}</strong>
            </div>
            <div>
              <span>Superadmin</span>
              <strong>
                <span className={superadminStatusClass}>{boolLabel(profile.is_superadmin)}</span>
              </strong>
            </div>
            <div>
              <span>Profile photo</span>
              <strong>{photoUrl ? "Available" : "Missing"}</strong>
            </div>
          </div>
        </article>

        <article className="panel panel-pad stack-sm">
          <p className="kicker">Recent Images</p>
          {images.length === 0 ? (
            <p className="flush-text">No images found for this user.</p>
          ) : (
            <div className="profile-image-grid">
              {images.map((image) => {
                const imageId = textValue(image.id) ?? "-";
                const imageUrl = textValue(image.url);

                return (
                  <article key={imageId} className="profile-image-card">
                    {imageUrl ? (
                      <img src={imageUrl} alt={imageId} className="profile-image-thumb" />
                    ) : (
                      <div className="profile-image-thumb profile-image-thumb-empty">No image</div>
                    )}
                    <button
                      type="button"
                      className="inline-code-button"
                      onClick={() => (imageId === "-" ? undefined : setPreviewTarget({ kind: "image", id: imageId }))}
                      disabled={imageId === "-"}
                    >
                      {imageId}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </article>
      </div>

      <div className="panel panel-pad stack-sm">
        <p className="kicker">Recent Captions</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Caption ID</th>
                <th>Image ID</th>
                <th>Caption</th>
                <th>Likes</th>
                <th>Public</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {captions.length === 0 ? (
                <tr>
                  <td colSpan={6}>No captions found for this user.</td>
                </tr>
              ) : (
                captions.map((caption) => {
                  const captionId = textValue(caption.id) ?? "-";
                  const imageId = textValue(caption.image_id) ?? "-";
                  const content = textValue(caption.content) ?? "(No content)";
                  const likes = numberValue(caption.like_count);
                  const created = textValue(caption.created_datetime_utc) ?? "-";

                  return (
                    <tr key={captionId}>
                      <td>
                        <code>{captionId}</code>
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
                      <td className="caption-cell">{content}</td>
                      <td>{likes ?? "-"}</td>
                      <td>{caption.is_public === true ? <span className="badge">TRUE</span> : "FALSE"}</td>
                      <td>{created}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EntityPreviewModal target={previewTarget} onClose={() => setPreviewTarget(null)} />
    </section>
  );
}
