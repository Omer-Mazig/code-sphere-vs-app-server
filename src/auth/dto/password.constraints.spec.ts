import { PASSWORD_PATTERN } from './password.constraints';

describe('PASSWORD_PATTERN', () => {
  it.each(['Password1', 'abc12345', 'A1aaaaaa'])(
    'accepts %s',
    (password) => {
      expect(PASSWORD_PATTERN.test(password)).toBe(true);
    },
  );

  it.each(['short1', 'password', '12345678', 'abcdefgh'])(
    'rejects %s',
    (password) => {
      expect(PASSWORD_PATTERN.test(password)).toBe(false);
    },
  );
});
