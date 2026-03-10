import { createHash } from "crypto";

export const SITE_ACCESS_COOKIE_NAME = "tax_advisor_access";

const SITE_ACCESS_COOKIE_SALT = "tax-advisor-access";

export function getConfiguredSitePassword() {
  const password = process.env.SITE_PASSWORD?.trim();
  return password && password.length > 0 ? password : null;
}

function createSiteAccessToken(value: string) {
  return createHash("sha256")
    .update(`${SITE_ACCESS_COOKIE_SALT}:${value}`)
    .digest("hex");
}

export function createConfiguredSiteAccessToken() {
  const password = getConfiguredSitePassword();
  return password ? createSiteAccessToken(password) : null;
}

export function hasValidSiteAccessCookie(value: string | undefined | null) {
  const expectedToken = createConfiguredSiteAccessToken();
  return Boolean(value && expectedToken && value === expectedToken);
}

export function isValidSitePassword(value: string | undefined | null) {
  const password = value?.trim();
  return Boolean(password && hasValidSiteAccessCookie(createSiteAccessToken(password)));
}

export function getSiteAccessCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}
