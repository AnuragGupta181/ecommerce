import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors } from "@/lib/theme";
import { PageBackdrop, type BackdropTheme } from "./page-backdrop";

type ScreenProps = {
  children: ReactNode;
  edges?: Edge[];
  /** Faint photos themed to the page, behind the content. */
  backdrop?: BackdropTheme;
  /** Tab screens keep the backdrop clear of the floating tab bar. */
  tab?: boolean;
};

export function Screen({ children, edges = ["top"], backdrop, tab }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {backdrop ? <PageBackdrop theme={backdrop} aboveTabBar={tab} /> : null}
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  body: { flex: 1 },
});
