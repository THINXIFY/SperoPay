import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { avatarDebugLog } from '../../utils/avatarDebugLog';

const AVATAR_BUCKET = 'avatars';
const AVATAR_TARGET_SIZE = 512;
const JPEG_COMPRESSION = 0.85;

export interface PickedImage {
  uri: string;
}

function resultToPickedImage(result: ImagePicker.ImagePickerResult, source: 'library' | 'camera'): PickedImage | null {
  if (result.canceled || result.assets.length === 0) {
    avatarDebugLog('picker result: cancelled', { source });
    return null;
  }
  const asset = result.assets[0];
  avatarDebugLog('picker result: asset selected', {
    source,
    uri: asset.uri,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize,
  });
  return { uri: asset.uri };
}

// Opens the OS's native photo library picker with a built-in 1:1 crop step
// (allowsEditing + aspect), requesting the Photos permission just-in-time
// rather than at app launch. Returns null -- not a thrown error -- if the
// user cancels the picker OR the permission is denied: both are "no-op,
// nothing changed" from the caller's perspective, not failures worth
// alerting about.
export async function pickImageFromLibrary(): Promise<PickedImage | null> {
  avatarDebugLog('picker opened: library');
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  avatarDebugLog('permission result: media library', { granted: permission.granted, canAskAgain: permission.canAskAgain });
  if (!permission.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });
  return resultToPickedImage(result, 'library');
}

// Same contract as pickImageFromLibrary, via the camera instead.
export async function pickImageFromCamera(): Promise<PickedImage | null> {
  avatarDebugLog('picker opened: camera');
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  avatarDebugLog('permission result: camera', { granted: permission.granted, canAskAgain: permission.canAskAgain });
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });
  return resultToPickedImage(result, 'camera');
}

// Resizes to a fixed square target and re-encodes as a compressed JPEG --
// run on every picked image before it's ever uploaded, regardless of the
// original file's size or format. The image picker's own crop step above
// already produces a square (or effectively square) source, so resizing to
// AVATAR_TARGET_SIZE on both axes here is a uniform scale-down, not a
// distortion. Re-encoding through the manipulator also normalizes EXIF
// orientation, since the rendered output has no orientation metadata left
// to misinterpret.
async function normalizeForUpload(localUri: string): Promise<string> {
  avatarDebugLog('processing: start', { localUri, targetSize: AVATAR_TARGET_SIZE });
  const rendered = await ImageManipulator.manipulate(localUri)
    .resize({ width: AVATAR_TARGET_SIZE, height: AVATAR_TARGET_SIZE })
    .renderAsync();
  const saved = await rendered.saveAsync({ base64: true, compress: JPEG_COMPRESSION, format: SaveFormat.JPEG });
  if (!saved.base64) {
    avatarDebugLog('processing: FAILED, no base64 in result', { localUri });
    throw new Error('Image processing failed to produce image data.');
  }
  // base64 encodes 3 bytes as 4 characters -- an approximation, not the
  // exact byte count, but accurate enough to sanity-check "is this roughly
  // the size I expect" without pulling in expo-file-system just to stat it.
  const approxBytes = Math.round((saved.base64.length * 3) / 4);
  avatarDebugLog('processing: done', {
    processedUri: saved.uri,
    width: saved.width,
    height: saved.height,
    approxBytes,
    approxKB: Math.round(approxBytes / 1024),
  });
  return saved.base64;
}

// Every filename includes the current time, so replacing an image always
// produces a brand-new object path -- the natural, simplest form of cache
// busting (a genuinely new URL, not a stale one an HTTP/RN Image cache
// might still be holding), and it sidesteps ever needing to overwrite an
// object still referenced by a cache.
function buildUserAvatarPath(userId: string): string {
  return `users/${userId}/${Date.now()}.jpg`;
}

function buildCustomerAvatarPath(userId: string, customerId: string): string {
  return `customers/${userId}/${customerId}/${Date.now()}.jpg`;
}

async function uploadToPath(path: string, base64: string): Promise<string> {
  const bytes = decode(base64);
  avatarDebugLog('storage upload: start', { bucket: AVATAR_BUCKET, path, byteLength: bytes.byteLength, contentType: 'image/jpeg' });
  const { data: uploadData, error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) {
    // The real error (message, and status/statusCode if the SDK attaches
    // one) is what actually explains an upload failure -- e.g. a bucket/
    // policy mismatch shows up here as a 403/"row-level security" message,
    // a wrong project shows up as the bucket not existing at all. This is
    // never shown to the user directly; callers map it to calm UI copy.
    avatarDebugLog('storage upload: FAILED', {
      path,
      message: error.message,
      name: error.name,
      status: (error as { status?: number; statusCode?: string }).status ?? (error as { statusCode?: string }).statusCode,
    });
    throw error;
  }
  avatarDebugLog('storage upload: success', { path: uploadData?.path ?? path });
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  avatarDebugLog('storage upload: public URL resolved', { publicUrl: data.publicUrl });
  return data.publicUrl;
}

// Crops (already done by the picker), normalizes, and uploads to the
// user's own path -- RLS on storage.objects only allows this when userId
// matches auth.uid(), so this never needs to be called with any other
// user's id in the first place.
export async function uploadUserAvatar(userId: string, localUri: string): Promise<string> {
  avatarDebugLog('uploadUserAvatar: start', { userId, localUri });
  const base64 = await normalizeForUpload(localUri);
  const url = await uploadToPath(buildUserAvatarPath(userId), base64);
  avatarDebugLog('uploadUserAvatar: done', { userId, url });
  return url;
}

// userId here is the CUSTOMER'S OWNER, not the customer -- customers don't
// have their own auth identity, so ownership (and the RLS path check) is
// always keyed on the merchant who owns them.
export async function uploadCustomerAvatar(userId: string, customerId: string, localUri: string): Promise<string> {
  avatarDebugLog('uploadCustomerAvatar: start', { userId, customerId, localUri });
  const base64 = await normalizeForUpload(localUri);
  const url = await uploadToPath(buildCustomerAvatarPath(userId, customerId), base64);
  avatarDebugLog('uploadCustomerAvatar: done', { userId, customerId, url });
  return url;
}

// Best-effort cleanup of a previous avatar object once a new one has
// already uploaded successfully, or an image was removed outright.
// Deliberately never throws and is safe to fire-and-forget: a failed
// delete here is an orphaned Storage object, not a correctness problem,
// and must never undo an otherwise-successful replace/remove by surfacing
// an error to the user.
export async function deleteAvatarByUrl(publicUrl: string): Promise<void> {
  try {
    const marker = `/object/public/${AVATAR_BUCKET}/`;
    const index = publicUrl.indexOf(marker);
    if (index === -1) {
      avatarDebugLog('delete: skipped, URL did not match this bucket', { publicUrl });
      return;
    }
    const path = decodeURIComponent(publicUrl.slice(index + marker.length));
    avatarDebugLog('delete: start', { path });
    const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    avatarDebugLog(error ? 'delete: FAILED (non-fatal, orphaned object)' : 'delete: success', { path, message: error?.message });
  } catch (error) {
    avatarDebugLog('delete: threw (non-fatal, orphaned object)', { message: error instanceof Error ? error.message : String(error) });
    // See function comment -- intentionally swallowed.
  }
}
