import { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { UserAvatar } from '../../../src/components/UserAvatar';
import { AvatarBorderPicker } from '../../../src/components/AvatarBorderPicker';
import { useProfileStore } from '../../../src/store/profileStore';
import { useAuthStore } from '../../../src/store/authStore';
import { uploadUserAvatar, deleteAvatarByUrl } from '../../../src/services/storage/avatarUpload';
import { presentImagePickerActions } from '../../../src/utils/presentImagePickerActions';
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

  async function handleAvatarPress() {
    const action = await presentImagePickerActions(Boolean(displayedAvatarUri));
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

      // Best-effort cleanup, only once the new state is confirmed saved --
      // never blocks navigating away, never allowed to turn a successful
      // save into a visible error.
      if (previousAvatarUri && previousAvatarUri !== avatarUri) {
        deleteAvatarByUrl(previousAvatarUri);
      }
      router.back();
    } catch {
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
            returnKeyType="next"
          />
          <TextField label="Country" value={country} onChangeText={setCountry} returnKeyType="next" />
          <TextField
            label="Website (Optional)"
            value={website}
            onChangeText={setWebsite}
            keyboardType="url"
            autoCapitalize="none"
            returnKeyType="done"
          />

          <View style={{ marginTop: spacing.base, marginBottom: spacing.lg }}>
            <AvatarBorderPicker value={avatarBorderStyle} onChange={setAvatarBorderStyle} />
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
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
