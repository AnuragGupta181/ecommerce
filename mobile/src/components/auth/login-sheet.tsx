import { router } from "expo-router";
import { LogIn } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useLoginPrompt } from "@/lib/login-prompt";
import { colors, radius, spacing } from "@/lib/theme";

/** Shown when a guest tries a protected action; the action resumes after login. */
export function LoginSheet() {
  const { visible, message, dismiss } = useLoginPrompt();
  const insets = useSafeAreaInsets();

  const go = (path: "/login" | "/signup") => {
    // Keep the pending action: the login screen calls resume() on success.
    useLoginPrompt.setState({ visible: false });
    router.push(path);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.handle} />
        <View style={styles.icon}>
          <LogIn size={24} color={colors.ink900} />
        </View>
        <Text variant="h2">{message}</Text>
        <Text color={colors.ink500}>Sign in to shop, save favourites and track your orders.</Text>
        <Button title="Login" onPress={() => go("/login")} />
        <Button title="Create an account" variant="outline" onPress={() => go("/signup")} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(28,26,20,0.4)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: spacing.xl, gap: spacing.md },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line },
  icon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brand100, alignItems: "center", justifyContent: "center" },
});
