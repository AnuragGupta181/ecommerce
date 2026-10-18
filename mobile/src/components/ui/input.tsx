import { Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { colors, fonts, radius } from "@/lib/theme";
import { Text } from "./text";

type InputProps = TextInputProps & { label?: string; error?: string; hint?: string };

/** Password fields (`secureTextEntry`) get a show/hide toggle. */
export function Input({ label, error, hint, style, secureTextEntry, ...props }: InputProps) {
  const [revealed, setRevealed] = useState(false);
  const Icon = revealed ? EyeOff : Eye;

  return (
    <View style={styles.field}>
      {label ? (
        <Text variant="small" color={colors.ink700}>
          {label}
        </Text>
      ) : null}
      <View>
        <TextInput
          placeholderTextColor={colors.ink300}
          style={[styles.input, secureTextEntry ? styles.withToggle : null, error ? styles.invalid : null, style]}
          secureTextEntry={secureTextEntry && !revealed}
          {...props}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            hitSlop={8}
            onPress={() => setRevealed((value) => !value)}
            style={styles.toggle}
          >
            <Icon size={20} color={colors.ink500} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="small" color={colors.danger}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" color={colors.ink500}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  input: {
    minHeight: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink900,
  },
  withToggle: { paddingRight: 48 },
  toggle: { position: "absolute", right: 0, top: 0, bottom: 0, width: 48, alignItems: "center", justifyContent: "center" },
  invalid: { borderColor: colors.danger },
});
