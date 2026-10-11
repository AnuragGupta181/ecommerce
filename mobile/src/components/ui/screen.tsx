import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors } from "@/lib/theme";

export function Screen({ children, edges = ["top"] }: { children: ReactNode; edges?: Edge[] }) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  body: { flex: 1 },
});
