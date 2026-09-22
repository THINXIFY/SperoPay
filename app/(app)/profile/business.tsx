import { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { TAB_BAR_CONTENT_HEIGHT } from '../../../src/components/BottomNavigation';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { BusinessLogo } from '../../../src/components/BusinessLogo';
import { useProfileStore } from '../../../src/store/profileStore';
import { useAuthStore } from '../../../src/store/authStore';
import { uploadBusinessLogo, deleteAvatarByUrl } from '../../../src/services/storage/avatarUpload';
import { presentImagePickerActions } from '../../../src/utils/presentImagePickerActions';
import { avatarDebugLog } from '../../../src/utils/avatarDebugLog';
import { isValidEmail } from '../../../src/utils/validators';

export default function BusinessProfileScreen() {
  const { colors, spacing, typography } = useTheme();
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const userId = useAuthStore((state) => state.user?.id);

  // Same Choose -> Crop (native) -> Preview -> Save discipline as
  // profile/edit.tsx's avatar flow: the picked local file previews
  // immediately, but nothing uploads/persists until Save Changes, so a
  // cancelled screen or a failed save never touches the real stored logo.
  const [localLogoUri, setLocalLogoUri] = useState<string | undefined>(undefined);
  const [removeExistingLogo, setRemoveExistingLogo] = useState(false);
  const [businessName, setBusinessName] = useState(profile?.businessName ?? '');
  const [website, setWebsite] = useState(profile?.website ?? '');
  const [businessEmail, setBusinessEmail] = useState(profile?.businessEmail ?? '');
  const [description, setDescription] = useState(profile?.businessDescription ?? '');
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const displayedLogoUri = localLogoUri ?? (removeExistingLogo ? undefined : profile?.businessLogoUri);

  async function handleLogoPress() {
    const action = await presentImagePickerActions(Boolean(displayedLogoUri));
    avatarDebugLog('business logo: picker action', { type: action.type });
    if (action.type === 'picked') {
      setLocalLogoUri(action.image.uri);
      setRemoveExistingLogo(false);
    } else if (action.type === 'removed') {
      setLocalLogoUri(undefined);
      setRemoveExistingLogo(true);
    }
  }

  async function handleSave() {
    if (isSaving) return;
    if (businessEmail.trim().length > 0 && !isValidEmail(businessEmail)) {
      setError('Enter a valid business email');
      return;
    }
    if (!userId) return;
    setIsSaving(true);
    const previousLogoUri = profile?.businessLogoUri;
    // Tracks a just-uploaded object the profile write hasn't successfully
    // referenced yet -- if that write then fails, the catch block cleans
    // it up so the upload doesn't outlive the save it was part of.
    let uploadedButUnsavedUri: string | undefined;
    avatarDebugLog('business logo: save start', {
      userId,
      hasLocalLogo: Boolean(localLogoUri),
      removeExistingLogo,
    });
    try {
      let logoUri = previousLogoUri;
      if (localLogoUri) {
        logoUri = await uploadBusinessLogo(userId, localLogoUri);
        uploadedButUnsavedUri = logoUri;
      } else if (removeExistingLogo) {
        logoUri = undefined;
      }

      await updateProfile(userId, {
        businessName: businessName.trim() || undefined,
        website: website.trim() || undefined,
        businessEmail: businessEmail.trim() || undefined,
        businessDescription: description.trim() || undefined,
        businessLogoUri: logoUri,
      });
      uploadedButUnsavedUri = undefined;
      avatarDebugLog('business logo: database update succeeded', { logoUri });

      // Best-effort cleanup, only once the new state is confirmed saved --
      // never blocks navigating away, never turns a successful save into a
      // visible error.
      if (previousLogoUri && previousLogoUri !== logoUri) {
        deleteAvatarByUrl(previousLogoUri);
      }
      router.back();
    } catch (saveError) {
      avatarDebugLog('business logo: save FAILED', {
        message: saveError instanceof Error ? saveError.message : String(saveError),
      });
      if (uploadedButUnsavedUri) {
        deleteAvatarByUrl(uploadedButUnsavedUri);
      }
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
          <ThemeAwareCard style={{ alignItems: 'center', padding: spacing.xl, marginBottom: spacing.xl }}>
            <Pressable
              onPress={handleLogoPress}
              accessibilityRole="button"
              accessibilityLabel={displayedLogoUri ? 'Change business logo' : 'Add business logo'}
            >
              <BusinessLogo name={businessName.trim() || 'Your Business'} logoUrl={displayedLogoUri} size={88} />
              <View
                style={[
                  styles.cameraBadge,
                  { backgroundColor: colors.primaryAction, borderRadius: 999, borderColor: colors.surface },
                ]}
              >
                <Ionicons name="camera" size={14} color={colors.primaryActionText} />
              </View>
            </Pressable>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
              {displayedLogoUri ? 'Tap to change logo' : 'Tap to add a logo'}
            </Text>
            <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.md }]} numberOfLines={1}>
              {businessName.trim() || 'Your Business'}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
              Business Profile
            </Text>
          </ThemeAwareCard>

          <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.lg }]}>
            This appears on your invoices, receipts, and customer-facing payment pages.
          </Text>

          <TextField
            label="Business Name"
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Your business or company name"
            autoCapitalize="words"
            returnKeyType="next"
          />
          <TextField
            label="Website (Optional)"
            value={website}
            onChangeText={setWebsite}
            placeholder="https://example.com"
            keyboardType="url"
            autoCapitalize="none"
            autoComplete="url"
            returnKeyType="next"
          />
          <TextField
            label="Business Email (Optional)"
            value={businessEmail}
            onChangeText={setBusinessEmail}
            error={error}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />
          <TextField
            label="Short Description (Optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="What does your business do?"
            multiline
          />
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: TAB_BAR_CONTENT_HEIGHT + spacing.sm }}>
          <PrimaryButton label="Save Changes" onPress={handleSave} loading={isSaving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: 4,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
