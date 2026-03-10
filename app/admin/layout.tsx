import type { ReactNode } from "react";
import { ApiHealthStatus } from "@/components/admin/api-health-status";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: ReactNode }) {
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
