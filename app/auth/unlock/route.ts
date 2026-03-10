import { NextResponse } from "next/server";
import {
  SITE_ACCESS_COOKIE_NAME,
  createConfiguredSiteAccessToken,
  getConfiguredSitePassword,
  getSiteAccessCookieOptions,
  isValidSitePassword,
} from "@/lib/site-password";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = formData.get("password");
  const submittedPassword = typeof password === "string" ? password : "";

  if (!getConfiguredSitePassword()) {
    return NextResponse.redirect(new URL("/?error=unconfigured", request.url), 303);
  }

  if (!isValidSitePassword(submittedPassword)) {
    return NextResponse.redirect(new URL("/?error=invalid-password", request.url), 303);
  }

  const token = createConfiguredSiteAccessToken();
  const response = NextResponse.redirect(new URL("/admin", request.url), 303);

  if (token) {
    response.cookies.set(SITE_ACCESS_COOKIE_NAME, token, getSiteAccessCookieOptions());
  }

  return response;
}
