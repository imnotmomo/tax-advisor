"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { EntityPreviewModal, type PreviewTarget } from "@/components/admin/entity-preview-modal";
import { getPaginationSummary } from "@/lib/pagination-summary";
import { createClient } from "@/lib/supabase/client";

type ImageRecord = {
  id: string;
  url: string | null;
  image_description: string | null;
  additional_context: string | null;
  is_common_use: boolean;
  is_public: boolean;
  profile_id: string | null;
  created_datetime_utc: string | null;
  modified_datetime_utc: string | null;
};

type ImagesManagerProps = {
  initialImages: ImageRecord[];
  totalImageCount: number;
};

type ImageDraft = {
  url: string;
  image_description: string;
  additional_context: string;
  is_common_use: boolean;
  is_public: boolean;
};

type GeneratePresignedUrlResponse = {
  presignedUrl?: string;
  cdnUrl?: string;
};

type RegisterImageResponse = {
  imageId?: string;
  now?: number;
};

const IMAGE_SELECT_COLUMNS =
  "id,url,image_description,additional_context,is_common_use,is_public,profile_id,created_datetime_utc,modified_datetime_utc";
const UPLOAD_API_BASE_URL = "https://api.almostcrackd.ai";
const IMAGE_PAGE_SIZE = 1000;
const SUPPORTED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
] as const;

type SupportedImageContentType = (typeof SUPPORTED_IMAGE_CONTENT_TYPES)[number];

const SUPPORTED_IMAGE_CONTENT_TYPE_SET = new Set<string>(SUPPORTED_IMAGE_CONTENT_TYPES);
const IMAGE_CONTENT_TYPE_BY_EXTENSION: Record<string, SupportedImageContentType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
};

