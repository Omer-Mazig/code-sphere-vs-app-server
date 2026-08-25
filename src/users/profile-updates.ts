import { UpdateProfileDto } from './dto/update-profile.dto';

export const CLEARABLE_PROFILE_FIELDS = [
  'bio',
  'avatarUrl',
  'website',
  'github',
  'location',
] as const;

export type ClearableProfileField = (typeof CLEARABLE_PROFILE_FIELDS)[number];

export type ProfileFieldUpdates = {
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  website?: string | null;
  github?: string | null;
  location?: string | null;
};

function trimmedOrOmitted(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function toProfileUpdates(dto: UpdateProfileDto): ProfileFieldUpdates {
  const updates: ProfileFieldUpdates = {};

  if (typeof dto.displayName === 'string') {
    const displayName = trimmedOrOmitted(dto.displayName);
    if (displayName) {
      updates.displayName = displayName;
    }
  }

  for (const field of CLEARABLE_PROFILE_FIELDS) {
    const value = dto[field];
    if (value === undefined) {
      continue;
    }
    if (value === null) {
      updates[field] = null;
      continue;
    }
    const nextValue = trimmedOrOmitted(value);
    if (nextValue) {
      updates[field] = nextValue;
    }
  }

  return updates;
}
