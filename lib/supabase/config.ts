function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  if (typeof atob === "function") {
    return atob(padded);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }

  throw new Error("Unable to decode Supabase key payload.");
}

function getJwtRole(jwt: string) {
  try {
    const payloadSegment = jwt.split(".")[1];
    if (!payloadSegment) return null;
    const payload = JSON.parse(decodeBase64Url(payloadSegment)) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
  );
}

const keyRole = getJwtRole(supabaseAnonKey);
if (keyRole && keyRole !== "anon") {
  throw new Error(
    `NEXT_PUBLIC_SUPABASE_ANON_KEY must be an anon key. Received role: ${keyRole}.`
  );
}
