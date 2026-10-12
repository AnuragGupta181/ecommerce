import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AuthLayout, finishAuth } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useLogin } from "@/hooks/use-auth";
import { errorMessage, fieldErrors } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  const errors = fieldErrors(login.error);
  const formError = login.error && Object.keys(errors).length === 0 ? errorMessage(login.error) : null;

  return (
    <AuthLayout title="Welcome back" subtitle="Login with your email or phone number.">
      <Input label="Email or phone" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoComplete="username" keyboardType="email-address" error={errors.identifier} />
      <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" error={errors.password} />
      <Pressable hitSlop={8} style={styles.forgot} onPress={() => router.push("/forgot-password")}>
        <Text variant="small" color={colors.brand700} style={styles.bold}>
          Forgot password?
        </Text>
      </Pressable>
      {formError ? (
        <Text variant="small" color={colors.danger}>
          {formError}
        </Text>
      ) : null}
      <Button title="Login" loading={login.isPending} disabled={!identifier.trim() || !password} onPress={() => login.mutate({ identifier: identifier.trim(), password }, { onSuccess: finishAuth })} />
      <View style={styles.switch}>
        <Text color={colors.ink500}>New to Haat?</Text>
        <Pressable hitSlop={8} onPress={() => router.replace("/signup")}>
          <Text style={styles.bold}>Create an account</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: "flex-end" },
  bold: { fontFamily: "PlusJakartaSans_700Bold" },
  switch: { flexDirection: "row", justifyContent: "center", gap: spacing.xs },
});
