import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useForgotPassword, useResetPassword } from "@/hooks/use-auth";
import { errorMessage, fieldErrors } from "@/lib/api";
import { colors } from "@/lib/theme";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const forgot = useForgotPassword();
  const reset = useResetPassword();
  const errors = fieldErrors(reset.error);
  const error = forgot.error ?? (reset.error && Object.keys(errors).length === 0 ? reset.error : null);

  return (
    <AuthLayout title="Reset password" subtitle={sent ? `Enter the 6-digit code we emailed to ${email}.` : "We'll email you a 6-digit code."}>
      <Input label="Email" value={email} onChangeText={setEmail} editable={!sent} autoCapitalize="none" keyboardType="email-address" />
      {sent ? (
        <>
          <Input label="Code" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} error={errors.otp} />
          <Input label="New password" value={password} onChangeText={setPassword} secureTextEntry hint="At least 8 characters" error={errors.password} />
        </>
      ) : null}
      {error ? (
        <Text variant="small" color={colors.danger}>
          {errorMessage(error)}
        </Text>
      ) : null}
      {sent ? (
        <Button
          title="Reset password"
          loading={reset.isPending}
          disabled={otp.length !== 6 || password.length < 8}
          onPress={() =>
            reset.mutate(
              { email: email.trim(), otp, password },
              { onSuccess: () => Alert.alert("Password reset", "Login with your new password.", [{ text: "OK", onPress: () => router.replace("/login") }]) },
            )
          }
        />
      ) : (
        <Button title="Send code" loading={forgot.isPending} disabled={!email.includes("@")} onPress={() => forgot.mutate(email.trim(), { onSuccess: () => setSent(true) })} />
      )}
      {sent ? <Button title="Resend code" variant="ghost" onPress={() => forgot.mutate(email.trim())} /> : null}
    </AuthLayout>
  );
}
