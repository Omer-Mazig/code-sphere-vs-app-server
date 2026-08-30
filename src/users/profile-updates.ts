import { UpdateProfileDto } from './dto/update-profile.dto';

export const PROFILE_PATCH_FIELDS = [
  'displayName',
  'bio',
  'avatarUrl',
  'website',
  'github',
  'location',
] as const;

export type ProfilePatchField = (typeof PROFILE_PATCH_FIELDS)[number];

export type ProfileFieldUpdates = {
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  website?: string | null;
  github?: string | null;
  location?: string | null;
};

export function toProfileUpdates(dto: UpdateProfileDto): ProfileFieldUpdates {
  const updates: ProfileFieldUpdates = {};

  for (const field of PROFILE_PATCH_FIELDS) {
    const value = dto[field];
    if (value === undefined) {
      continue;
    }
    if (value === null) {
      updates[field] = null;
      continue;
    }
    const trimmed = value.trim();
    updates[field] = trimmed.length > 0 ? trimmed : null;
  }

  return updates;
}