function normalizeText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveUploadContentType(file: File): SupportedImageContentType | null {
  const normalizedType = file.type.toLowerCase();
  if (SUPPORTED_IMAGE_CONTENT_TYPE_SET.has(normalizedType)) {
    return normalizedType as SupportedImageContentType;
  }

  if (normalizedType === "image/pjpeg") {
    return "image/jpeg";
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_CONTENT_TYPE_BY_EXTENSION[extension] ?? null;
}

function getErrorMessageFromPayload(payload: unknown) {
  if (!payload) return null;

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  for (const key of ["message", "error", "detail"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

async function readJsonBody(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function buildApiError(response: Response, fallback: string) {
  const payload = await readJsonBody(response);
  const detail = getErrorMessageFromPayload(payload);
  if (detail) {
    return `${fallback}: ${detail}`;
  }

  return `${fallback} (HTTP ${response.status})`;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function mapRow(raw: Record<string, unknown>): ImageRecord {
  return {
    id: typeof raw.id === "string" ? raw.id : String(raw.id ?? ""),
    url: typeof raw.url === "string" ? raw.url : null,
    image_description: typeof raw.image_description === "string" ? raw.image_description : null,
    additional_context: typeof raw.additional_context === "string" ? raw.additional_context : null,
    is_common_use: raw.is_common_use === true,
    is_public: raw.is_public === true,
    profile_id: typeof raw.profile_id === "string" ? raw.profile_id : null,
    created_datetime_utc:
      typeof raw.created_datetime_utc === "string" ? raw.created_datetime_utc : null,
    modified_datetime_utc:
      typeof raw.modified_datetime_utc === "string" ? raw.modified_datetime_utc : null,
  };
}

function draftFromImage(image: ImageRecord): ImageDraft {
  return {
    url: image.url ?? "",
    image_description: image.image_description ?? "",
    additional_context: image.additional_context ?? "",
    is_common_use: image.is_common_use,
    is_public: image.is_public,
  };
}

const EMPTY_DRAFT: ImageDraft = {
  url: "",
  image_description: "",
  additional_context: "",
  is_common_use: false,
  is_public: false,
};

export function ImagesManager({ initialImages, totalImageCount: initialTotalImageCount }: ImagesManagerProps) {
  const [images, setImages] = useState<ImageRecord[]>(initialImages);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalImageCount, setTotalImageCount] = useState(initialTotalImageCount);
  const [createDraft, setCreateDraft] = useState<ImageDraft>(EMPTY_DRAFT);
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [editImageId, setEditImageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ImageDraft>(EMPTY_DRAFT);
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget>(null);
  const [lightboxImage, setLightboxImage] = useState<ImageRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createFileInputRef = useRef<HTMLInputElement | null>(null);

  const supabase = useMemo(() => createClient(), []);
  const totalPages = Math.max(1, Math.ceil(totalImageCount / IMAGE_PAGE_SIZE));

  const filteredImages = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return images;

    return images.filter((image) => {
      const blob = JSON.stringify(image).toLowerCase();
      return blob.includes(normalized);
    });
  }, [images, searchQuery]);
  const imagePaginationSummary = getPaginationSummary({
    currentPage,
    pageSize: IMAGE_PAGE_SIZE,
    totalCount: totalImageCount,
    pageRowCount: images.length,
    filteredRowCount: filteredImages.length,
    hasFilter: searchQuery.trim().length > 0,
    recordLabel: "image records",
  });

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

  function updateEditDraft<K extends keyof ImageDraft>(key: K, value: ImageDraft[K]) {
    setEditDraft((current) => ({ ...current, [key]: value }));
  }

  function updateCreateDraft<K extends keyof ImageDraft>(key: K, value: ImageDraft[K]) {
    setCreateDraft((current) => ({ ...current, [key]: value }));
  }

  function closeEditModal() {
    setEditImageId(null);
    setEditDraft(EMPTY_DRAFT);
  }

  async function loadPage(page: number, force = false) {
    if (page < 1 || page > totalPages || (!force && page === currentPage)) {
      return;
    }

    setError(null);
    setIsPageLoading(true);

    const from = (page - 1) * IMAGE_PAGE_SIZE;
    const to = from + IMAGE_PAGE_SIZE - 1;
    const { data, error: loadError } = await supabase
      .from("images")
      .select(IMAGE_SELECT_COLUMNS)
      .order("created_datetime_utc", { ascending: false })
      .range(from, to);

    if (loadError) {
      setError(loadError.message);
      setIsPageLoading(false);
      return;
    }

    setImages((((data ?? []) as Array<Record<string, unknown>>) ?? []).map((row) => mapRow(row)));
    setCurrentPage(page);
    setIsPageLoading(false);
  }

  useEffect(() => {
    if (!editImageId && !lightboxImage) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (lightboxImage) {
          setLightboxImage(null);
          return;
        }

        closeEditModal();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [editImageId, lightboxImage]);

  function beginEdit(image: ImageRecord) {
    setEditImageId(image.id);
    setEditDraft(draftFromImage(image));
    setNotice(null);
    setError(null);
  }

  async function waitForImageRecord(imageId: string) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data, error: loadError } = await supabase
        .from("images")
        .select(IMAGE_SELECT_COLUMNS)
        .eq("id", imageId)
        .maybeSingle();

      if (loadError) {
        throw new Error(loadError.message);
      }

      if (data) {
        return mapRow((data ?? {}) as Record<string, unknown>);
      }

      await sleep(350);
    }

    throw new Error("Uploaded image was registered but is not yet visible in the dataset.");
  }

  async function handleCreateImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);
    setCreateStatus(null);

    if (!createFile) {
      setError("Choose an image file first.");
      return;
    }

    const contentType = resolveUploadContentType(createFile);
    if (!contentType) {
      setError("Unsupported image type. Use JPEG, PNG, WEBP, GIF, or HEIC.");
      return;
    }

    setIsCreating(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error("You must be signed in to create images.");
      }

      setCreateStatus("Requesting upload URL...");

      const presignedResponse = await fetch(`${UPLOAD_API_BASE_URL}/pipeline/generate-presigned-url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentType,
        }),
      });

      if (!presignedResponse.ok) {
        throw new Error(await buildApiError(presignedResponse, "Failed to generate a presigned upload URL"));
      }

      const presignedPayload = (await readJsonBody(presignedResponse)) as GeneratePresignedUrlResponse | null;
      const presignedUrl =
        typeof presignedPayload?.presignedUrl === "string" ? presignedPayload.presignedUrl : null;
      const cdnUrl = typeof presignedPayload?.cdnUrl === "string" ? presignedPayload.cdnUrl : null;

      if (!presignedUrl || !cdnUrl) {
        throw new Error("Presigned URL response is missing required fields: presignedUrl and cdnUrl.");
      }

      setCreateStatus("Uploading image...");

      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
        },
        body: createFile,
      });

      if (!uploadResponse.ok) {
        throw new Error(await buildApiError(uploadResponse, "Failed to upload image bytes"));
      }

      setCreateStatus("Registering image...");

      const registerResponse = await fetch(`${UPLOAD_API_BASE_URL}/pipeline/upload-image-from-url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: cdnUrl,
          isCommonUse: createDraft.is_common_use,
        }),
      });

      if (!registerResponse.ok) {
        throw new Error(await buildApiError(registerResponse, "Failed to register uploaded image"));
      }

      const registerPayload = (await readJsonBody(registerResponse)) as RegisterImageResponse | null;
      const imageId = typeof registerPayload?.imageId === "string" ? registerPayload.imageId : null;

      if (!imageId) {
        throw new Error("Upload registration response is missing imageId.");
      }

      setCreateStatus("Saving image details...");

      let createdImage = await waitForImageRecord(imageId);
      const normalizedDescription = normalizeText(createDraft.image_description);
      const normalizedContext = normalizeText(createDraft.additional_context);
      const needsMetadataUpdate =
        createdImage.is_public !== createDraft.is_public ||
        createdImage.is_common_use !== createDraft.is_common_use ||
        createdImage.image_description !== normalizedDescription ||
        createdImage.additional_context !== normalizedContext;

      if (needsMetadataUpdate) {
        const { data: updatedData, error: updateError } = await supabase
          .from("images")
          .update({
            image_description: normalizedDescription,
            additional_context: normalizedContext,
            is_common_use: createDraft.is_common_use,
            is_public: createDraft.is_public,
            modified_datetime_utc: new Date().toISOString(),
          })
          .eq("id", imageId)
          .select(IMAGE_SELECT_COLUMNS)
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        createdImage = mapRow((updatedData ?? {}) as Record<string, unknown>);
      }

      if (currentPage === 1) {
        setImages((current) =>
          [createdImage, ...current.filter((image) => image.id !== createdImage.id)].slice(0, IMAGE_PAGE_SIZE)
        );
      }
      setTotalImageCount((current) => current + 1);
      setCreateDraft(EMPTY_DRAFT);
      setCreateFile(null);
      setCreateStatus(null);
      if (createFileInputRef.current) {
        createFileInputRef.current.value = "";
      }
      setNotice(`Created image ${createdImage.id}.`);
    } catch (createError) {
      setCreateStatus(null);
      setError(createError instanceof Error ? createError.message : "Failed to create image.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdateImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);

    if (!editImageId) {
      setError("Select an image first.");
      return;
    }

    const normalizedUrl = normalizeText(editDraft.url);
    if (!normalizedUrl) {
      setError("Image URL is required.");
      return;
    }

    setIsUpdating(true);

    const { data, error: updateError } = await supabase
      .from("images")
      .update({
        url: normalizedUrl,
        image_description: normalizeText(editDraft.image_description),
        additional_context: normalizeText(editDraft.additional_context),
        is_common_use: editDraft.is_common_use,
        is_public: editDraft.is_public,
        modified_datetime_utc: new Date().toISOString(),
      })
      .eq("id", editImageId)
      .select(IMAGE_SELECT_COLUMNS)
      .single();

    if (updateError) {
      setError(updateError.message);
      setIsUpdating(false);
      return;
    }

    const mapped = mapRow((data ?? {}) as Record<string, unknown>);
    setImages((current) => current.map((image) => (image.id === mapped.id ? mapped : image)));
    setNotice(`Updated image ${mapped.id}.`);
    closeEditModal();
    setIsUpdating(false);
  }

  async function handleDeleteImage(id: string) {
    const shouldDelete = window.confirm(`Delete image ${id}? This cannot be undone.`);
    if (!shouldDelete) return;

    setNotice(null);
    setError(null);
    setDeletingId(id);

    const { error: deleteError } = await supabase.from("images").delete().eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingId(null);
      return;
    }

    const nextTotalCount = Math.max(0, totalImageCount - 1);
    const nextTotalPages = Math.max(1, Math.ceil(nextTotalCount / IMAGE_PAGE_SIZE));
    const targetPage = Math.min(currentPage, nextTotalPages);

    setTotalImageCount(nextTotalCount);
    if (editImageId === id) {
      closeEditModal();
    }

    setNotice(`Deleted image ${id}.`);
    setDeletingId(null);
    await loadPage(targetPage, true);
  }

  return (
    <div className="stack-md">
      {notice ? <p className="badge">{notice}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <div className="panel panel-pad stack-sm">
        <p className="kicker">Create image</p>
        <p className="flush-text">
          Upload and register a new image only. This flow does not generate captions.
        </p>

        <form className="form-grid stack-sm" onSubmit={handleCreateImage}>
          <label className="stack-xs">
            <span>Image file</span>
            <input
              ref={createFileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic"
              onChange={(event) => setCreateFile(event.target.files?.[0] ?? null)}
              required
            />
          </label>

          {createFile ? <p className="flush-text">Selected {createFile.name}</p> : null}

          <label className="stack-xs">
            <span>Image description</span>
            <textarea
              value={createDraft.image_description}
              onChange={(event) => updateCreateDraft("image_description", event.target.value)}
            />
          </label>

          <div className="checkbox-row">
            <label className="flex">
              <input
                type="checkbox"
                checked={createDraft.is_common_use}
                onChange={(event) => updateCreateDraft("is_common_use", event.target.checked)}
              />
              <span>Common use image</span>
            </label>

            <label className="flex">
              <input
                type="checkbox"
                checked={createDraft.is_public}
                onChange={(event) => updateCreateDraft("is_public", event.target.checked)}
              />
              <span>Public image</span>
            </label>
          </div>

          {createStatus ? <p className="flush-text">{createStatus}</p> : null}

          <div className="flex">
            <button
              type="submit"
              className="btn btn-primary btn-image-update btn-create-image"
              disabled={isCreating}
            >
              {isCreating ? "Creating..." : "Create image"}
            </button>
          </div>
        </form>
      </div>

      <div className="table-toolbar-combined">
        <label className="stack-xs table-toolbar-left">
          <span className="kicker">Filter Images</span>
          <input
            type="search"
            placeholder="Search by id, url, profile_id, description"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>

        <div className="table-toolbar-meta">
          <p className="muted data-count">{imagePaginationSummary.primary}</p>
          {imagePaginationSummary.secondary ? (
            <p className="muted data-count">{imagePaginationSummary.secondary}</p>
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
              <th>Preview</th>
              <th>ID</th>
              <th>Profile ID</th>
              <th>Public</th>
              <th>Common Use</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredImages.length === 0 ? (
              <tr>
                <td colSpan={7}>No image rows found.</td>
              </tr>
            ) : (
              filteredImages.map((image) => {
                const profileId = image.profile_id;

                return (
                  <tr key={image.id}>
                    <td>
                      {image.url ? (
                        <button
                          type="button"
                          className="image-thumb-button"
                          onClick={() => setLightboxImage(image)}
                          aria-label={`Magnify image ${image.id}`}
                        >
                          <img src={image.url} alt={image.id} loading="lazy" className="image-preview" />
                        </button>
                      ) : (
                        <span className="muted">No URL</span>
                      )}
                    </td>
                    <td>
                      {image.id ? (
                        <button
                          type="button"
                          className="inline-code-button"
                          onClick={() => setPreviewTarget({ kind: "image", id: image.id })}
                        >
                          {image.id}
                        </button>
                      ) : (
                        <code>-</code>
                      )}
                    </td>
                    <td>
                      {profileId ? (
                        <button
                          type="button"
                          className="inline-code-button"
                          onClick={() => setPreviewTarget({ kind: "profile", id: profileId })}
                        >
                          {profileId}
                        </button>
                      ) : (
                        <code>-</code>
                      )}
                    </td>
                    <td>{image.is_public ? <span className="badge">TRUE</span> : "FALSE"}</td>
                    <td>{image.is_common_use ? <span className="badge">TRUE</span> : "FALSE"}</td>
                    <td>{image.created_datetime_utc ?? "-"}</td>
                    <td>
                      <div className="flex">
                        <button
                          type="button"
                          className="btn btn-ghost btn-compact-action"
                          onClick={() => beginEdit(image)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-compact-action"
                          onClick={() => handleDeleteImage(image.id)}
                          disabled={deletingId === image.id}
                        >
                          {deletingId === image.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <EntityPreviewModal target={previewTarget} onClose={() => setPreviewTarget(null)} />

      {lightboxImage ? (
        <div className="preview-overlay" role="presentation" onClick={() => setLightboxImage(null)}>
          <div
            className="preview-modal panel image-lightbox-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Image magnify"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="preview-modal-head">
              <div className="stack-xs">
                <p className="kicker">Image Preview</p>
                <p className="flush-text">{lightboxImage.id}</p>
              </div>
              <button type="button" className="preview-close" onClick={() => setLightboxImage(null)}>
                Close
              </button>
            </div>

            <div className="preview-modal-body stack-md">
              {lightboxImage.url ? (
                <img src={lightboxImage.url} alt={lightboxImage.id} className="image-lightbox-image" />
              ) : (
                <p className="flush-text">No image URL available.</p>
              )}

              <div className="image-lightbox-actions">
                {lightboxImage.url ? (
                  <a href={lightboxImage.url} target="_blank" rel="noreferrer" className="btn btn-ghost">
                    View original
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editImageId ? (
        <div className="preview-overlay" role="presentation" onClick={closeEditModal}>
          <div
            className="preview-modal panel"
            role="dialog"
            aria-modal="true"
            aria-label="Update image"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="preview-modal-head">
              <div className="stack-xs">
                <p className="kicker">Update image</p>
                <p className="flush-text">Editing {editImageId}</p>
              </div>
              <button type="button" className="preview-close" onClick={closeEditModal}>
                Close
              </button>
            </div>

            <form className="preview-modal-body stack-md" onSubmit={handleUpdateImage}>
              <div className="form-grid">
                <label className="stack-xs">
                  <span>Image URL</span>
                  <input
                    value={editDraft.url}
                    onChange={(event) => updateEditDraft("url", event.target.value)}
                    placeholder="https://images.almostcrackd.ai/..."
                    required
                  />
                </label>
                <label className="stack-xs">
                  <span>Image description</span>
                  <textarea
                    value={editDraft.image_description}
                    onChange={(event) => updateEditDraft("image_description", event.target.value)}
                  />
                </label>
                <label className="stack-xs">
                  <span>Additional context</span>
                  <textarea
                    value={editDraft.additional_context}
                    onChange={(event) => updateEditDraft("additional_context", event.target.value)}
                  />
                </label>
                <label className="flex">
                  <input
                    type="checkbox"
                    checked={editDraft.is_common_use}
                    onChange={(event) => updateEditDraft("is_common_use", event.target.checked)}
                  />
                  <span>Common use image</span>
                </label>
                <label className="flex">
                  <input
                    type="checkbox"
                    checked={editDraft.is_public}
                    onChange={(event) => updateEditDraft("is_public", event.target.checked)}
                  />
                  <span>Public image</span>
                </label>
              </div>
              <div className="flex">
                <button type="submit" className="btn btn-primary btn-image-update" disabled={isUpdating}>
                  {isUpdating ? "Updating..." : "Update image"}
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
