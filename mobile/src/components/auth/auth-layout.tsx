import { router } from "expo-router";
import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useLoginPrompt } from "@/lib/login-prompt";
import { colors, spacing } from "@/lib/theme";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const close = () => {
    // Abandoning auth drops the guest's pending action.
    useLoginPrompt.getState().dismiss();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={close} style={styles.close}>
            <X size={24} color={colors.ink900} />
          </Pressable>
          <View style={styles.mark}>
            <Text variant="h1">h</Text>
          </View>
          <View style={styles.heading}>
            <Text variant="display">{title}</Text>
            <Text color={colors.ink500}>{subtitle}</Text>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** After a successful sign-in: leave the auth stack, then run whatever the guest was trying to do. */
export function finishAuth() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
  useLoginPrompt.getState().resume();
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  close: { alignSelf: "flex-end", width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  mark: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.brand500, alignItems: "center", justifyContent: "center" },
  heading: { gap: spacing.xs },
});
