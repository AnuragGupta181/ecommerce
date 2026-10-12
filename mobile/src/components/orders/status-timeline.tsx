import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { formatDateTime } from "@/lib/format";
import { colors, spacing } from "@/lib/theme";
import type { OrderDetail } from "@/lib/types";
import { STATUS_LABEL } from "./status-badge";

/** The server sends the steps and their timestamps; a step without one is still ahead. */
export function StatusTimeline({ timeline }: { timeline: OrderDetail["timeline"] }) {
  return (
    <View>
      {timeline.map((step, i) => {
        const done = step.at !== null;
        const last = i === timeline.length - 1;
        const nextDone = !last && timeline[i + 1].at !== null;
        return (
          <View key={step.status} style={styles.step}>
            <View style={styles.rail}>
              <View style={[styles.dot, done && styles.dotDone]} />
              {last ? null : <View style={[styles.line, nextDone && styles.lineDone]} />}
            </View>
            <View style={styles.text}>
              <Text variant="h3" color={done ? colors.ink900 : colors.ink300}>
                {STATUS_LABEL[step.status]}
              </Text>
              {step.at ? (
                <Text variant="small" color={colors.ink500}>
                  {formatDateTime(step.at)}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: spacing.md, minHeight: 52 },
  rail: { alignItems: "center", width: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.ink300, backgroundColor: colors.surface, marginTop: 4 },
  dotDone: { borderColor: colors.success, backgroundColor: colors.success },
  line: { flex: 1, width: 2, backgroundColor: colors.line },
  lineDone: { backgroundColor: colors.success },
  text: { flex: 1, gap: 2, paddingBottom: spacing.md },
});
