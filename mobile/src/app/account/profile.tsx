import { router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { useChangePassword, useUpdateProfile } from "@/hooks/use-account";
import { errorMessage, fieldErrors } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { spacing } from "@/lib/theme";

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const update = useUpdateProfile();
  const change = useChangePassword();
  const profileErrors = fieldErrors(update.error);
  const passwordErrors = fieldErrors(change.error);

  return (
    <Screen>
      <StackHeader title="Edit profile" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card title="Details">
          <Input label="Full name" value={name} onChangeText={setName} error={profileErrors.name} />
          <Input label="Email" value={user?.email ?? ""} editable={false} hint="Email can't be changed" />
          <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={profileErrors.phone} />
          <Button
            title="Save"
            loading={update.isPending}
            onPress={() =>
              update.mutate(
                { name: name.trim(), phone: phone.trim() || undefined },
                { onSuccess: () => router.back(), onError: (error) => Object.keys(fieldErrors(error)).length || Alert.alert("Couldn't save", errorMessage(error)) },
              )
            }
          />
        </Card>
        <Card title="Change password">
          <Input label="Current password" secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} error={passwordErrors.currentPassword} />
          <Input label="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} hint="At least 8 characters" error={passwordErrors.newPassword} />
          <Button
            title="Update password"
            variant="outline"
            loading={change.isPending}
            disabled={!currentPassword || newPassword.length < 8}
            onPress={() =>
              change.mutate(
                { currentPassword, newPassword },
                {
                  onSuccess: () => {
                    setCurrentPassword("");
                    setNewPassword("");
                    Alert.alert("Password updated");
                  },
                  onError: (error) => Object.keys(fieldErrors(error)).length || Alert.alert("Couldn't update password", errorMessage(error)),
                },
              )
            }
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
});
