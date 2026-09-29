import type { Icon } from "@phosphor-icons/react";
import {
  ChartBar,
  CookingPot,
  ForkKnife,
  House,
  Leaf,
  Scan,
  ShoppingCart,
  SignOut,
  User,
} from "@phosphor-icons/react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { HouseholdPanel } from "@/components/household-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSession } from "./session";
import { SetupHousehold } from "@/pages/setup";

const primaryNav: { to: string; label: string; icon: Icon }[] = [
  { to: "/", label: "Home", icon: House },
  { to: "/fridge", label: "Fridge", icon: CookingPot },
  { to: "/scan", label: "Scan", icon: Scan },
  { to: "/meals", label: "Meals", icon: ForkKnife },
  { to: "/shop", label: "Shop", icon: ShoppingCart },
];

const allNav = [
  ...primaryNav,
  { to: "/insights", label: "Insights", icon: ChartBar },
  { to: "/profile", label: "Profile", icon: User },
];

function NavItem({ to, label, icon: IconMark, compact }: { to: string; label: string; icon: Icon; compact?: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl px-3 text-sm font-semibold transition-colors duration-200",
          compact ? "flex-1 flex-col justify-center gap-1 px-1 text-[11px]" : "",
          isActive
            ? "border border-glass-border bg-highlight text-foreground shadow-glass-soft backdrop-blur-sm"
            : "text-muted-foreground hover:bg-highlight/60",
        )
      }
    >
      <IconMark aria-hidden="true" className="size-5 shrink-0" weight="regular" />
      <span>{label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const { user, households, household, setHouseholdId } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isProfile = location.pathname === "/profile";
  const signOut = useMutation({
    mutationFn: () => api("/v1/auth/sign-out", { method: "POST" }),
    onSuccess: async () => {
      await queryClient.clear();
      navigate("/sign-in");
    },
  });

  let main: ReactNode;
  if (isProfile) {
    main = <Outlet />;
  } else if (household) {
    main = (
      <div className="space-y-6">
        <Outlet />
        <HouseholdPanel />
      </div>
    );
  } else {
    main = <SetupHousehold />;
  }

  return (
    <div className="relative min-h-screen text-foreground">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-2xl focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <aside className="glass-nav fixed inset-y-0 left-0 hidden w-60 flex-col border-r p-4 md:flex">
        <div className="font-heading mb-6 flex items-center gap-2 px-2 font-bold">
          <Leaf aria-hidden="true" className="size-5 text-primary" weight="regular" />
          Smart Pantry
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
          {allNav.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
      </aside>
      <div className="md:pl-60">
        <header className="glass-nav sticky top-0 z-20 border-b px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Household</p>
              {households.length > 1 ? (
                <div className="mt-1 max-w-xs">
                  <Select
                    aria-label="Switch household"
                    className="font-semibold"
                    value={household?.id ?? ""}
                    onChange={setHouseholdId}
                    options={households.map((entry) => ({ value: entry.id, label: entry.name }))}
                  />
                </div>
              ) : (
                <p className="truncate text-lg font-bold">{household?.name ?? "No household yet"}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="md:hidden">
                <NavItem to="/insights" label="Insights" icon={ChartBar} />
              </div>
              <Link
                to="/profile"
                className="hidden min-h-11 items-center rounded-2xl px-2 text-sm font-semibold text-muted-foreground transition-colors duration-200 hover:bg-highlight/60 hover:text-foreground sm:inline-flex"
              >
                {user.displayName}
              </Link>
              <Button variant="ghost" asChild>
                <Link to="/profile" aria-label="Profile">
                  <User aria-hidden="true" className="size-5" weight="regular" />
                </Link>
              </Button>
              <ThemeToggle />
              <Button variant="ghost" type="button" onClick={() => signOut.mutate()}>
                <SignOut aria-hidden="true" className="size-4" weight="regular" />
                Sign out
              </Button>
            </div>
          </div>
        </header>
        <main
          id="content"
          className="mx-auto max-w-6xl scroll-mt-[var(--header-offset)] px-4 py-6 pb-28 md:px-8 md:pb-10"
          style={{ scrollPaddingTop: "var(--header-offset)", scrollPaddingBottom: "var(--bottom-nav-offset)" }}
        >
          {main}
        </main>
      </div>
      <nav
        className="glass-nav fixed inset-x-0 bottom-0 z-30 flex border-t px-1 pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Primary"
      >
        {primaryNav.map((item) => (
          <NavItem key={item.to} {...item} compact />
        ))}
      </nav>
    </div>
  );
}
