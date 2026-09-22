import { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { TAB_BAR_CONTENT_HEIGHT } from '../../../src/components/BottomNavigation';
import { TextField } from '../../../src/components/TextField';
import { SelectField } from '../../../src/components/SelectField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { UserAvatar } from '../../../src/components/UserAvatar';
import { AvatarBorderPicker } from '../../../src/components/AvatarBorderPicker';
import { CountrySelectSheet } from '../../../src/components/CountrySelectSheet';
import { useProfileStore } from '../../../src/store/profileStore';
import { useAuthStore } from '../../../src/store/authStore';
import { uploadUserAvatar, deleteAvatarByUrl } from '../../../src/services/storage/avatarUpload';
import { presentImagePickerActions } from '../../../src/utils/presentImagePickerActions';
import { avatarDebugLog } from '../../../src/utils/avatarDebugLog';
import { findCountryByName } from '../../../src/utils/countries';
import type { AvatarBorderStyle } from '../../../src/types';

export default function EditProfileScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const userId = useAuthStore((state) => state.user?.id);

  // Choose -> Crop (native, via the picker) -> Preview -> Save: the picked
  // local file is shown immediately (an Image happily renders a local
  // file:// uri the same as a remote one), but nothing is actually
  // uploaded/persisted until Save Changes -- so a failed save leaves the
  // real stored avatar untouched and the local pick still staged for retry,
  // and cancelling this screen entirely never uploads anything at all.
  const [localImageUri, setLocalImageUri] = useState<string | undefined>(undefined);
  const [removeExistingAvatar, setRemoveExistingAvatar] = useState(false);
  const [avatarBorderStyle, setAvatarBorderStyle] = useState<AvatarBorderStyle>(profile?.avatarBorderStyle ?? 'none');
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [country, setCountry] = useState(profile?.country ?? '');
  const [website, setWebsite] = useState(profile?.website ?? '');
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const displayedAvatarUri = localImageUri ?? (removeExistingAvatar ? undefined : profile?.avatarUri);

  const countrySheetRef = useRef<BottomSheet>(null);
  const [isCountrySheetMounted, setIsCountrySheetMounted] = useState(false);

  function openCountrySheet() {
    if (isCountrySheetMounted) {
      countrySheetRef.current?.expand();
    } else {
      setIsCountrySheetMounted(true);
    }
  }

  useFocusEffect(
    useCallback(() => {
      countrySheetRef.current?.forceClose();
    }, [])
  );

  async function handleAvatarPress() {
    const action = await presentImagePickerActions(Boolean(displayedAvatarUri));
    avatarDebugLog('edit profile: picker action', { type: action.type });
    if (action.type === 'picked') {
      setLocalImageUri(action.image.uri);
      setRemoveExistingAvatar(false);
    } else if (action.type === 'removed') {
      setLocalImageUri(undefined);
      setRemoveExistingAvatar(true);
    }
  }

  async function handleSave() {
    if (isSaving) return;
    if (displayName.trim().length === 0) {
      setError('Enter a display name');
      return;
    }
    if (!userId) return;
    setIsSaving(true);
    const previousAvatarUri = profile?.avatarUri;
    // Tracks a just-uploaded object that the profile write hasn't
    // successfully referenced yet -- if that write then fails, this is
    // what the catch block below needs to clean up so the upload doesn't
    // outlive the save it was part of.
    let uploadedButUnsavedUri: string | undefined;
    avatarDebugLog('edit profile: save start', {
      userId,
      hasLocalImage: Boolean(localImageUri),
      removeExistingAvatar,
      avatarBorderStyle,
    });
    try {
      let avatarUri = previousAvatarUri;
      if (localImageUri) {
        avatarUri = await uploadUserAvatar(userId, localImageUri);
        uploadedButUnsavedUri = avatarUri;
      } else if (removeExistingAvatar) {
        avatarUri = undefined;
      }

      await updateProfile(userId, {
        displayName: displayName.trim(),
        country: country.trim(),
        website: website.trim() || undefined,
        avatarUri,
        avatarBorderStyle,
      });
      uploadedButUnsavedUri = undefined;
      avatarDebugLog('edit profile: database update succeeded', {
        avatarUri,
        // Confirms the store actually reflects the new value right after
        // updateProfile resolves -- if the UI doesn't update but this log
        // shows the new URL, the bug is in rendering, not in the save.
        storeAvatarUri: useProfileStore.getState().profile?.avatarUri,
      });

      // Best-effort cleanup, only once the new state is confirmed saved --
      // never blocks navigating away, never allowed to turn a successful
      // save into a visible error.
      if (previousAvatarUri && previousAvatarUri !== avatarUri) {
        deleteAvatarByUrl(previousAvatarUri);
      }
      router.back();
    } catch (saveError) {
      avatarDebugLog('edit profile: save FAILED', {
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
      <AppHeader title="Edit Profile" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={handleAvatarPress}
            style={{ alignSelf: 'center', marginBottom: spacing.sm }}
            accessibilityRole="button"
            accessibilityLabel={displayedAvatarUri ? 'Change profile photo' : 'Add profile photo'}
          >
            <UserAvatar name={displayName.trim() || 'F'} avatarUri={displayedAvatarUri} borderStyle={avatarBorderStyle} size={88} />
            <View
              style={[
                styles.cameraBadge,
                { backgroundColor: colors.primaryAction, borderRadius: radius.full, borderColor: colors.background },
              ]}
            >
              <Ionicons name="camera" size={14} color={colors.primaryActionText} />
            </View>
          </Pressable>
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl }]}>
            {displayedAvatarUri ? 'Tap to change photo' : 'Tap to add a photo'}
          </Text>

          <TextField
            label="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            error={error}
            placeholder="Enter your display name"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
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
            placeholder="https://example.com"
            keyboardType="url"
            autoCapitalize="none"
            autoComplete="url"
            returnKeyType="done"
          />

          <View style={{ marginTop: spacing.base, marginBottom: spacing.lg }}>
            <AvatarBorderPicker value={avatarBorderStyle} onChange={setAvatarBorderStyle} />
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: TAB_BAR_CONTENT_HEIGHT + spacing.sm }}>
          <PrimaryButton label="Save Changes" onPress={handleSave} loading={isSaving} />
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
