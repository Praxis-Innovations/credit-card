import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts, TOUCH } from "../../lib/theme";
import { SearchIcon } from "./Icons";
import { pressState } from "./press-state";

interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: SearchFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      <SearchIcon />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={accessibilityLabel}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        inputMode="search"
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={styles.clear}
        >
          {(state) => (
            <Text style={[styles.clearText, pressState(state).hovered && styles.clearHover]}>
              ×
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 48,
    paddingLeft: 14,
    paddingRight: 2,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderInput,
  },
  fieldFocused: {
    borderColor: colors.primary,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  clear: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: {
    fontSize: 22,
    lineHeight: 24,
    color: colors.textMuted,
  },
  clearHover: {
    color: colors.text,
  },
});
