import { useEffect, useState } from "react";
import { Animated, Platform, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";

/** One shared pulse so every block on screen breathes together. */
function usePulse() {
  const [opacity] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return opacity;
}

type BoxProps = { width?: DimensionValue; height: number; round?: boolean; style?: StyleProp<ViewStyle> };

function Box({ width = "100%", height, round, style }: BoxProps) {
  return <View style={[styles.box, { width, height, borderRadius: round ? height / 2 : radius.control }, style]} />;
}

function Lines({ count = 2 }: { count?: number }) {
  return (
    <View style={styles.lines}>
      {Array.from({ length: count }, (_, index) => (
        <Box key={index} height={12} width={index === 0 ? "70%" : "45%"} />
      ))}
    </View>
  );
}

function ListRows({ rows = 6 }: { rows?: number }) {
  return (
    <View style={styles.stack}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.row}>
          <Box width={56} height={56} />
          <Lines />
        </View>
      ))}
    </View>
  );
}

function Grid({ cards = 6 }: { cards?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: cards }, (_, index) => (
        <View key={index} style={styles.card}>
          <Box height={130} />
          <Box height={12} width="80%" />
          <Box height={12} width="40%" />
        </View>
      ))}
    </View>
  );
}

function Detail() {
  return (
    <View style={styles.stack}>
      <Box height={260} />
      <Box height={22} width="75%" />
      <Box height={14} width="40%" />
      <Box height={44} />
      <Lines count={3} />
      <Lines count={3} />
    </View>
  );
}

function Home() {
  return (
    <View style={styles.stack}>
      <View style={styles.chips}>
        {Array.from({ length: 5 }, (_, index) => (
          <Box key={index} width={64} height={64} round />
        ))}
      </View>
      <Box height={150} />
      <Box height={18} width="45%" />
      <Grid cards={4} />
    </View>
  );
}

function Chat() {
  return (
    <View style={styles.stack}>
      {[60, 45, 70, 50, 65].map((width, index) => (
        <Box key={index} height={44} width={`${width}%`} style={index % 2 ? styles.mine : null} />
      ))}
    </View>
  );
}

const layouts = { list: ListRows, grid: Grid, detail: Detail, home: Home, chat: Chat };
export type SkeletonLayout = keyof typeof layouts;

/** Page-shaped placeholder shown while a screen's first data loads. */
export function Skeleton({ layout = "list" }: { layout?: SkeletonLayout }) {
  const opacity = usePulse();
  const Layout = layouts[layout];
  return (
    <Animated.View accessibilityLabel="Loading" accessibilityRole="progressbar" style={[styles.page, { opacity }]}>
      <Layout />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: spacing.lg },
  box: { backgroundColor: colors.line },
  stack: { gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  lines: { flex: 1, gap: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: { width: "47%", gap: spacing.sm },
  chips: { flexDirection: "row", gap: spacing.md },
  mine: { alignSelf: "flex-end" },
});
