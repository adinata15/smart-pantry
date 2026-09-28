import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import type { PublicUser } from "@smart-pantry/contracts";
import { api } from "@/lib/api";
import { FridgePage } from "@/pages/fridge";
import { HomePage } from "@/pages/home";
import { InsightsPage } from "@/pages/insights";
import { MealsPage } from "@/pages/meals";
import { ScanPage } from "@/pages/scan";
import { ShopPage } from "@/pages/shop";
import { SignInPage, SignUpPage } from "@/pages/auth";
import { AppShell } from "@/shell/app-shell";
import { SessionProvider } from "@/shell/session";
import { ThemeProvider } from "@/shell/theme";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5_000 } },
});

function Protected() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: PublicUser }>("/v1/auth/me"),
    retry: false,
  });
  if (me.isLoading) return <p className="p-6 text-muted-foreground">Loading…</p>;
  if (me.isError || !me.data) return <Navigate to="/sign-in" replace />;
  return (
    <SessionProvider user={me.data.user}>
      <AppShell />
    </SessionProvider>
  );
}

const router = createBrowserRouter([
  { path: "/sign-in", element: <SignInPage /> },
  { path: "/sign-up", element: <SignUpPage /> },
  {
    path: "/",
    element: <Protected />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "fridge", element: <FridgePage /> },
      { path: "scan", element: <ScanPage /> },
      { path: "meals", element: <MealsPage /> },
      { path: "shop", element: <ShopPage /> },
      { path: "insights", element: <InsightsPage /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
