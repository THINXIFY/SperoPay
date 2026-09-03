import { Alert } from 'react-native';
import { pickImageFromCamera, pickImageFromLibrary, type PickedImage } from '../services/storage/avatarUpload';

export type ImagePickerAction = { type: 'picked'; image: PickedImage } | { type: 'removed' } | { type: 'cancelled' };

// A single, reused entry point for every "add/change/remove a photo" flow
// in the app (user profile, customer photo/logo) -- a native Alert action
// sheet rather than a custom bottom sheet, since the app already uses this
// exact pattern elsewhere (e.g. ProfileScreen's sign-out confirmation) and
// three or four buttons don't need more UI than that.
export function presentImagePickerActions(hasExistingImage: boolean): Promise<ImagePickerAction> {
  return new Promise((resolve) => {
    let settled = false;
    function settle(action: ImagePickerAction) {
      if (settled) return;
      settled = true;
      resolve(action);
    }

    Alert.alert(
      hasExistingImage ? 'Change Photo' : 'Add Photo',
      undefined,
      [
        {
          text: 'Take Photo',
          onPress: async () => settle(await toAction(pickImageFromCamera())),
        },
        {
          text: 'Choose from Photos',
          onPress: async () => settle(await toAction(pickImageFromLibrary())),
        },
        ...(hasExistingImage
          ? [{ text: 'Remove Photo', style: 'destructive' as const, onPress: () => settle({ type: 'removed' as const }) }]
          : []),
        { text: 'Cancel', style: 'cancel' as const, onPress: () => settle({ type: 'cancelled' as const }) },
      ],
      { onDismiss: () => settle({ type: 'cancelled' }), cancelable: true }
    );
  });
}

async function toAction(imagePromise: Promise<PickedImage | null>): Promise<ImagePickerAction> {
  const image = await imagePromise;
  return image ? { type: 'picked', image } : { type: 'cancelled' };
}
