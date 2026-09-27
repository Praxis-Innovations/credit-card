import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signInWithGoogle } from "../../lib/auth";
import { colors, fonts, TOUCH, WIDE_BREAKPOINT } from "../../lib/theme";
import { ErrorNote, LinkButton } from "./Buttons";
import { CheckIcon, CloseIcon, GoogleIcon } from "./Icons";

interface SaveWalletSheetProps {
  visible: boolean;
  cardCount: number;
  onClose: () => void;
}

const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL?.trim() || null;
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() || null;

function cardsPhrase(count: number): string {
  if (count <= 0) return "your cards";
  return count === 1 ? "your card" : `your ${count} cards`;
}

/**
 * "Save your wallet": Google is the only sign-in. "Maybe later" just closes —
 * the guest wallet stays on the device.
 */
export function SaveWalletSheet({ visible, cardCount, onClose }: SaveWalletSheetProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= WIDE_BREAKPOINT;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueWithGoogle() {
    setBusy(true);
    setError(null);
    const result = await signInWithGoogle();
    if (result.status === "redirecting") return;
    setBusy(false);
    if (result.status === "error") setError(result.message);
    if (result.status === "signed_in") onClose();
  }

  function close() {
    setError(null);
    setBusy(false);
    onClose();
  }

  const body = `Sign in to keep ${cardsPhrase(cardCount)} and use them on any device.`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={wide ? "fade" : "slide"}
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={[styles.backdrop, wide && styles.backdropWide]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityLabel="Close"
          accessibilityRole="button"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          tabIndex={-1}
        />
        <View
          role="dialog"
          aria-modal
          aria-label="Save your wallet"
          accessibilityViewIsModal
          style={[
            wide ? styles.dialog : styles.sheet,
            !wide && { paddingBottom: Math.max(36, insets.bottom + 16) },
          ]}
        >
          {wide ? (
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeButton}
            >
              <CloseIcon />
            </Pressable>
          ) : (
            <View style={styles.handle} />
          )}

          <Text
            style={[styles.title, wide ? styles.titleWide : styles.titlePhone]}
            accessibilityRole="header"
          >
            Save your wallet
          </Text>
          <Text style={[styles.body, wide && styles.bodyWide]}>
            {wide ? `${body} We never see card numbers or bank data.` : body}
          </Text>

          {wide ? null : (
            <View style={styles.bullets}>
              {["Your cards, synced everywhere", "We never see card numbers or bank data"].map(
                (line) => (
                  <View key={line} style={styles.bullet}>
                    <CheckIcon />
                    <Text style={styles.bulletText}>{line}</Text>
                  </View>
                ),
              )}
            </View>
          )}

          <Pressable
            onPress={() => void continueWithGoogle()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{ disabled: busy, busy }}
            style={({ pressed }) => [
              styles.google,
              wide && styles.googleWide,
              pressed && styles.googlePressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <GoogleIcon />
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          {error ? <ErrorNote>{error}</ErrorNote> : null}

          <LinkButton label="Maybe later" onPress={close} height={44} />

          {TERMS_URL && PRIVACY_URL ? (
            <Text style={styles.legal}>
              By continuing, you agree to NorthTap's{" "}
              <Text
                style={styles.legalLink}
                accessibilityRole="link"
                onPress={() => void Linking.openURL(TERMS_URL)}
              >
                Terms
              </Text>{" "}
              and{" "}
              <Text
                style={styles.legalLink}
                accessibilityRole="link"
                onPress={() => void Linking.openURL(PRIVACY_URL)}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: "flex-end",
  },
  backdropWide: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    gap: 14,
  },
  dialog: {
    width: 440,
    maxWidth: "100%",
    backgroundColor: colors.bg,
    borderRadius: 20,
    padding: 36,
    gap: 14,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  closeButton: {
    position: "absolute",
    right: 16,
    top: 16,
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  title: {
    fontFamily: fonts.heading,
    letterSpacing: -0.5,
    color: colors.text,
  },
  titlePhone: {
    marginTop: 12,
    fontSize: 26,
    lineHeight: 31,
  },
  titleWide: {
    fontSize: 28,
    lineHeight: 34,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 26,
    color: colors.textBody,
  },
  bodyWide: {
    marginBottom: 8,
  },
  bullets: {
    marginTop: 4,
    marginBottom: 8,
    gap: 10,
  },
  bullet: {
    flexDirection: "row",
    gap: 12,
  },
  bulletText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  google: {
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderInput,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  googleWide: {
    height: 56,
  },
  googlePressed: {
    backgroundColor: colors.tint,
  },
  googleText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.googleText,
  },
  legal: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: "center",
  },
  legalLink: {
    color: colors.primary,
    textDecorationLine: "underline",
  },
});
