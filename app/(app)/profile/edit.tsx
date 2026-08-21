import { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { useProfileStore } from '../../../src/store/profileStore';
import { useAuthStore } from '../../../src/store/authStore';

export default function EditProfileScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const userId = useAuthStore((state) => state.user?.id);

  const [hasMockAvatar, setHasMockAvatar] = useState(Boolean(profile?.avatarUri));
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [country, setCountry] = useState(profile?.country ?? '');
  const [website, setWebsite] = useState(profile?.website ?? '');
  const [error, setError] = useState<string | undefined>();

  async function handleSave() {
    if (displayName.trim().length === 0) {
      setError('Enter a display name');
      return;
    }
    if (!userId) return;
    try {
      await updateProfile(userId, {
        displayName: displayName.trim(),
        country: country.trim(),
        website: website.trim() || undefined,
        avatarUri: hasMockAvatar ? 'mock-avatar' : undefined,
      });
      router.back();
    } catch {
      Alert.alert('Save Failed', "We couldn't save your changes. Try again.");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Edit Profile" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => setHasMockAvatar((prev) => !prev)}
            style={[
              styles.avatar,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.full, marginBottom: spacing.xl },
            ]}
          >
            {hasMockAvatar ? (
              <Text style={[typography.h2, { color: colors.textPrimary }]}>
                {displayName.trim().slice(0, 1).toUpperCase() || 'F'}
              </Text>
            ) : (
              <Ionicons name="camera-outline" size={24} color={colors.textMuted} />
            )}
          </Pressable>
          <TextField label="Display Name" value={displayName} onChangeText={setDisplayName} error={error} />
          <TextField label="Country" value={country} onChangeText={setCountry} />
          <TextField label="Website (Optional)" value={website} onChangeText={setWebsite} keyboardType="url" autoCapitalize="none" />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Save Changes" onPress={handleSave} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', borderWidth: 1, alignSelf: 'center' },
});
