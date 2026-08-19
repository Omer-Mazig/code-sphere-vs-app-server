export const DEFAULT_SENSITIVE_FIELDS = [
  'password',
  'currentPassword',
  'newPassword',
  'refreshToken',
  'accessToken',
  'token',
  'tokenHash',
] as const;

const REDACTED = '[Redacted]';

export function redactSensitiveFields<T>(
  value: T,
  fields: readonly string[] = DEFAULT_SENSITIVE_FIELDS,
): T {
  const fieldSet = new Set(fields.map((field) => field.toLowerCase()));
  return redactValue(value, fieldSet) as T;
}

function redactValue(value: unknown, fields: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, fields));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = fields.has(key.toLowerCase())
        ? REDACTED
        : redactValue(nested, fields);
    }
    return result;
  }

  return value;
}
