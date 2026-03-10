export type ProfileLike = Record<string, unknown> | null | undefined;

export function firstNonEmptyString(candidates: unknown[]) {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

export function getProfileLabel(profile: ProfileLike, fallbackId?: string) {
  if (!profile) {
    return fallbackId ? `User ${fallbackId.slice(0, 8)}` : "Unknown user";
  }

  const label = firstNonEmptyString([
    profile.full_name,
    profile.display_name,
    profile.name,
    profile.user_name,
    profile.username,
    profile.email,
  ]);

  if (label) return label;

  const idValue =
    typeof profile.id === "string"
      ? profile.id
      : typeof fallbackId === "string"
        ? fallbackId
        : null;

  return idValue ? `User ${idValue.slice(0, 8)}` : "Unknown user";
}

export function getProfileGreetingName(profile: ProfileLike) {
  if (!profile) return "there";

  const explicitFirstName = firstNonEmptyString([profile.first_name]);
  if (explicitFirstName) return explicitFirstName;

  const derivedFirstName = firstNonEmptyString([profile.full_name, profile.display_name, profile.name]);
  if (derivedFirstName) {
    const [firstToken] = derivedFirstName.split(/\s+/);
    if (firstToken) return firstToken;
  }

  const lastName = firstNonEmptyString([profile.last_name]);
  if (lastName) return lastName;

  const email = firstNonEmptyString([profile.email]);
  if (email) {
    const [prefix] = email.split("@");
    if (prefix) return prefix;
  }

  return "there";
}

export function getProfileEmail(profile: ProfileLike) {
  if (!profile) return null;
  return firstNonEmptyString([profile.email]);
}

export function getProfileUsername(profile: ProfileLike) {
  if (!profile) return null;
  return firstNonEmptyString([
    profile.username,
    profile.user_name,
    profile.handle,
    profile.display_name,
  ]);
}

export function getProfilePhotoUrl(profile: ProfileLike) {
  if (!profile) return null;
  return firstNonEmptyString([
    profile.avatar_url,
    profile.profile_photo_url,
    profile.photo_url,
    profile.profile_image_url,
    profile.image_url,
    profile.picture,
    profile.picture_url,
    profile.avatar,
    profile.photo,
  ]);
}

export function getProfileCreatedAt(profile: ProfileLike) {
  if (!profile) return null;
  return firstNonEmptyString([
    profile.created_datetime_utc,
    profile.created_at,
    profile.inserted_at,
  ]);
}

export function shortId(id: string | null | undefined) {
  if (!id) return "Unknown";
  return `${id.slice(0, 8)}...`;
}
