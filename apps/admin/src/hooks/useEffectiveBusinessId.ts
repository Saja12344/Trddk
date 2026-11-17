"use client";

import { useAuth } from "@/components/AuthProvider";

/** Active company scope: business admins use their company; super admins use sidebar selection. */
export function useEffectiveBusinessId(): string | null {
  const { user, businessContextId } = useAuth();
  return user?.businessId ?? businessContextId ?? null;
}
