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
import { isValidEmail } from '../../../src/utils/validators';

export default function BusinessProfileScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const userId = useAuthStore((state) => state.user?.id);

  const [hasMockLogo, setHasMockLogo] = useState(Boolean(profile?.businessLogoUri));
  const [businessName, setBusinessName] = useState(profile?.businessName ?? '');
  const [website, setWebsite] = useState(profile?.website ?? '');
  const [businessEmail, setBusinessEmail] = useState(profile?.businessEmail ?? '');
  const [description, setDescription] = useState(profile?.businessDescription ?? '');
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (isSaving) return;
    if (businessEmail.trim().length > 0 && !isValidEmail(businessEmail)) {
      setError('Enter a valid business email');
      return;
    }
    if (!userId) return;
    setIsSaving(true);
    try {
      await updateProfile(userId, {
        businessName: businessName.trim() || undefined,
        website: website.trim() || undefined,
        businessEmail: businessEmail.trim() || undefined,
        businessDescription: description.trim() || undefined,
        businessLogoUri: hasMockLogo ? 'mock-logo' : undefined,
      });
      router.back();
    } catch {
      Alert.alert('Save Failed', "We couldn't save your changes. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Business Profile" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.xl }]}>
            This will appear on your customer-facing payment pages in a future update.
          </Text>
          <Pressable
            onPress={() => setHasMockLogo((prev) => !prev)}
            style={[
              styles.logo,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, marginBottom: spacing.xl },
            ]}
          >
            {hasMockLogo ? (
              <Text style={[typography.h2, { color: colors.textPrimary }]}>
                {businessName.trim().slice(0, 1).toUpperCase() || 'S'}
              </Text>
            ) : (
              <Ionicons name="image-outline" size={24} color={colors.textMuted} />
            )}
          </Pressable>
          <TextField label="Business Name" value={businessName} onChangeText={setBusinessName} />
          <TextField label="Website (Optional)" value={website} onChangeText={setWebsite} keyboardType="url" autoCapitalize="none" />
          <TextField
            label="Business Email (Optional)"
            value={businessEmail}
            onChangeText={setBusinessEmail}
            error={error}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextField label="Short Description (Optional)" value={description} onChangeText={setDescription} multiline />
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
          <PrimaryButton label="Save Changes" onPress={handleSave} loading={isSaving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  logo: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', borderWidth: 1, alignSelf: 'center' },
});
