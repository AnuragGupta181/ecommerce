import { Text as RNText, type TextProps } from "react-native";
import { colors, type as typeScale } from "@/lib/theme";

type Variant = keyof typeof typeScale;

export function Text({ variant = "body", color = colors.ink900, style, ...props }: TextProps & { variant?: Variant; color?: string }) {
  return <RNText style={[typeScale[variant], { color }, style]} {...props} />;
}
