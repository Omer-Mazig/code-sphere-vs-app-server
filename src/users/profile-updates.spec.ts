import { toProfileUpdates } from './profile-updates';

describe('toProfileUpdates', () => {
  it('trims non-empty displayName values', () => {
    expect(toProfileUpdates({ displayName: '  Ada  ' })).toEqual({
      displayName: 'Ada',
    });
  });

  it('writes null for blank or null displayName', () => {
    expect(toProfileUpdates({ displayName: '   ' })).toEqual({
      displayName: null,
    });
    expect(toProfileUpdates({ displayName: null })).toEqual({
      displayName: null,
    });
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
        coverImageUrl: null,
      }),
    ).toEqual({
      bio: null,
      location: null,
      website: null,
      github: null,
      avatarUrl: null,
      coverImageUrl: null,
    });
  });

  it('treats empty strings as a clear', () => {
    expect(
      toProfileUpdates({
        bio: '',
        location: '  ',
        github: 'ada',
      }),
    ).toEqual({ bio: null, location: null, github: 'ada' });
  });

  it('does not treat a missing field as a clear', () => {
    expect(toProfileUpdates({ location: 'SF' })).toEqual({ location: 'SF' });
  });
});
