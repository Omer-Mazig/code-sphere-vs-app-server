import { redactSensitiveFields } from './redact-sensitive-fields';

describe('redactSensitiveFields', () => {
  it('redacts known secret keys without mutating the original', () => {
    const body = {
      email: 'ada@example.com',
      password: 'hunter2',
      nested: { refreshToken: 'abc', note: 'ok' },
    };

    const redacted = redactSensitiveFields(body);

    expect(redacted).toEqual({
      email: 'ada@example.com',
      password: '[Redacted]',
      nested: { refreshToken: '[Redacted]', note: 'ok' },
    });
    expect(body.password).toBe('hunter2');
    expect(body.nested.refreshToken).toBe('abc');
  });

  it('redacts keys case-insensitively and inside arrays', () => {
    const redacted = redactSensitiveFields({
      Password: 'x',
      items: [{ accessToken: 'tok', id: '1' }],
    });

    expect(redacted).toEqual({
      Password: '[Redacted]',
      items: [{ accessToken: '[Redacted]', id: '1' }],
    });
  });

  it('leaves primitives unchanged', () => {
    expect(redactSensitiveFields('password')).toBe('password');
    expect(redactSensitiveFields(null)).toBeNull();
  });
});
