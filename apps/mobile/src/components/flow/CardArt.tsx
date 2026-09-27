import { Image, StyleSheet, View } from "react-native";
import type { CreditCard } from "../../lib/api-types";
import { colors } from "../../lib/theme";

/** Muted placeholder tones from the design; picked per card id so rows differ. */
const PLACEHOLDER_TONES = ["#3d4a45", "#5b4640", "#39485c", "#6b7a74", "#8a6a4a"];

function toneFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_TONES[hash % PLACEHOLDER_TONES.length]!;
}

interface CardArtProps {
  card: Pick<CreditCard, "id" | "issuer" | "name" | "imageUrl" | "imageAlt">;
  width: number;
  /** Gold chip (result screen) vs translucent chip (card picker). */
  chip?: "gold" | "light";
  shadow?: boolean;
  radius?: number;
}

/** Card image from the API, or the neutral card-shaped placeholder. */
export function CardArt({ card, width, chip = "light", shadow, radius }: CardArtProps) {
  const height = Math.round(width / 1.6);
  const borderRadius = radius ?? Math.max(4, Math.round(width / 11));
  const label = card.imageAlt || `${card.issuer} ${card.name} card`;

  if (card.imageUrl) {
    return (
      <Image
        source={{ uri: card.imageUrl }}
        accessibilityLabel={label}
        accessibilityRole="image"
        resizeMode="cover"
        style={[{ width, height, borderRadius }, shadow && styles.shadow]}
      />
    );
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${card.issuer} ${card.name} card image`}
      style={[
        { width, height, borderRadius, backgroundColor: toneFor(card.id) },
        shadow && styles.shadow,
      ]}
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
  shadow: {
    shadowColor: "#141816",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});
