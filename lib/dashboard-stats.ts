import type { SupabaseClient } from "@supabase/supabase-js";

export type DashboardStats = {
  profiles: number;
  superadmins: number;
  images: number;
  captions: number;
  captionsPerImage: number;
  publicImageRatio: number;
};

type DashboardStatsResult = {
  stats: DashboardStats;
  errors: string[];
};

export async function getDashboardStats(supabase: SupabaseClient): Promise<DashboardStatsResult> {
  const [profilesCountRes, superadminCountRes, imagesCountRes, captionsCountRes, publicImagesCountRes] =
    await Promise.all([
      supabase.from("profiles").select("id", { head: true, count: "exact" }),
      supabase
        .from("profiles")
        .select("id", { head: true, count: "exact" })
        .eq("is_superadmin", true),
      supabase.from("images").select("id", { head: true, count: "exact" }),
      supabase.from("captions").select("id", { head: true, count: "exact" }),
      supabase.from("images").select("id", { head: true, count: "exact" }).eq("is_public", true),
    ]);

  const profiles = profilesCountRes.count ?? 0;
  const superadmins = superadminCountRes.count ?? 0;
  const images = imagesCountRes.count ?? 0;
  const captions = captionsCountRes.count ?? 0;
  const publicImages = publicImagesCountRes.count ?? 0;

  return {
    stats: {
      profiles,
      superadmins,
      images,
      captions,
      captionsPerImage: images > 0 ? captions / images : 0,
      publicImageRatio: images > 0 ? publicImages / images : 0,
    },
    errors: [
      profilesCountRes.error?.message,
      superadminCountRes.error?.message,
      imagesCountRes.error?.message,
      captionsCountRes.error?.message,
      publicImagesCountRes.error?.message,
    ].filter(Boolean) as string[],
  };
}
