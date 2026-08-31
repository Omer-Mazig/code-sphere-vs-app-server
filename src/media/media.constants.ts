export const DEFAULT_MEDIA_MAX_BYTES = 10 * 1024 * 1024;

export const IMAGE_MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export const ALLOWED_IMAGE_MIME_TYPES = new Set(
  Object.keys(IMAGE_MIME_TO_EXTENSION),
);

const STORAGE_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp)$/i;

export function isAllowedImageMime(mimeType: string): boolean {
  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType);
}

export function extensionForImageMime(mimeType: string): string | undefined {
  return IMAGE_MIME_TO_EXTENSION[mimeType];
}

export function isSafeStorageKey(key: string): boolean {
  return (
    !key.includes('..') &&
    !key.includes('/') &&
    !key.includes('\\') &&
    STORAGE_KEY_PATTERN.test(key)
  );
}

export function bufferMatchesImageMime(
  buffer: Buffer,
  mimeType: string,
): boolean {
  if (buffer.length < 12) {
    return false;
  }

  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }

  if (mimeType === 'image/gif') {
    return buffer.subarray(0, 3).toString('ascii') === 'GIF';
  }

  if (mimeType === 'image/webp') {
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }

  return false;
}
