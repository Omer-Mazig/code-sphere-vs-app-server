import { TargetType } from '../interactions/entities/like.entity';
import {
  SEED_PASSWORD,
  buildSeedVolume,
  type FixtureArticle,
  type FixturePost,
  type FixtureUser,
} from './seed-volume';

const POPULAR = [
  'sarah_dev',
  'alex_code',
  'mike_ts',
  'lina_rust',
  'jordan_py',
  'emma_go',
  'nina_swift',
  'tom_java',
  'priya_devops',
  'carlos_mobile',
  'maya_design',
  'david_db',
  'olivia_sec',
  'ryan_startup',
];

const users: FixtureUser[] = [
  {
    email: 'admin@codesphere.dev',
    username: 'cs_admin',
    displayName: 'CodeSphere Admin',
  },
  ...POPULAR.map((username) => ({
    email: username === 'sarah_dev' ? 'sarah@example.com' : `${username}@example.com`,
    username,
    displayName: username,
  })),
];

const posts: FixturePost[] = Array.from({ length: 30 }, (_, index) => {
  const username = POPULAR[index % POPULAR.length];
  return {
    authorUsername: username,
    content: index === 0 ? 'sarah_dev handwritten post 1' : `${username} handwritten post ${index}`,
  };
});

const articles: FixtureArticle[] = POPULAR.slice(0, 11).map((username, index) => ({
  authorUsername: username,
  title: `Handwritten article ${index}`,
  content: [{ type: 'paragraph' as const, content: 'Kept from the original seed.' }],
  isPublished: true,
}));

describe('buildSeedVolume', () => {
  const volume = buildSeedVolume({
    users,
    posts,
    articles,
    passwordHash: 'hashed-password',
    now: Date.UTC(2026, 8, 25, 12, 0, 0),
  });

  it('builds the agreed totals and keeps every password hash the same', () => {
    expect(SEED_PASSWORD).toBe('Password123!');
    expect(volume.users).toHaveLength(200);
    expect(new Set(volume.users.map((user) => user.passwordHash))).toEqual(
      new Set(['hashed-password']),
    );
    expect(volume.topics).toHaveLength(20);
    expect(volume.posts).toHaveLength(900);
    expect(volume.reposts).toHaveLength(100);
    expect(volume.articles).toHaveLength(150);
    expect(volume.articles.filter((article) => !article.isPublished)).toHaveLength(15);
    expect(volume.topicFollows.length).toBeGreaterThan(600);
    expect(volume.follows.length).toBeGreaterThan(2500);
    expect(volume.likes.length).toBeGreaterThan(8000);
    expect(volume.comments.length + volume.replies.length).toBeGreaterThan(1500);
    expect(volume.shares.length).toBeGreaterThan(800);
  });

  it('keeps featured accounts and does not let anyone follow themselves', () => {
    const sarah = volume.users.find((user) => user.username === 'sarah_dev');
    expect(sarah?.email).toBe('sarah@example.com');
    expect(volume.posts.some((post) => post.content === 'sarah_dev handwritten post 1')).toBe(true);
    expect(volume.articles.some((article) => article.title === 'Handwritten article 0')).toBe(true);

    const ids = new Set(volume.users.map((user) => user.id));
    for (const follow of volume.follows) {
      expect(follow.followerId).not.toBe(follow.followingId);
      expect(ids.has(follow.followerId)).toBe(true);
      expect(ids.has(follow.followingId)).toBe(true);
    }
  });

  it('points reposts, replies, likes, and shares at real rows without duplicates', () => {
    const postIds = new Set(volume.posts.map((post) => post.id));
    for (const repost of volume.reposts) {
      expect(postIds.has(repost.sharedPostId!)).toBe(true);
      const original = volume.posts.find((post) => post.id === repost.sharedPostId);
      expect(repost.createdAt.getTime()).toBeGreaterThan(original!.createdAt.getTime());
    }

    const parentIds = new Set(volume.comments.map((comment) => comment.id));
    for (const reply of volume.replies) {
      expect(reply.parentId).not.toBeNull();
      expect(parentIds.has(reply.parentId!)).toBe(true);
    }

    const likeKeys = volume.likes.map((like) => `${like.userId}:${like.targetId}:${like.targetType}`);
    expect(new Set(likeKeys).size).toBe(likeKeys.length);
    expect(volume.likes.some((like) => like.targetType === TargetType.POST)).toBe(true);
    expect(volume.likes.some((like) => like.targetType === TargetType.ARTICLE)).toBe(true);

    const shareKeys = volume.shares.map((share) => `${share.userId}:${share.targetId}:${share.targetType}`);
    expect(new Set(shareKeys).size).toBe(shareKeys.length);

    const slugs = volume.articles.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
