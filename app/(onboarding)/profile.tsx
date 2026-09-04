import { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { SelectField } from '../../src/components/SelectField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { UserAvatar } from '../../src/components/UserAvatar';
import { CountrySelectSheet } from '../../src/components/CountrySelectSheet';
import { useProfileStore } from '../../src/store/profileStore';
import { useAuthStore } from '../../src/store/authStore';
import { uploadUserAvatar, deleteAvatarByUrl } from '../../src/services/storage/avatarUpload';
import { presentImagePickerActions } from '../../src/utils/presentImagePickerActions';
import { avatarDebugLog } from '../../src/utils/avatarDebugLog';
import { findCountryByName } from '../../src/utils/countries';

export default function ProfileSetupScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const authFullName = useAuthStore((state) => state.user?.fullName);
  const userId = useAuthStore((state) => state.user?.id);

  // Choose -> Crop (native, via the picker) -> Preview -> Continue: the same
  // staged-until-save discipline as Edit Profile (src/store see
  // app/(app)/profile/edit.tsx) -- nothing uploads until the user actually
  // taps Continue, so a cancelled onboarding session never uploads an
  // orphaned image, and a failed upload leaves the local pick staged for
  // retry rather than losing it.
  const [localImageUri, setLocalImageUri] = useState<string | undefined>(undefined);
  // Onboarding is normally a single pass, but a user can be routed back into
  // this screen with an avatar already saved from an earlier, interrupted
  // attempt (e.g. the app closed partway through a later onboarding step) --
  // falls back to that existing photo exactly like Edit Profile does, so it
  // isn't visually "lost" (still there in the DB either way, but showing
  // initials instead would read as if it had been).
  const [removeExistingAvatar, setRemoveExistingAvatar] = useState(false);
  const displayedAvatarUri = localImageUri ?? (removeExistingAvatar ? undefined : profile?.avatarUri);
  const [displayName, setDisplayName] = useState(profile?.displayName || authFullName || '');
  const [businessName, setBusinessName] = useState(profile?.businessName ?? '');
  const [country, setCountry] = useState(profile?.country ?? '');
  const [website, setWebsite] = useState(profile?.website ?? '');
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const countrySheetRef = useRef<BottomSheet>(null);
  const [isCountrySheetMounted, setIsCountrySheetMounted] = useState(false);

  function openCountrySheet() {
    if (isCountrySheetMounted) {
      countrySheetRef.current?.expand();
    } else {
      setIsCountrySheetMounted(true);
    }
  }

  // Defense in depth for a backgrounded instance of this screen being
  // reused with a sheet left open from an earlier visit -- matches the
  // established convention (see app/request/amount.tsx).
  useFocusEffect(
    useCallback(() => {
      countrySheetRef.current?.forceClose();
    }, [])
  );

  async function handleAvatarPress() {
    const action = await presentImagePickerActions(Boolean(displayedAvatarUri));
    avatarDebugLog('onboarding profile: picker action', { type: action.type });
    if (action.type === 'picked') {
      setLocalImageUri(action.image.uri);
      setRemoveExistingAvatar(false);
    } else if (action.type === 'removed') {
      setLocalImageUri(undefined);
      setRemoveExistingAvatar(true);
    }
  }

  async function handleContinue() {
    if (isSubmitting) return;
    if (displayName.trim().length === 0) {
      setError('Enter a display name');
      return;
    }
    if (!userId) return;
    setIsSubmitting(true);
    // Tracks a just-uploaded object the profile write hasn't successfully
    // referenced yet -- cleaned up below if the write then fails, so a
    // retry doesn't accumulate orphaned Storage objects.
    let uploadedButUnsavedUri: string | undefined;
    avatarDebugLog('onboarding profile: continue start', {
      userId,
      hasLocalImage: Boolean(localImageUri),
      removeExistingAvatar,
    });
    try {
      let avatarUri = profile?.avatarUri;
      if (localImageUri) {
        avatarUri = await uploadUserAvatar(userId, localImageUri);
        uploadedButUnsavedUri = avatarUri;
      } else if (removeExistingAvatar) {
        avatarUri = undefined;
      }

      await updateProfile(userId, {
        displayName: displayName.trim(),
        businessName: businessName.trim() || undefined,
        country: country.trim(),
        website: website.trim() || undefined,
        avatarUri,
      });
      uploadedButUnsavedUri = undefined;
      avatarDebugLog('onboarding profile: continue succeeded', { avatarUri });
      router.push('/(onboarding)/wallet-setup');
    } catch (submitError) {
      avatarDebugLog('onboarding profile: continue FAILED', {
        message: submitError instanceof Error ? submitError.message : String(submitError),
      });
      // Best-effort only -- never lets a cleanup failure mask the real
      // error the user needs to see and retry from.
      if (uploadedButUnsavedUri) {
        deleteAvatarByUrl(uploadedButUnsavedUri);
      }
      Alert.alert('Something went wrong', "We couldn't save that. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Your Profile" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={handleAvatarPress}
            style={{ alignSelf: 'center', marginBottom: spacing.sm }}
            accessibilityRole="button"
            accessibilityLabel={displayedAvatarUri ? 'Change profile photo' : 'Add profile photo'}
          >
            <UserAvatar name={displayName.trim() || 'F'} avatarUri={displayedAvatarUri} size={96} />
            <View
              style={[
                styles.cameraBadge,
                { backgroundColor: colors.primaryAction, borderRadius: radius.full, borderColor: colors.background },
              ]}
            >
              <Ionicons name="camera" size={14} color={colors.primaryActionText} />
            </View>
          </Pressable>
          <Text
            style={[typography.bodyMedium, { color: colors.textPrimary, textAlign: 'center', marginTop: spacing.sm }]}
          >
            {displayedAvatarUri ? 'Change photo' : 'Add profile photo'}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs / 2, marginBottom: spacing.xl }]}
          >
            You can change this anytime.
          </Text>

          <TextField
            label="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            error={error}
            placeholder="e.g. Farhan Zafar"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
          />
          <TextField
            label="Business Name (Optional)"
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="e.g. THINXIFY"
            autoCapitalize="words"
            returnKeyType="next"
          />
          <View style={{ marginBottom: spacing.base }}>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              Country
            </Text>
            <SelectField
              icon="earth-outline"
              label={country || 'Select your country'}
              isPlaceholder={!country}
              accessibilityLabel="Select country"
              onPress={openCountrySheet}
            />
          </View>
          <TextField
            label="Website (Optional)"
            value={website}
            onChangeText={setWebsite}
            placeholder="e.g. https://yourcompany.com"
            keyboardType="url"
            autoCapitalize="none"
            autoComplete="url"
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
          <PrimaryButton label="Continue" onPress={handleContinue} loading={isSubmitting} />
        </View>
      </KeyboardAvoidingView>

      {isCountrySheetMounted ? (
        <CountrySelectSheet
          ref={countrySheetRef}
          initialIndex={0}
          selectedCode={findCountryByName(country)?.code}
          onSelect={(selected) => {
            setCountry(selected.name);
            countrySheetRef.current?.close();
          }}
        />
      ) : null}
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
