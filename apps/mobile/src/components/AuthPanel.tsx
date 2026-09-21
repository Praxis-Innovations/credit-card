import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "../lib/supabase";
import { colors } from "../lib/theme";

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

  const supabase = getSupabaseClient();

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

  async function submit() {
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
      <View style={styles.guestBanner}>
        <Text style={styles.guestText}>
          Guest mode — set EXPO_PUBLIC_SUPABASE_URL and
          EXPO_PUBLIC_SUPABASE_ANON_KEY to sync owned cards via Supabase.
        </Text>
      </View>
    );
  }

  if (user) {
    return (
      <View style={styles.signedIn}>
        <Text style={styles.signedInText}>
          Signed in as{" "}
          <Text style={styles.signedInEmail}>{user.email ?? user.id}</Text>
        </Text>
        <Pressable
          onPress={signOut}
          style={styles.outlineBtn}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.outlineBtnText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle} accessibilityRole="header">
          {mode === "signin" ? "Sign in" : "Create account"}
        </Text>
        <Pressable
          onPress={() =>
            setMode((m) => (m === "signin" ? "signup" : "signin"))
          }
          accessibilityRole="button"
        >
          <Text style={styles.link}>
            {mode === "signin" ? "Need an account?" : "Have an account?"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          accessibilityLabel="Email"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          autoComplete={mode === "signin" ? "password" : "new-password"}
          accessibilityLabel="Password"
        />
      </View>

      {message ? (
        <Text style={styles.message} accessibilityRole="text">
          {message}
        </Text>
      ) : null}

      <Pressable
        onPress={submit}
        disabled={busy}
        style={[styles.primaryBtn, busy && styles.btnDisabled]}
        accessibilityRole="button"
        accessibilityLabel={mode === "signin" ? "Sign in" : "Sign up"}
      >
        {busy ? (
          <ActivityIndicator color={colors.primaryFg} />
        ) : (
          <Text style={styles.primaryBtnText}>
            {mode === "signin" ? "Sign in" : "Sign up"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  guestBanner: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.mutedBg,
    borderRadius: 16,
    padding: 16,
  },
  guestText: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  signedIn: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  signedInText: {
    fontSize: 14,
    color: colors.foreground,
    flexShrink: 1,
  },
  signedInEmail: {
    fontWeight: "700",
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  outlineBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
  },
  form: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
  },
  link: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    textDecorationLine: "underline",
  },
  row: {
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.bg,
  },
  message: {
    fontSize: 13,
    color: colors.muted,
  },
  primaryBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 100,
    alignItems: "center",
  },
  primaryBtnText: {
    color: colors.primaryFg,
    fontWeight: "700",
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
