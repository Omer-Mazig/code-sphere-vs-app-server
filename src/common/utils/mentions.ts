const USERNAME_MENTION_REGEX = /@([a-zA-Z0-9_-]{3,30})/g;

export function extractMentionedUsernames(content: string): string[] {
  const usernames = new Map<string, string>();
  let match = USERNAME_MENTION_REGEX.exec(content);

  while (match) {
    const username = match[1];
    const key = username.toLowerCase();
    if (!usernames.has(key)) {
      usernames.set(key, username);
    }
    match = USERNAME_MENTION_REGEX.exec(content);
  }

  USERNAME_MENTION_REGEX.lastIndex = 0;
  return Array.from(usernames.values());
}

export function flattenRichText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(flattenRichText).filter(Boolean).join('\n');
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.content === 'string') {
      return record.content;
    }
    return Object.values(record).map(flattenRichText).filter(Boolean).join('\n');
  }

  return '';
}

export function newlyMentionedUsernames(
  nextContent: string,
  previousContent = '',
): string[] {
  const previous = new Set(
    extractMentionedUsernames(previousContent).map((username) =>
      username.toLowerCase(),
    ),
  );
  return extractMentionedUsernames(nextContent).filter(
    (username) => !previous.has(username.toLowerCase()),
  );
}
