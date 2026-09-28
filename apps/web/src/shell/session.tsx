import type { HouseholdSummary, PublicUser } from "@smart-pantry/contracts";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export const HOUSEHOLD_STORAGE_KEY = "smart-pantry.household";

interface SessionValue {
  user: PublicUser;
  households: HouseholdSummary[];
  household: HouseholdSummary | null;
  setHouseholdId: (id: string) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Session is missing.");
  return value;
}

export function SessionProvider({ user, children }: { user: PublicUser; children: ReactNode }) {
  const households = useQuery({
    queryKey: ["households"],
    queryFn: () => api<{ households: HouseholdSummary[] }>("/v1/households"),
  });
  const [householdId, setHouseholdId] = useState(() => localStorage.getItem(HOUSEHOLD_STORAGE_KEY) ?? "");
  const list = households.isSuccess ? (households.data.households ?? []) : [];

  useEffect(() => {
    if (list.length === 0) return;
    if (!list.some((household) => household.id === householdId)) {
      setHouseholdId(list[0]!.id);
    }
  }, [list, householdId]);

  useEffect(() => {
    if (householdId) localStorage.setItem(HOUSEHOLD_STORAGE_KEY, householdId);
  }, [householdId]);

  const household = list.find((entry) => entry.id === householdId) ?? null;

  if (households.isLoading) {
    return <p className="p-6 text-muted-foreground">Loading your kitchen…</p>;
  }

  if (households.isError) {
    return (
      <div className="space-y-3 p-6" role="alert">
        <p className="text-danger-foreground">Could not load your households.</p>
        <Button type="button" onClick={() => void households.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={{ user, households: list, household, setHouseholdId }}>
      {children}
    </SessionContext.Provider>
  );
}
