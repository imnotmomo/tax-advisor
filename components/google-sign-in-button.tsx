"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { data, error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (!data?.url) {
      setError("Could not start Google OAuth redirect.");
      setLoading(false);
      return;
    }

    window.location.assign(data.url);
  }

  return (
    <div className="stack-sm">
      <button type="button" className="btn btn-primary" onClick={handleClick} disabled={loading}>
        {loading ? "Redirecting to Google..." : "Continue with Google"}
      </button>
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
