import { ValidationError } from 'class-validator';
import { flattenValidationErrors } from './flatten-validation-errors';

describe('flattenValidationErrors', () => {
  it('maps each constraint onto the property name', () => {
    const error = new ValidationError();
    error.property = 'password';
    error.constraints = {
      minLength: 'Password must be at least 8 characters',
      matches: 'Password must contain a number',
    };

    expect(flattenValidationErrors([error])).toEqual([
      { field: 'password', message: 'Password must be at least 8 characters' },
      { field: 'password', message: 'Password must contain a number' },
    ]);
  });

  it('nests child properties with dot paths', () => {
    const child = new ValidationError();
    child.property = 'email';
    child.constraints = { isEmail: 'email must be an email' };

    const parent = new ValidationError();
    parent.property = 'user';
    parent.children = [child];

    expect(flattenValidationErrors([parent])).toEqual([
      { field: 'user.email', message: 'email must be an email' },
    ]);
  });

  it('skips empty constraint messages', () => {
    const error = new ValidationError();
    error.property = 'bio';
    error.constraints = { maxLength: '' };

    expect(flattenValidationErrors([error])).toEqual([]);
  });
});
