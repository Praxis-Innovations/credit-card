"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

interface AuthPanelProps {
  user: User | null;
  onUserChange: (user: User | null) => void;
}

export function AuthPanel({ user, onUserChange }: AuthPanelProps) {
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) onUserChange(data.session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      onUserChange(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase, onUserChange]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Account created — you can sign in and sync your wallet.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    onUserChange(null);
  }

  if (!configured) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
        Guest mode — set{" "}
        <code className="text-xs text-foreground">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        and{" "}
        <code className="text-xs text-foreground">
          NEXT_PUBLIC_SUPABASE_ANON_KEY
        </code>{" "}
        to sync owned cards via Supabase.
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/80 px-4 py-3">
        <p className="text-sm text-foreground">
          Signed in as{" "}
          <span className="font-semibold">{user.email ?? user.id}</span>
        </p>
        <Button type="button" variant="outline" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg tracking-tight">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h2>
        <button
          type="button"
          className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
          onClick={() =>
            setMode((m) => (m === "signin" ? "signup" : "signin"))
          }
        >
          {mode === "signin" ? "Need an account?" : "Have an account?"}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email"
        />
        <Input
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Password"
        />
      </div>
      {message && (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          {message}
        </p>
      )}
      <Button type="submit" className="mt-3" disabled={busy}>
        {busy ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
      </Button>
    </form>
  );
}
