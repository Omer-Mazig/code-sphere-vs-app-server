import { toProfileUpdates } from './profile-updates';

describe('toProfileUpdates', () => {
  it('keeps only defined non-empty displayName values', () => {
    expect(toProfileUpdates({ displayName: '  Ada  ' })).toEqual({
      displayName: 'Ada',
    });
    expect(toProfileUpdates({ displayName: '   ' })).toEqual({});
    expect(toProfileUpdates({ displayName: undefined })).toEqual({});
  });

  it('writes null for explicitly cleared optional fields', () => {
    expect(
      toProfileUpdates({
        bio: null,
        location: null,
        website: null,
        github: null,
        avatarUrl: null,
      }),
    ).toEqual({
      bio: null,
      location: null,
      website: null,
      github: null,
      avatarUrl: null,
    });
  });

  it('omits empty strings so they cannot clear a stored value', () => {
    expect(
      toProfileUpdates({
        bio: '',
        location: '  ',
        github: 'ada',
      }),
    ).toEqual({ github: 'ada' });
  });

  it('does not treat a missing field as a clear', () => {
    expect(toProfileUpdates({ location: 'SF' })).toEqual({ location: 'SF' });
  });
});
