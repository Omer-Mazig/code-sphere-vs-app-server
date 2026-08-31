import { parseMediaObjectIdFromUrl } from './media-object-url';

describe('parseMediaObjectIdFromUrl', () => {
  it('extracts the id from a local media path', () => {
    expect(
      parseMediaObjectIdFromUrl(
        '/api/media/550e8400-e29b-41d4-a716-446655440000',
      ),
    ).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('returns null for external URLs and empty values', () => {
    expect(parseMediaObjectIdFromUrl('https://example.com/ada.png')).toBeNull();
    expect(parseMediaObjectIdFromUrl(null)).toBeNull();
    expect(parseMediaObjectIdFromUrl('')).toBeNull();
  });
});
