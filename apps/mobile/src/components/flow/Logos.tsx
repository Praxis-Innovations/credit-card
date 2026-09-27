import { Image, StyleSheet, Text, View } from "react-native";
import { initials } from "../../lib/programs";
import { colors, fonts } from "../../lib/theme";

interface StoreLogoProps {
  name: string;
  logoUrl: string | null | undefined;
  logoAlt?: string | null;
  size?: number;
}

/** Store logo tile: the API logo, or a dashed initial-letter fallback. */
export function StoreLogo({ name, logoUrl, logoAlt, size = 48 }: StoreLogoProps) {
  const radius = Math.round(size / 4);
  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        accessibilityLabel={logoAlt || name}
        accessibilityRole="image"
        resizeMode="contain"
        style={[
          styles.logoImage,
          { width: size, height: size, borderRadius: radius, padding: size / 8 },
        ]}
      />
    );
  }
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${name} logo`}
      style={[styles.letterTile, { width: size, height: size, borderRadius: radius }]}
    >
      <Text style={[styles.letter, { fontSize: size >= 44 ? 16 : 14 }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

/** 16px rewards-program logo, or a dashed round letter placeholder. */
export function ProgramLogo({
  name,
  logoUrl,
  logoAlt,
}: {
  name: string;
  logoUrl: string | null;
  logoAlt?: string | null;
}) {
  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        accessibilityLabel={logoAlt || name}
        resizeMode="contain"
        style={styles.programImage}
      />
    );
  }
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Rewards program logo"
      style={styles.programLetter}
    >
      <Text style={styles.programLetterText}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logoImage: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  letterTile: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderDashed,
    alignItems: "center",
    justifyContent: "center",
  },
  letter: {
    fontFamily: fonts.heading,
    color: colors.textBody,
  },
  programImage: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  programLetter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderDashed,
    alignItems: "center",
    justifyContent: "center",
  },
  programLetterText: {
    fontFamily: fonts.semibold,
    fontSize: 7,
    color: colors.text,
  },
});
