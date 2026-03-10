import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SITE_ACCESS_COOKIE_NAME, getConfiguredSitePassword, hasValidSiteAccessCookie } from "@/lib/site-password";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getErrorMessage(error: string | undefined, passwordConfigured: boolean) {
  if (!passwordConfigured) {
    return "SITE_PASSWORD is not configured.";
  }

  if (error === "invalid-password") {
    return "Incorrect password.";
  }

  return null;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(SITE_ACCESS_COOKIE_NAME)?.value;

  if (hasValidSiteAccessCookie(accessCookie)) {
    redirect("/admin");
  }

  const params = searchParams ? await searchParams : undefined;
  const passwordConfigured = Boolean(getConfiguredSitePassword());
  const errorMessage = getErrorMessage(params?.error, passwordConfigured);

  return (
    <div className="entry-page gate-page">
      <div className="entry-layout gate-layout">
        <section className="entry-copy-block gate-copy-block">
          <div className="stack-sm">
            <p className="kicker">Protected</p>
            <h1 className="entry-title">Tax advisor agent</h1>
            <p className="entry-copy">This page is protected, enter password to continue.</p>
          </div>
        </section>

        <section className="entry-card panel panel-pad gate-card">
          <div className="stack-sm">
            <p className="entry-feature-label">Access</p>
            <h2 className="entry-panel-title">Enter password</h2>
          </div>

          <form action="/auth/unlock" method="POST" className="stack-sm">
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              required
            />
            <button className="btn btn-primary" type="submit" disabled={!passwordConfigured}>
              Continue
            </button>
          </form>

          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        </section>
      </div>
    </div>
  );
}
