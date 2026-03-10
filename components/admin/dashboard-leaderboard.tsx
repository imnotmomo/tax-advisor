"use client";

import { useState } from "react";
import { EntityPreviewModal, type PreviewTarget } from "@/components/admin/entity-preview-modal";

const numberFormatter = new Intl.NumberFormat("en-US");

type LeaderboardProfile = {
  id: string | null;
  label: string;
  count: number;
};

type LeaderboardCaption = {
  id: string | null;
  content: string;
  count: number;
};

type DashboardLeaderboardProps = {
  topUploader: LeaderboardProfile | null;
  topRatingUser: LeaderboardProfile | null;
  mostLikedCaption: LeaderboardCaption | null;
  mostDislikedCaption: LeaderboardCaption | null;
};

function captionPreviewLabel(content: string) {
  const trimmed = content.trim();
  if (trimmed.length <= 96) return trimmed;
  return `${trimmed.slice(0, 96)}...`;
}

export function DashboardLeaderboard({
  topUploader,
  topRatingUser,
  mostLikedCaption,
  mostDislikedCaption,
}: DashboardLeaderboardProps) {
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget>(null);
  const topUploaderId = topUploader?.id ?? null;
  const topRatingUserId = topRatingUser?.id ?? null;
  const mostLikedCaptionId = mostLikedCaption?.id ?? null;
  const mostDislikedCaptionId = mostDislikedCaption?.id ?? null;

  return (
    <>
      <article className="panel panel-pad stack-sm">
        <p className="kicker">Leaderboard</p>
        <p className="metric-line">
          Top uploader:{" "}
          {topUploaderId ? (
            <button
              type="button"
              className="inline-underlined-button"
              onClick={() => setPreviewTarget({ kind: "profile", id: topUploaderId })}
            >
              {topUploader?.label}
            </button>
          ) : (
            <strong>{topUploader?.label ?? "Unknown"}</strong>
          )}{" "}
          ({numberFormatter.format(topUploader?.count ?? 0)} images)
        </p>
        <p className="metric-line">
          Top rating sender:{" "}
          {topRatingUserId ? (
            <button
              type="button"
              className="inline-underlined-button"
              onClick={() => setPreviewTarget({ kind: "profile", id: topRatingUserId })}
            >
              {topRatingUser?.label}
            </button>
          ) : (
            <strong>{topRatingUser?.label ?? "Unknown"}</strong>
          )}{" "}
          ({numberFormatter.format(topRatingUser?.count ?? 0)} ratings)
        </p>
        <p className="metric-line metric-line-truncate">
          <span className="metric-line-prefix">Most liked caption:</span>
          {mostLikedCaptionId ? (
            <button
              type="button"
              className="inline-underlined-button inline-caption-metric-button"
              onClick={() => setPreviewTarget({ kind: "caption", id: mostLikedCaptionId })}
              title={mostLikedCaption?.content ?? "Unknown caption"}
            >
              {captionPreviewLabel(mostLikedCaption?.content ?? "Unknown caption")}
            </button>
          ) : (
            <strong className="inline-caption-metric-button">
              {mostLikedCaption?.content ?? "Unknown caption"}
            </strong>
          )}
          <span className="metric-line-meta">
            ({numberFormatter.format(mostLikedCaption?.count ?? 0)} likes)
          </span>
        </p>
        <p className="metric-line metric-line-truncate">
          <span className="metric-line-prefix">Most disliked caption:</span>
          {mostDislikedCaptionId ? (
            <button
              type="button"
              className="inline-underlined-button inline-caption-metric-button"
              onClick={() => setPreviewTarget({ kind: "caption", id: mostDislikedCaptionId })}
              title={mostDislikedCaption?.content ?? "Unknown caption"}
            >
              {captionPreviewLabel(mostDislikedCaption?.content ?? "Unknown caption")}
            </button>
          ) : (
            <strong className="inline-caption-metric-button">
              {mostDislikedCaption?.content ?? "Unknown caption"}
            </strong>
          )}
          <span className="metric-line-meta">
            ({numberFormatter.format(mostDislikedCaption?.count ?? 0)} dislikes)
          </span>
        </p>
      </article>

      <EntityPreviewModal target={previewTarget} onClose={() => setPreviewTarget(null)} />
    </>
  );
}
