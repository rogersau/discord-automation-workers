import type { ReactNode } from "react";

import {
  ADMIN_DASHBOARD_ROUTES,
  type AdminDashboardPath,
} from "../dashboard-routes";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

export function AdminShell({
  currentPath,
  children,
}: {
  currentPath: AdminDashboardPath;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background" data-current-path={currentPath}>
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="w-full max-w-xs rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Discord Automation
            </p>
            <h1 className="text-lg font-semibold tracking-tight">Admin Dashboard</h1>
          </div>
          <nav className="mt-6 space-y-1" aria-label="Admin">
            {ADMIN_DASHBOARD_ROUTES.map((route) => {
              const active = route.path === currentPath;

              return (
                <a
                  key={route.path}
                  href={route.path}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {route.label}
                </a>
              );
            })}
          </nav>
          <form className="mt-6 border-t pt-4" method="post" action="/admin/logout">
            <Button className="w-full" type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  );
}
