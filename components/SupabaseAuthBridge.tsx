"use client";

import { useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { useStore } from "@/lib/store";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchSupabaseProfile } from "@/lib/supabase/auth";

/**
 * Keeps the local store's session in step with Supabase Auth.
 *
 * Every screen reads the local session (`useCareNow`), so this bridge is the
 * one place that translates: Supabase session appears → fetch the profile →
 * mirror it into the store; Supabase session ends → end the mirrored session.
 * In local prototype mode (no env vars) it renders and does nothing.
 */
export function SupabaseAuthBridge() {
  const store = useStore();
  const storeRef = useRef(store);
  storeRef.current = store;
  const syncedUserId = useRef<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!isSupabaseConfigured || !supabase) return;

    let cancelled = false;

    async function syncUser(user: User | null) {
      if (cancelled) return;
      if (!user) {
        if (syncedUserId.current !== null) {
          syncedUserId.current = null;
          storeRef.current.syncExternalSession(null);
        }
        return;
      }
      // Token refreshes and repeat events for the same user need no work.
      if (syncedUserId.current === user.id) return;
      syncedUserId.current = user.id;
      const profile = await fetchSupabaseProfile(user);
      if (!cancelled) storeRef.current.syncExternalSession(profile);
    }

    // Restore whatever session Supabase persisted from a previous visit.
    supabase.auth.getSession().then(({ data }) => syncUser(data.session?.user ?? null));

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        syncedUserId.current = null;
        storeRef.current.syncExternalSession(null);
        return;
      }
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
        void syncUser(session?.user ?? null);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
