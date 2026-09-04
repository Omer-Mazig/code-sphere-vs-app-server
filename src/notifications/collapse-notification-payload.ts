import { NotificationType } from './entities/notification.entity';
import type { NotificationPayload } from './dto';

export const MAX_COLLAPSE_ACTOR_PREVIEWS = 3;

export const COLLAPSIBLE_NOTIFICATION_TYPES = [
  NotificationType.POST_LIKED,
  NotificationType.POST_COMMENTED,
  NotificationType.ARTICLE_LIKED,
  NotificationType.ARTICLE_COMMENTED,
  NotificationType.NEW_FOLLOWER,
] as const;

export function isCollapsibleNotificationType(
  type: NotificationType,
): boolean {
  return (COLLAPSIBLE_NOTIFICATION_TYPES as readonly NotificationType[]).includes(
    type,
  );
}

export function seedCollapsedNotificationPayload(
  payload: NotificationPayload,
): NotificationPayload {
  return {
    ...payload,
    actorIds: [payload.actorId],
    actorNames: [payload.actorName],
    actorCount: 1,
  } as NotificationPayload;
}

export function mergeCollapsedNotificationPayload(
  existing: Record<string, unknown>,
  incoming: NotificationPayload,
): NotificationPayload {
  const previewIds = asStringArray(existing.actorIds);
  const previewNames = asStringArray(existing.actorNames);
  const previousIds =
    previewIds.length > 0
      ? previewIds
      : typeof existing.actorId === 'string'
        ? [existing.actorId]
        : [];

  const nameById = new Map<string, string>();
  previousIds.forEach((id, index) => {
    const name = previewNames[index];
    if (name) {
      nameById.set(id, name);
    }
  });
  if (
    typeof existing.actorId === 'string' &&
    typeof existing.actorName === 'string'
  ) {
    nameById.set(existing.actorId, existing.actorName);
  }
  nameById.set(incoming.actorId, incoming.actorName);

  const alreadyCounted = previousIds.includes(incoming.actorId);
  const previousCount =
    typeof existing.actorCount === 'number' && existing.actorCount > 0
      ? existing.actorCount
      : Math.max(previousIds.length, 1);

  const actorIds = [
    incoming.actorId,
    ...previousIds.filter((id) => id !== incoming.actorId),
  ].slice(0, MAX_COLLAPSE_ACTOR_PREVIEWS);
  const actorNames = actorIds.map((id) => nameById.get(id) ?? 'Someone');
  const actorCount = alreadyCounted ? previousCount : previousCount + 1;

  return {
    ...incoming,
    actorIds,
    actorNames,
    actorCount,
  } as NotificationPayload;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}
