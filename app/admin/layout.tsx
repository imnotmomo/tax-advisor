import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiHealthStatus } from "@/components/admin/api-health-status";
import { SITE_ACCESS_COOKIE_NAME, hasValidSiteAccessCookie } from "@/lib/site-password";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(SITE_ACCESS_COOKIE_NAME)?.value;

  if (!hasValidSiteAccessCookie(accessCookie)) {
    redirect("/");
  }

  return (
    <div className="admin-shell">
      <header className="panel admin-hero">
        <div className="admin-header-grid">
          <div className="admin-brand stack-sm">
            <p className="admin-title admin-title-compact">Tax advisor agent</p>
          </div>

          <ApiHealthStatus />
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
