import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { colors, radius, spacing } from "@/lib/theme";
import type { DeliveryStatus, SubscriptionDetail } from "@/lib/types";
import { calendarMonths, formatMonth, WEEKDAYS } from "@/lib/weekdays";

type Drop = SubscriptionDetail["deliveries"][number];

const STATUS_STYLE: Record<DeliveryStatus, { bg: string; fg: string; label: string }> = {
  SCHEDULED: { bg: colors.brand100, fg: colors.ink900, label: "Coming" },
  DELIVERED: { bg: colors.successSoft, fg: colors.success, label: "Delivered" },
  SKIPPED: { bg: colors.canvas, fg: colors.ink500, label: "Skipped" },
  MISSED: { bg: colors.dangerSoft, fg: colors.danger, label: "Missed" },
  CANCELLED: { bg: colors.canvas, fg: colors.ink300, label: "Cancelled" },
};

/** Month grid of the subscription's drops. Tap an upcoming day to skip it (or bring it back). */
export function DeliveryCalendar({ deliveries, onToggle }: { deliveries: Drop[]; onToggle: (drop: Drop) => void }) {
  const byDate = new Map(deliveries.map((drop) => [drop.date.slice(0, 10), drop]));
  const months = calendarMonths([...byDate.keys()]);

  return (
    <View style={styles.wrap}>
      {months.map(({ month, weeks }) => (
        <View key={month} style={styles.month}>
          <Text variant="h3">{formatMonth(month)}</Text>
          <View style={styles.week}>
            {WEEKDAYS.map((day) => (
              <Text key={day.name} variant="small" color={colors.ink500} style={styles.head}>
                {day.name.charAt(0)}
              </Text>
            ))}
          </View>
          {weeks.map((week, index) => (
            <View key={index} style={styles.week}>
              {week.map((date, cell) => {
                const drop = date ? byDate.get(date) : undefined;
                const look = drop ? STATUS_STYLE[drop.status] : null;
                return (
                  <Pressable
                    key={cell}
                    disabled={!drop?.canChange}
                    accessibilityRole={drop?.canChange ? "button" : undefined}
                    accessibilityLabel={drop ? `${date} ${look?.label}` : undefined}
                    onPress={() => drop && onToggle(drop)}
                    style={[styles.cell, look ? { backgroundColor: look.bg } : null, drop?.canChange ? styles.changeable : null]}
                  >
                    {date ? (
                      <Text variant="small" color={look?.fg ?? colors.ink300}>
                        {Number(date.slice(8))}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ))}
      <View style={styles.legend}>
        {(["SCHEDULED", "DELIVERED", "SKIPPED", "MISSED"] as const).map((status) => (
          <View key={status} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: STATUS_STYLE[status].bg, borderColor: STATUS_STYLE[status].fg }]} />
            <Text variant="small" color={colors.ink500}>
              {STATUS_STYLE[status].label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  month: { gap: spacing.xs },
  week: { flexDirection: "row", gap: 4 },
  head: { flex: 1, textAlign: "center" },
  cell: { flex: 1, aspectRatio: 1, borderRadius: radius.control / 2, alignItems: "center", justifyContent: "center" },
  changeable: { borderWidth: 1, borderColor: colors.brand500 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
});
