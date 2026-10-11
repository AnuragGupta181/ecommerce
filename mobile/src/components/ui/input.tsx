import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { colors, fonts, radius } from "@/lib/theme";
import { Text } from "./text";

type InputProps = TextInputProps & { label?: string; error?: string; hint?: string };

export function Input({ label, error, hint, style, ...props }: InputProps) {
  return (
    <View style={styles.field}>
      {label ? (
        <Text variant="small" color={colors.ink700}>
          {label}
        </Text>
      ) : null}
      <TextInput placeholderTextColor={colors.ink300} style={[styles.input, error ? styles.invalid : null, style]} {...props} />
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
  invalid: { borderColor: colors.danger },
});
