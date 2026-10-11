import { StyleSheet } from "react-native";

/** Mirrors docs/DESIGN.md. Ink text on yellow; never white on yellow. */
export const colors = {
  brand50: "#FFFBEB",
  brand100: "#FFF3C4",
  brand200: "#FFE68A",
  brand400: "#FFD43B",
  brand500: "#FFC727",
  brand600: "#E6A800",
  brand700: "#9A6B00",
  ink900: "#1C1A14",
  ink700: "#3F3B2F",
  ink500: "#7A7465",
  ink300: "#C8C2B2",
  line: "#ECE8DC",
  canvas: "#FAF8F3",
  surface: "#FFFFFF",
  success: "#16A34A",
  successSoft: "#E8F7EE",
  danger: "#DC2626",
  dangerSoft: "#FDECEC",
  info: "#2563EB",
  warning: "#D97706",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { control: 12, card: 14, sheet: 24, pill: 999 } as const;

export const fonts = {
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
} as const;

export const type = StyleSheet.create({
  display: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34 },
  h1: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  h2: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  small: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  price: { fontFamily: fonts.extrabold, fontSize: 18, lineHeight: 22, fontVariant: ["tabular-nums"] },
});

export const shadow = {
  float: {
    shadowColor: colors.ink900,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;
