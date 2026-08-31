const MEDIA_OBJECT_ID_PATTERN =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

export const MEDIA_OBJECT_URL_PATTERN = new RegExp(
  `^/api/media/${MEDIA_OBJECT_ID_PATTERN}$`,
);

export const PROFILE_IMAGE_REF_PATTERN = new RegExp(
  `^(https?:\\/\\/\\S+|\\/api\\/media\\/${MEDIA_OBJECT_ID_PATTERN})$`,
);

const MEDIA_OBJECT_ID_FROM_URL = new RegExp(
  `^/api/media/(${MEDIA_OBJECT_ID_PATTERN})$`,
);

export function parseMediaObjectIdFromUrl(
  url: string | null | undefined,
): string | null {
  if (!url) {
    return null;
  }
  const match = url.trim().match(MEDIA_OBJECT_ID_FROM_URL);
  return match?.[1] ?? null;
}
