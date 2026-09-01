import {
  extractMentionedUsernames,
  flattenRichText,
  newlyMentionedUsernames,
} from './mentions';

describe('extractMentionedUsernames', () => {
  it('returns distinct usernames, keeping the first casing', () => {
    expect(
      extractMentionedUsernames('hey @Ada and @ada and @grace_1'),
    ).toEqual(['Ada', 'grace_1']);
  });

  it('ignores short tokens and plain text', () => {
    expect(extractMentionedUsernames('email a@b and @xy')).toEqual([]);
  });
});

describe('flattenRichText', () => {
  it('passes markdown strings through unchanged', () => {
    expect(flattenRichText('## Hello @ada\n\n- item')).toBe(
      '## Hello @ada\n\n- item',
    );
  });

  it('joins string content from nested objects', () => {
    expect(
      flattenRichText([
        { type: 'paragraph', content: 'hello @ada' },
        { type: 'heading', content: 'more' },
      ]),
    ).toBe('hello @ada\nmore');
  });
});

describe('newlyMentionedUsernames', () => {
  it('returns only usernames added since the previous body', () => {
    expect(
      newlyMentionedUsernames('hi @ada @grace', 'hi @ada'),
    ).toEqual(['grace']);
  });
});
