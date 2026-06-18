import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import type { Database } from "@vilo/types";

import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/stores/app-store";

type Profile = Database["public"]["Tables"]["user_profiles"]["Row"];
type Host = Database["public"]["Tables"]["hosts"]["Row"];

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  host: Host | null;
  /** True when this account owns an active host record (can use the host app). */
  isHost: boolean;
  loading: boolean;
  signInWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [host, setHost] = useState<Host | null>(null);
  const [loading, setLoading] = useState(true);
  const setActiveRole = useAppStore((s) => s.setActiveRole);

  // Load profile + host record for the signed-in user.
  async function hydrate(currentSession: Session | null) {
    if (!currentSession) {
      setProfile(null);
      setHost(null);
      return;
    }
    const userId = currentSession.user.id;
    const [{ data: profileRow }, { data: hostRow }] = await Promise.all([
      supabase.from("user_profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("hosts")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .maybeSingle(),
    ]);
    setProfile(profileRow ?? null);
    setHost(hostRow ?? null);
    // Default the surface to host for host accounts; guests stay on guest.
    if (hostRow) setActiveRole("host");
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await hydrate(data.session);
      if (mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        if (!mounted) return;
        setSession(nextSession);
        await hydrate(nextSession);
      },
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      host,
      isHost: !!host,
      loading,
      signInWithEmail: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        return { error: error?.message ?? null };
      },
      signUpWithEmail: async (email, password, fullName) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        return { error: error?.message ?? null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, profile, host, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
