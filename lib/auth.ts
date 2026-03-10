import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type ProfileRow = Record<string, unknown>;

export function isSuperadmin(profile: ProfileRow | null) {
  return profile?.is_superadmin === true;
}

export async function getCurrentUserAndProfile() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      user: null,
      profile: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    profile: (profile as ProfileRow | null) ?? null,
  };
}

export async function requireSuperadmin() {
  const { supabase, user, profile } = await getCurrentUserAndProfile();

  if (!user) {
    redirect("/");
  }

  if (!isSuperadmin(profile)) {
    redirect("/not-authorized");
  }

  return {
    supabase,
    user: user as User,
    profile: profile as ProfileRow,
  };
}
