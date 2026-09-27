import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { resolveAssetUrl } from "../../lib/api-client";
import type { CreditCard } from "../../lib/api-types";
import { colors } from "../../lib/theme";

/** ISO/IEC 7810 ID-1 card proportions (85.60 × 53.98 mm). */
export const CARD_ASPECT = 1.586;

/** Muted placeholder tones from the design; picked per card id so rows differ. */
const PLACEHOLDER_TONES = ["#3d4a45", "#5b4640", "#39485c", "#6b7a74", "#8a6a4a"];

function toneFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_TONES[hash % PLACEHOLDER_TONES.length]!;
}

type LoadStatus = "loading" | "loaded" | "error";

interface CardArtProps {
  card: Pick<CreditCard, "id" | "issuer" | "name" | "imageUrl" | "imageAlt">;
  width: number;
  /** Gold chip (result screen) vs translucent chip (card picker). */
  chip?: "gold" | "light";
  shadow?: boolean;
  radius?: number;
}

/**
 * The card image from the API. A neutral skeleton shows while it loads; the
 * design's tinted placeholder only appears when there is no image or it fails.
 */
export function CardArt({ card, width, chip = "light", shadow, radius }: CardArtProps) {
  const height = Math.round(width / CARD_ASPECT);
  const borderRadius = radius ?? Math.max(4, Math.round(width / 11));
  const label = card.imageAlt || `${card.issuer} ${card.name} card image`;
  const uri = resolveAssetUrl(card.imageUrl);
  const [load, setLoad] = useState<{ uri: string | null; status: LoadStatus }>({
    uri,
    status: "loading",
  });
  const status: LoadStatus = load.uri === uri ? load.status : "loading";
  const frame = { width, height, borderRadius };

  if (uri && status !== "error") {
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        accessibilityState={{ busy: status === "loading" }}
        testID={`card-art-${card.id}`}
        style={[frame, shadow && styles.shadow]}
      >
        <View style={[styles.clip, frame, status === "loading" && styles.skeleton]}>
          <Image
            source={{ uri }}
            resizeMode="cover"
            style={[{ width, height }, status === "loading" && styles.hidden]}
            onLoad={() => setLoad({ uri, status: "loaded" })}
            onError={() => setLoad({ uri, status: "error" })}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      testID={`card-art-${card.id}`}
      style={[frame, { backgroundColor: toneFor(card.id) }, shadow && styles.shadow]}
    >
      <View
        style={{
          position: "absolute",
          left: Math.round(width * 0.12),
          top: Math.round(height * 0.36),
          width: Math.round(width * 0.17),
          height: Math.round(height * 0.24),
          borderRadius: 2,
          backgroundColor: chip === "gold" ? colors.chip : "rgba(255,255,255,0.45)",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
  },
  skeleton: {
    backgroundColor: colors.tintStrong,
  },
  hidden: {
    opacity: 0,
  },
  shadow: {
    shadowColor: "#141816",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});
