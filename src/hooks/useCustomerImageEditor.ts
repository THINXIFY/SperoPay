import { useState } from 'react';
import { presentImagePickerActions } from '../utils/presentImagePickerActions';
import type { CustomerImageType } from '../types';

interface UseCustomerImageEditorInitial {
  avatarUrl?: string;
  imageType?: CustomerImageType;
}

// Shared staging logic for "add/change/remove a customer photo or logo" --
// used by both the Add Customer sheet and the Edit Customer sheet. Mirrors
// the same "stage locally, only upload on Save" approach as Edit Profile
// (see profile/edit.tsx): the picked local file is shown immediately, but
// nothing is uploaded/persisted until the caller's own save handler runs,
// so a cancelled sheet or a failed save never uploads or orphans anything.
export function useCustomerImageEditor(initial: UseCustomerImageEditorInitial) {
  const [localUri, setLocalUri] = useState<string | undefined>(undefined);
  const [removed, setRemoved] = useState(false);
  const [imageType, setImageType] = useState<CustomerImageType>(initial.imageType ?? 'photo');

  const displayUri = localUri ?? (removed ? undefined : initial.avatarUrl);
  const hasImage = Boolean(displayUri);

  async function handlePress() {
    const action = await presentImagePickerActions(hasImage);
    if (action.type === 'picked') {
      setLocalUri(action.image.uri);
      setRemoved(false);
    } else if (action.type === 'removed') {
      setLocalUri(undefined);
      setRemoved(true);
    }
  }

  function reset() {
    setLocalUri(undefined);
    setRemoved(false);
    setImageType(initial.imageType ?? 'photo');
  }

  return { displayUri, hasImage, imageType, setImageType, handlePress, localUri, removed, reset };
}
