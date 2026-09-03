jest.mock('expo-image-picker', () => ({
  __esModule: true,
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  __esModule: true,
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

jest.mock('base64-arraybuffer', () => ({
  decode: jest.fn((base64: string) => `decoded:${base64}`),
}));

jest.mock('../../../lib/supabase', () => {
  // Defined inside the factory (not as an outer "mock"-prefixed const) so
  // from() always returns this SAME object on every call -- the code under
  // test calls supabase.storage.from(bucket) once per upload/delete, and
  // the test needs those calls to land on the one chain object it inspects,
  // not a fresh set of jest.fn()s each time.
  const storageChain = { upload: jest.fn(), getPublicUrl: jest.fn(), remove: jest.fn() };
  return {
    supabase: {
      storage: {
        from: jest.fn(() => storageChain),
      },
    },
  };
});

import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';
import { supabase } from '../../../lib/supabase';
import {
  pickImageFromLibrary,
  pickImageFromCamera,
  uploadUserAvatar,
  uploadCustomerAvatar,
  deleteAvatarByUrl,
} from '../avatarUpload';

const mockRequestMediaLibraryPermissionsAsync = jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync);
const mockRequestCameraPermissionsAsync = jest.mocked(ImagePicker.requestCameraPermissionsAsync);
const mockLaunchImageLibraryAsync = jest.mocked(ImagePicker.launchImageLibraryAsync);
const mockLaunchCameraAsync = jest.mocked(ImagePicker.launchCameraAsync);
const mockManipulate = jest.mocked(ImageManipulator.manipulate);
// The bucket's `from(...)` always returns the same mocked chain object in
// this file (configured once below), so it's fetched once here rather than
// re-derived from a fresh from() call in every test.
const mockStorageFrom = jest.mocked(supabase.storage.from('avatars'));

beforeEach(() => {
  jest.clearAllMocks();
  const renderAsync = jest.fn().mockResolvedValue({ saveAsync: jest.fn().mockResolvedValue({ base64: 'fake-base64' }) });
  const resize = jest.fn(() => ({ renderAsync }));
  mockManipulate.mockReturnValue({ resize } as unknown as ReturnType<typeof ImageManipulator.manipulate>);
  mockStorageFrom.upload.mockResolvedValue({ data: { path: 'ok', id: 'ok', fullPath: 'ok' }, error: null } as never);
  mockStorageFrom.getPublicUrl.mockReturnValue({
    data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/avatars/users/user-1/123.jpg' },
  } as never);
});

describe('pickImageFromLibrary', () => {
  it('returns null without opening the picker when permission is denied', async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false } as never);

    const result = await pickImageFromLibrary();

    expect(result).toBeNull();
    expect(mockLaunchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('returns null when the user cancels the picker', async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);

    const result = await pickImageFromLibrary();

    expect(result).toBeNull();
  });

  it('returns the picked asset uri, requesting a 1:1 crop', async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://picked.jpg' }] } as never);

    const result = await pickImageFromLibrary();

    expect(result).toEqual({ uri: 'file://picked.jpg' });
    expect(mockLaunchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }));
  });
});

describe('pickImageFromCamera', () => {
  it('returns null without opening the camera when permission is denied', async () => {
    mockRequestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);

    const result = await pickImageFromCamera();

    expect(result).toBeNull();
    expect(mockLaunchCameraAsync).not.toHaveBeenCalled();
  });
});

describe('uploadUserAvatar', () => {
  it("uploads the normalized image under the given user's own path and returns the public URL", async () => {
    const url = await uploadUserAvatar('user-1', 'file://picked.jpg');

    expect(mockManipulate).toHaveBeenCalledWith('file://picked.jpg');
    expect(mockStorageFrom.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^users\/user-1\/\d+\.jpg$/),
      'decoded:fake-base64',
      expect.objectContaining({ contentType: 'image/jpeg', upsert: true })
    );
    expect(url).toBe('https://project.supabase.co/storage/v1/object/public/avatars/users/user-1/123.jpg');
  });

  it('throws and does not return a URL when the Storage upload fails', async () => {
    mockStorageFrom.upload.mockResolvedValue({ data: null, error: new Error('network down') } as never);

    await expect(uploadUserAvatar('user-1', 'file://picked.jpg')).rejects.toThrow('network down');
  });
});

describe('uploadCustomerAvatar', () => {
  it("uploads under the owning user's id and the customer's id, not just the customer id", async () => {
    await uploadCustomerAvatar('user-1', 'cust-9', 'file://picked.jpg');

    expect(mockStorageFrom.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^customers\/user-1\/cust-9\/\d+\.jpg$/),
      expect.anything(),
      expect.anything()
    );
  });
});

describe('deleteAvatarByUrl', () => {
  it('removes the object at the path extracted from a public URL', async () => {
    mockStorageFrom.remove.mockResolvedValue({ data: null, error: null } as never);

    await deleteAvatarByUrl('https://project.supabase.co/storage/v1/object/public/avatars/users/user-1/123.jpg');

    expect(mockStorageFrom.remove).toHaveBeenCalledWith(['users/user-1/123.jpg']);
  });

  it('never throws, even when the URL is unrecognized', async () => {
    await expect(deleteAvatarByUrl('not-a-real-url')).resolves.toBeUndefined();
    expect(mockStorageFrom.remove).not.toHaveBeenCalled();
  });

  it('never throws, even when the underlying remove call fails', async () => {
    mockStorageFrom.remove.mockRejectedValue(new Error('boom'));

    await expect(
      deleteAvatarByUrl('https://project.supabase.co/storage/v1/object/public/avatars/users/user-1/123.jpg')
    ).resolves.toBeUndefined();
  });
});
