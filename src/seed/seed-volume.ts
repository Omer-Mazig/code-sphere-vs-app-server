import { randomUUID } from 'crypto';
import { CURATED_TOPICS } from '../topics/topics.constants';
import { PostImageLayout } from '../posts/posts.constants';
import { TargetType } from '../interactions/entities/like.entity';

const RNG_SEED = 0xc0de5eed;
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 90;
const RECENT_DAYS = 14;

const POPULAR_USERNAMES = [
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
] as const;

const FEATURED_TOPICS: Record<string, string[]> = {
  sarah_dev: ['typescript', 'react', 'system-design', 'open-source'],
  alex_code: ['javascript', 'nodejs', 'system-design', 'rust'],
  mike_ts: ['typescript', 'react', 'css', 'web-performance'],
  lina_rust: ['rust', 'system-design', 'open-source'],
  jordan_py: ['python', 'ai-ml', 'postgres'],
  emma_go: ['go', 'kubernetes', 'devops', 'docker'],
  nina_swift: ['mobile', 'css', 'testing'],
  tom_java: ['system-design', 'postgres', 'security'],
  priya_devops: ['devops', 'kubernetes', 'docker'],
  carlos_mobile: ['mobile', 'react', 'javascript'],
  maya_design: ['css', 'web-performance', 'react'],
  david_db: ['postgres', 'system-design', 'devops'],
  olivia_sec: ['security', 'devops', 'testing'],
  ryan_startup: ['career', 'typescript', 'javascript'],
  cs_admin: ['career', 'open-source', 'typescript'],
};

const GENERATED_USER_COUNT = 185;
const LURKER_COUNT = 30;
const TARGET_POSTS = 1000;
const NAMED_EXTRA_POSTS = 168;
const REPOST_COUNT = 100;
const GENERATED_ARTICLES = 139;
const DRAFT_ARTICLES = 15;
const ARTICLE_AUTHOR_COUNT = 45;

export const SEED_PASSWORD = 'Password123!';

export type FixtureUser = {
  email: string;
  username: string;
  displayName: string;
  bio?: string;
  location?: string;
  website?: string;
  github?: string;
  avatarUrl?: string;
};

export type FixturePost = {
  authorUsername: string;
  content: string;
};

export type FixtureArticleBlock = {
  type: 'paragraph' | 'heading' | 'code';
  content: string;
};

export type FixtureArticle = {
  authorUsername: string;
  title: string;
  content: FixtureArticleBlock[];
  coverImageUrl?: string;
  isPublished: boolean;
};

export type VolumeUserRow = {
  id: string;
  email: string;
  passwordHash: string;
  username: string;
  displayName: string;
  bio: string | null;
  location: string | null;
  website: string | null;
  github: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type VolumeTopicRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  createdAt: Date;
};

export type VolumeFollowRow = {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
};

export type VolumeTopicFollowRow = {
  id: string;
  userId: string;
  topicId: string;
  createdAt: Date;
};

export type VolumePostRow = {
  id: string;
  authorId: string;
  content: string;
  sharedPostId: string | null;
  imageLayout: PostImageLayout;
  createdAt: Date;
  updatedAt: Date;
};

export type VolumeArticleRow = {
  id: string;
  authorId: string;
  title: string;
  slug: string;
  content: string;
  coverImageUrl: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type VolumePostTopicRow = {
  id: string;
  postId: string;
  topicId: string;
  createdAt: Date;
};

export type VolumeArticleTopicRow = {
  id: string;
  articleId: string;
  topicId: string;
  createdAt: Date;
};

export type VolumeLikeRow = {
  id: string;
  userId: string;
  targetId: string;
  targetType: TargetType;
  createdAt: Date;
};

export type VolumeCommentRow = {
  id: string;
  authorId: string;
  targetId: string;
  targetType: TargetType;
  content: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type VolumeShareRow = {
  id: string;
  userId: string;
  targetId: string;
  targetType: TargetType;
  createdAt: Date;
};

export type SeedVolume = {
  users: VolumeUserRow[];
  topics: VolumeTopicRow[];
  topicFollows: VolumeTopicFollowRow[];
  follows: VolumeFollowRow[];
  posts: VolumePostRow[];
  reposts: VolumePostRow[];
  articles: VolumeArticleRow[];
  postTopics: VolumePostTopicRow[];
  articleTopics: VolumeArticleTopicRow[];
  likes: VolumeLikeRow[];
  comments: VolumeCommentRow[];
  replies: VolumeCommentRow[];
  shares: VolumeShareRow[];
};

type Person = VolumeUserRow & {
  topicSlugs: string[];
  kind: 'admin' | 'popular' | 'regular' | 'lurker';
};

class Rng {
  constructor(private state: number) {}

  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const current = copy[i];
      copy[i] = copy[j];
      copy[j] = current;
    }
    return copy;
  }
}

const FIRST_NAMES = [
  'Ava', 'Noah', 'Mia', 'Liam', 'Sofia', 'Ethan', 'Amelia', 'Lucas', 'Harper',
  'Owen', 'Ella', 'Leo', 'Aria', 'Jack', 'Chloe', 'Henry', 'Grace', 'Wyatt',
  'Zoe', 'Isaac', 'Nora', 'Caleb', 'Lily', 'Nathan', 'Hannah', 'Adrian', 'Ruby',
  'Julian', 'Stella', 'Aaron', 'Violet', 'Eli', 'Claire', 'Ian', 'Paisley',
  'Adam', 'Skylar', 'Evan', 'Bella', 'Kai', 'Naomi', 'Omar', 'Leila', 'Felix',
  'Ines', 'Hugo', 'Aisha', 'Mateo', 'Yara',
];

const LAST_NAMES = [
  'Nguyen', 'Patel', 'Garcia', 'Kim', 'Brown', 'Martinez', 'Singh', 'Anderson',
  'Lopez', 'Wright', 'Hassan', 'Clark', 'Lewis', 'Walker', 'Young', 'Allen',
  'King', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Carter', 'Mitchell',
  'Perez', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans',
  'Edwards', 'Collins', 'Stewart', 'Morris', 'Reed', 'Cook', 'Morgan', 'Bell',
  'Murphy',
];

const LOCATIONS = [
  'San Francisco, CA', 'Austin, TX', 'London, UK', 'Berlin, Germany',
  'Seoul, South Korea', 'Tokyo, Japan', 'Toronto, Canada', 'Barcelona, Spain',
  'Lagos, Nigeria', 'Melbourne, Australia', 'New York, NY', 'Bangalore, India',
  'Amsterdam, Netherlands', 'Stockholm, Sweden', 'Lisbon, Portugal',
  'Dublin, Ireland', 'Chicago, IL', 'Seattle, WA', 'Singapore', 'Nairobi, Kenya',
];

const TOPIC_COPY: Record<
  string,
  { tools: string[]; things: string[]; lessons: string[]; code: string }
> = {
  typescript: {
    tools: ['tsc', 'Zod', 'ts-reset', 'TypeORM'],
    things: ['API client', 'form layer', 'query factory'],
    lessons: [
      'infer the type instead of asserting it',
      'keep the boundary schema as the source of truth',
    ],
    code: 'function readId<T extends { id: string }>(value: T): string {\n  return value.id;\n}',
  },
  javascript: {
    tools: ['Node 22', 'Vitest', 'esbuild', 'Playwright'],
    things: ['event loop bug', 'fetch wrapper', 'build script'],
    lessons: [
      'await the promise you actually care about',
      'measure before adding another abstraction',
    ],
    code: 'const load = async (id) => {\n  const res = await fetch(`/api/${id}`);\n  if (!res.ok) throw new Error(res.statusText);\n  return res.json();\n};',
  },
  react: {
    tools: ['TanStack Query', 'React 19', 'Zustand', 'Vite'],
    things: ['feed list', 'settings form', 'dialog'],
    lessons: [
      'server state does not belong in a global store',
      'keep the component dumb and the hook specific',
    ],
    code: 'const postsQuery = queryOptions({\n  queryKey: ["posts"],\n  queryFn: () => api.listPosts(),\n});',
  },
  nodejs: {
    tools: ['NestJS', 'Fastify', 'pino', 'BullMQ'],
    things: ['auth guard', 'worker', 'health check'],
    lessons: [
      'fail the request at the edge, not three services later',
      'log the request id on every line that matters',
    ],
    code: 'app.use((req, res, next) => {\n  req.id = req.headers["x-request-id"] ?? randomUUID();\n  next();\n});',
  },
  python: {
    tools: ['Polars', 'pytest', 'FastAPI', 'Ruff'],
    things: ['ETL job', 'feature pipeline', 'admin script'],
    lessons: [
      'a typed dataframe beats a dict of lists',
      'pin the environment or the bug will not reproduce',
    ],
    code: 'def active(frame):\n    return frame.filter(frame["is_active"])',
  },
  rust: {
    tools: ['cargo', 'tokio', 'serde', 'clap'],
    things: ['parser', 'worker', 'CLI'],
    lessons: [
      'the borrow checker was right again',
      'own the buffer at the boundary and borrow inside',
    ],
    code: 'fn take(name: String) -> usize {\n    name.len()\n}',
  },
  go: {
    tools: ['Go 1.23', 'sqlc', 'chi', 'errgroup'],
    things: ['HTTP handler', 'migration', 'client'],
    lessons: [
      'return the error, do not wrap it into a panic',
      'context goes first and cancellation is not optional',
    ],
    code: 'func ready(ctx context.Context, db *sql.DB) error {\n    return db.PingContext(ctx)\n}',
  },
  devops: {
    tools: ['GitHub Actions', 'Terraform', 'Argo CD', 'Grafana'],
    things: ['deploy pipeline', 'staging cluster', 'rollback'],
    lessons: [
      'a green pipeline that nobody trusts is not a pipeline',
      'roll forward with a flag, not a hotfix at midnight',
    ],
    code: 'on:\n  push:\n    branches: [main]\njobs:\n  deploy:\n    runs-on: ubuntu-latest',
  },
  postgres: {
    tools: ['EXPLAIN ANALYZE', 'pg_stat_statements', 'psql', 'Atlas'],
    things: ['feed query', 'partial index', 'migration'],
    lessons: [
      'the sequential scan was the whole incident',
      'an index that nothing reads still costs every write',
    ],
    code: 'CREATE INDEX posts_author_created\n  ON posts (author_id, created_at DESC);',
  },
  docker: {
    tools: ['BuildKit', 'compose', 'distroless', 'hadolint'],
    things: ['dev container', 'image build', 'local stack'],
    lessons: [
      'cache the dependency layer or CI will feel personal',
      'the image that runs locally should be the one you ship',
    ],
    code: 'FROM node:22-bookworm-slim\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci',
  },
  kubernetes: {
    tools: ['kubectl', 'Helm', 'HPA', 'PodDisruptionBudget'],
    things: ['api deployment', 'canary', 'node drain'],
    lessons: [
      'requests and limits are not optional',
      'if one node drain takes the site down, the budget is wrong',
    ],
    code: 'spec:\n  minAvailable: 2\n  selector:\n    matchLabels:\n      app: api',
  },
  security: {
    tools: ['argon2', 'OWASP ZAP', 'gitleaks', 'CSP'],
    things: ['login endpoint', 'token rotation', 'threat model'],
    lessons: [
      'rate limit the credential check, not just the happy path',
      'a secret in the client bundle is already leaked',
    ],
    code: "res.setHeader('Content-Security-Policy', \"default-src 'self'\");",
  },
  testing: {
    tools: ['Vitest', 'Playwright', 'supertest', 'Testcontainers'],
    things: ['regression', 'contract test', 'seeded fixture'],
    lessons: [
      'a flaky test is a bug in the test or the product',
      'assert the behavior a user would notice',
    ],
    code: 'it("rejects a short password", async () => {\n  const res = await api.register({ password: "short" });\n  expect(res.status).toBe(400);\n});',
  },
  career: {
    tools: ['a design doc', 'a pairing session', 'a retro', 'a writing habit'],
    things: ['promotion packet', 'onboarding guide', 'incident review'],
    lessons: [
      'write the decision down while the context is still fresh',
      'the work that compounds is the work other people can run',
    ],
    code: '# Decision\n\nWe will keep one feed query and paginate it.\nRevisit if p95 crosses 200ms.',
  },
  'open-source': {
    tools: ['a good issue template', 'changesets', 'a maintainer guide', 'GitHub Sponsors'],
    things: ['first PR', 'release', 'bug report'],
    lessons: [
      'a reproduction is worth more than a theory',
      'review like you want the contributor to come back',
    ],
    code: '## Steps\n1. Clone the repo\n2. Run the seed\n3. Open /posts/1',
  },
  'web-performance': {
    tools: ['Lighthouse', 'the React profiler', 'bundlewatch', 'HTTP caching'],
    things: ['route', 'font load', 'image gallery'],
    lessons: [
      'the biggest win was deleting a dependency',
      'a spinner that waits 300ms hides the real cost',
    ],
    code: 'img {\n  content-visibility: auto;\n}',
  },
  'system-design': {
    tools: ['a queue', 'an idempotency key', 'a circuit breaker', 'Postgres'],
    things: ['notification fanout', 'feed read', 'upload pipeline'],
    lessons: [
      'exactly-once is a story you tell after at-least-once works',
      'put the constraint in the database, not in a comment',
    ],
    code: 'UNIQUE (user_id, target_id, target_type)',
  },
  'ai-ml': {
    tools: ['a small eval set', 'Polars', 'an embedding index', 'a prompt fixture'],
    things: ['ranking experiment', 'summarizer', 'moderation check'],
    lessons: [
      'if you cannot score it, you cannot ship it',
      'the model is a dependency with a worse changelog',
    ],
    code: 'scores = [grade(row) for row in holdout]\nassert sum(scores) / len(scores) >= 0.8',
  },
  mobile: {
    tools: ['SwiftUI', 'Expo', 'React Native', 'a preview canvas'],
    things: ['profile screen', 'offline cache', 'push permission'],
    lessons: [
      'design the empty and error states before the happy path',
      'a native feel is mostly timing and touch targets',
    ],
    code: 'struct Profile: View {\n  var body: some View { Text(name) }\n}',
  },
  css: {
    tools: ['design tokens', 'container queries', 'Tailwind', 'a contrast checker'],
    things: ['dark theme', 'card layout', 'focus ring'],
    lessons: [
      'semantic tokens beat another raw hex',
      'if keyboard users cannot see focus, the control is unfinished',
    ],
    code: ':focus-visible {\n  outline: 2px solid var(--ring);\n  outline-offset: 2px;\n}',
  },
};

const POST_TEMPLATES: Array<
  (fill: {
    tool: string;
    thing: string;
    lesson: string;
    n: number;
    n2: number;
    topic: string;
  }) => string
> = [
  ({ tool, thing, n, lesson }) =>
    `Shipped the ${thing} with ${tool} this week. ${n} review comments, and most of them were fair.\n\n${capitalize(lesson)}.`,
  ({ tool, thing, n, n2 }) =>
    `The ${thing} used to take ${n} minutes in CI. After moving the slow part onto ${tool}, it is down to ${n2}.\n\nStill not proud of the workaround, but the team can ship again.`,
  ({ topic, lesson, n }) =>
    `Hot take after ${n} production incidents: ${topic} problems are usually product problems wearing a technical costume.\n\n${capitalize(lesson)}.`,
  ({ tool, thing, lesson }) =>
    `Pairing on the ${thing} reminded me why I like this work. Two people, one ${tool} trace, and a bug that had been "random" for a month.\n\n${capitalize(lesson)}.`,
  ({ tool, n, lesson }) =>
    `I rewrote a chunk of glue code instead of adding another flag. ${tool} made the types honest, and ${n} call sites got simpler.\n\n${capitalize(lesson)}.`,
  ({ thing, n, n2, topic }) =>
    `Notes from a ${topic} review of our ${thing}:\n\n- ${n} places duplicated the same rule\n- ${n2} of them disagreed\n- the fix was one function and a test\n\nBoring. Effective.`,
  ({ tool, thing, lesson }) =>
    `Started a migration to ${tool} for the ${thing}. Not a rewrite. One path, behind the old one, with a metric on both.\n\n${capitalize(lesson)}.`,
  ({ topic, n, lesson }) =>
    `Office hours today were all ${topic}. The question I heard ${n} times: "why is this slow?"\n\nThe useful answer was never "add a cache" first. ${capitalize(lesson)}.`,
];

const CLOSERS = [
  'Writing it down so I do not relitigate it on Monday.',
  'If you have done this the hard way, I would like to hear it.',
  'The diff is smaller than the discussion, which feels right.',
  'Shipping it is the part I trust. The naming can wait.',
];

const REPOST_NOTES = [
  'This matches what we saw last quarter.',
  'Worth reading before the next design review.',
  'Sending this to the team.',
  'The last paragraph is the whole post.',
  'We learned this the expensive way.',
  'Bookmarking this for the onboarding doc.',
];

const POST_COMMENTS = [
  'Totally agree with this.',
  'Great insight, thanks for sharing.',
  'I had the same experience last week.',
  'This is the way.',
  'Interesting, but I would want the trade-off written down.',
  'Bookmarking this for later.',
  'Clean approach. A follow-up with numbers would be great.',
  'Solid advice, especially for people new to the codebase.',
  'This changed how I think about the test suite.',
  'I have been saying this in reviews for a year.',
  'The metric you quoted is the part our dashboard is missing.',
  'We tried the opposite and spent a quarter undoing it.',
  'How did you roll this out without a flag?',
  'The code sample is the first version I would actually merge.',
  'Saving this for the next incident review.',
  'Our juniors are going to get more out of this than another style guide.',
  'I would split the second step into its own change.',
  'This is the calmest postmortem energy I have seen all month.',
  'Curious what broke the first time you tried it.',
  'The constraint belongs in the database. Yes.',
];

const ARTICLE_COMMENTS = [
  'Amazing article. Easy to follow and specific.',
  'I wish I had this when I was starting on the team.',
  'The code samples are the useful part. Thank you.',
  'Looking forward to a part two on the failure cases.',
  'One nit: the third section skips the rollback. Otherwise excellent.',
  'This is one of the better explanations I have read on it.',
  'How would this change on the current version?',
  'Saved. I will reference it on the next project.',
  'We adopted the directory layout the same week. It held up.',
  'The conclusion is the slide I needed for the review.',
];

const REPLIES = [
  'Same here.',
  'We hit that exact case in staging.',
  'Can you share the rough diff?',
  'Agreed, with one extra test around the empty state.',
  'That was the part I was unsure about. Thanks.',
  'I will try the smaller version first.',
  'Good catch. I updated the example.',
  'The follow-up is half written already.',
];

const TITLE_PATTERNS = [
  '{topic} in production: {focus}',
  'What broke when we scaled our {thing}',
  'A practical {topic} checklist for {focus}',
  'Lessons from migrating the {thing}',
  '{tool} for people who already ship {topic}',
  'The {thing} postmortem I wish I had written sooner',
  'How we cut the cost of {focus}',
  'Stop treating {topic} like a side quest',
  'A smaller design for the {thing}',
  'Field notes: {focus} with {tool}',
  'The boring {topic} setup that survived launch',
  'Reviewing a {thing} like you will be on call for it',
];

const FOCUSES = [
  'error handling',
  'local development',
  'rollbacks',
  'reviews',
  'onboarding',
  'observability',
  'schema changes',
  'empty states',
];

const COVER_IMAGES = [
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800',
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
  'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
  'https://images.unsplash.com/photo-1550439062-609e1531270e?w=800',
  'https://images.unsplash.com/photo-1527474305487-b87b222841cc?w=800',
  'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800',
  'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800',
  'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800',
  'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800',
  'https://images.unsplash.com/photo-1559028012-481c04fa7025?w=800',
];

const TOPIC_WEIGHTS: Record<string, number> = {
  typescript: 8,
  javascript: 8,
  react: 8,
  nodejs: 6,
  python: 5,
  career: 5,
  devops: 5,
  postgres: 5,
  'system-design': 5,
  testing: 4,
  css: 4,
  docker: 3,
  kubernetes: 3,
  security: 3,
  'open-source': 3,
  'web-performance': 3,
  'ai-ml': 3,
  mobile: 3,
  go: 3,
  rust: 3,
};

export function buildSeedVolume(input: {
  users: FixtureUser[];
  posts: FixturePost[];
  articles: FixtureArticle[];
  passwordHash: string;
  now?: number;
}): SeedVolume {
  const rng = new Rng(RNG_SEED);
  const now = input.now ?? Date.UTC(2026, 8, 25, 12, 0, 0);
  const windowStart = now - WINDOW_DAYS * DAY_MS;
  const recentStart = now - RECENT_DAYS * DAY_MS;

  const topics: VolumeTopicRow[] = CURATED_TOPICS.map((topic) => ({
    id: randomUUID(),
    slug: topic.slug,
    name: topic.name,
    description: topic.description,
    createdAt: new Date(windowStart),
  }));
  const topicIdBySlug = new Map(topics.map((topic) => [topic.slug, topic.id]));

  const people: Person[] = input.users.map((user) => {
    const createdAt = new Date(windowStart + rng.int(0, 10) * DAY_MS);
    return {
      ...baseUser(user, input.passwordHash, createdAt),
      topicSlugs: FEATURED_TOPICS[user.username] ?? ['career'],
      kind: user.username === 'cs_admin' ? 'admin' : 'popular',
    };
  });

  const usedUsernames = new Set(people.map((person) => person.username));
  const namePairs = FIRST_NAMES.flatMap((first) =>
    LAST_NAMES.map((last) => ({ first, last })),
  );
  const chosenNames = rng.shuffle(namePairs).slice(0, GENERATED_USER_COUNT);

  for (const { first, last } of chosenNames) {
    const username = uniqueUsername(first, last, usedUsernames);
    const topicSlugs = pickTopics(rng, rng.int(3, 5));
    const primary = topicSlugs[0];
    const createdAt = new Date(windowStart + rng.int(0, 40) * DAY_MS);
    const hasSite = rng.chance(0.4);
    people.push({
      id: randomUUID(),
      email: `${username}@example.com`,
      passwordHash: input.passwordHash,
      username,
      displayName: `${first} ${last}`,
      bio: `${roleFor(primary)} working mostly with ${label(primary)}. ${rng.pick(TOPIC_COPY[primary].lessons)}.`,
      location: rng.pick(LOCATIONS),
      website: hasSite ? `https://${username}.dev` : null,
      github: hasSite ? username : null,
      avatarUrl: `https://i.pravatar.cc/150?u=${username}`,
      isActive: true,
      emailVerified: true,
      createdAt,
      updatedAt: createdAt,
      topicSlugs,
      kind: 'regular',
    });
  }

  const generated = people.filter((person) => person.kind === 'regular');
  for (const person of rng.shuffle(generated).slice(0, LURKER_COUNT)) {
    person.kind = 'lurker';
  }

  const topicFollows = topicFollowRows(people, topicIdBySlug);
  const follows = followRows(rng, people);
  const followersByAuthor = indexFollowers(follows);

  const posts: VolumePostRow[] = [];
  for (const fixture of input.posts) {
    const author = requirePerson(people, fixture.authorUsername);
    posts.push(postRow(author, fixture.content, null, contentTime(rng, author, windowStart, recentStart, now)));
  }

  const named = people.filter((person) => person.kind === 'popular');
  const regulars = people.filter((person) => person.kind === 'regular');
  const generatedPostCount = TARGET_POSTS - REPOST_COUNT - input.posts.length;
  assignPosts(rng, posts, named, distribute(rng, NAMED_EXTRA_POSTS, named.length, 8, 16), windowStart, recentStart, now);
  assignPosts(rng, posts, regulars, distribute(rng, generatedPostCount - NAMED_EXTRA_POSTS, regulars.length, 2, 8), windowStart, recentStart, now);

  const reposts = buildReposts(rng, posts, people, followersByAuthor, now);
  const articles = buildArticles(rng, input.articles, people, windowStart, recentStart, now);

  const postTopics = tagPosts(rng, posts, reposts, people, topicIdBySlug);
  const articleTopics = tagArticles(rng, articles, people, topicIdBySlug);

  const likes = [
    ...likeTargets(rng, posts, people, followersByAuthor, TargetType.POST, postLikeCount),
    ...likeTargets(rng, articles, people, followersByAuthor, TargetType.ARTICLE, articleLikeCount),
  ];

  const comments = commentTargets(rng, posts, people, followersByAuthor, TargetType.POST, postCommentCount, POST_COMMENTS);
  const articleComments = commentTargets(rng, articles, people, followersByAuthor, TargetType.ARTICLE, articleCommentCount, ARTICLE_COMMENTS);
  const parents = [...comments, ...articleComments];
  const replies = buildReplies(rng, parents, people, now);

  const shares = [
    ...shareTargets(rng, posts, people, followersByAuthor, TargetType.POST, postShareCount),
    ...shareTargets(rng, articles, people, followersByAuthor, TargetType.ARTICLE, articleShareCount),
  ];

  return {
    users: people.map(stripPerson),
    topics,
    topicFollows,
    follows,
    posts,
    reposts,
    articles,
    postTopics,
    articleTopics,
    likes,
    comments: parents,
    replies,
    shares,
  };
}

function baseUser(user: FixtureUser, passwordHash: string, createdAt: Date): VolumeUserRow {
  return {
    id: randomUUID(),
    email: user.email,
    passwordHash,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio ?? null,
    location: user.location ?? null,
    website: user.website ?? null,
    github: user.github ?? null,
    avatarUrl: user.avatarUrl ?? null,
    isActive: true,
    emailVerified: true,
    createdAt,
    updatedAt: createdAt,
  };
}

function stripPerson(person: Person): VolumeUserRow {
  return {
    id: person.id,
    email: person.email,
    passwordHash: person.passwordHash,
    username: person.username,
    displayName: person.displayName,
    bio: person.bio,
    location: person.location,
    website: person.website,
    github: person.github,
    avatarUrl: person.avatarUrl,
    isActive: person.isActive,
    emailVerified: person.emailVerified,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  };
}

function uniqueUsername(first: string, last: string, used: Set<string>): string {
  const base = `${first}_${last}`.toLowerCase().replace(/[^a-z0-9_]/g, '');
  let username = base.slice(0, 30);
  let n = 2;
  while (used.has(username)) {
    const suffix = `_${n}`;
    username = `${base.slice(0, 30 - suffix.length)}${suffix}`;
    n++;
  }
  used.add(username);
  return username;
}

function pickTopics(rng: Rng, count: number): string[] {
  const pool = Object.entries(TOPIC_WEIGHTS).flatMap(([slug, weight]) =>
    Array.from({ length: weight }, () => slug),
  );
  const chosen: string[] = [];
  while (chosen.length < count) {
    const slug = rng.pick(pool);
    if (!chosen.includes(slug)) {
      chosen.push(slug);
    }
  }
  return chosen;
}

function roleFor(slug: string): string {
  const roles: Record<string, string> = {
    typescript: 'Frontend engineer',
    javascript: 'Full-stack engineer',
    react: 'UI engineer',
    nodejs: 'Backend engineer',
    python: 'Data engineer',
    rust: 'Systems engineer',
    go: 'Platform engineer',
    devops: 'DevOps engineer',
    postgres: 'Database engineer',
    docker: 'Platform engineer',
    kubernetes: 'Infrastructure engineer',
    security: 'Application security engineer',
    testing: 'Quality engineer',
    career: 'Engineering lead',
    'open-source': 'Open-source maintainer',
    'web-performance': 'Web performance engineer',
    'system-design': 'Backend engineer',
    'ai-ml': 'Machine learning engineer',
    mobile: 'Mobile engineer',
    css: 'Design systems engineer',
  };
  return roles[slug] ?? 'Software engineer';
}

function label(slug: string): string {
  return CURATED_TOPICS.find((topic) => topic.slug === slug)?.name ?? slug;
}

function topicFollowRows(people: Person[], topicIdBySlug: Map<string, string>): VolumeTopicFollowRow[] {
  return people.flatMap((person) =>
    person.topicSlugs.map((slug) => ({
      id: randomUUID(),
      userId: person.id,
      topicId: topicIdBySlug.get(slug)!,
      createdAt: new Date(person.createdAt.getTime() + DAY_MS),
    })),
  );
}

function followRows(rng: Rng, people: Person[]): VolumeFollowRow[] {
  const edges = new Set<string>();
  const rows: VolumeFollowRow[] = [];
  const popular = people.filter((person) => person.kind === 'popular');
  const byId = new Map(people.map((person) => [person.id, person]));

  const add = (follower: Person, following: Person) => {
    if (follower.id === following.id) {
      return;
    }
    const key = `${follower.id}:${following.id}`;
    if (edges.has(key)) {
      return;
    }
    edges.add(key);
    const earliest = Math.max(follower.createdAt.getTime(), following.createdAt.getTime());
    rows.push({
      id: randomUUID(),
      followerId: follower.id,
      followingId: following.id,
      createdAt: new Date(earliest + rng.int(1, 20) * DAY_MS),
    });
  };

  for (const person of people) {
    if (person.kind === 'admin') {
      for (const target of rng.shuffle(popular).slice(0, 4)) {
        add(person, target);
      }
      continue;
    }

    for (const target of rng.shuffle(popular).slice(0, rng.int(2, 4))) {
      add(person, target);
      if (rng.chance(0.3)) {
        add(target, person);
      }
    }

    const topical = people.filter(
      (other) =>
        other.id !== person.id &&
        other.kind !== 'admin' &&
        other.topicSlugs.some((slug) => person.topicSlugs.includes(slug)),
    );
    const pool = topical.length >= 8 ? topical : people.filter((other) => other.kind !== 'admin' && other.id !== person.id);
    for (const target of rng.shuffle(pool).slice(0, rng.int(8, 16))) {
      add(person, target);
      if (rng.chance(0.3)) {
        add(target, person);
      }
    }
  }

  for (const row of rows) {
    const follower = byId.get(row.followerId)!;
    const following = byId.get(row.followingId)!;
    const earliest = Math.max(follower.createdAt.getTime(), following.createdAt.getTime());
    if (row.createdAt.getTime() < earliest) {
      row.createdAt = new Date(earliest + DAY_MS);
    }
  }

  return rows;
}

function indexFollowers(follows: VolumeFollowRow[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const follow of follows) {
    const current = map.get(follow.followingId) ?? [];
    current.push(follow.followerId);
    map.set(follow.followingId, current);
  }
  return map;
}

function requirePerson(people: Person[], username: string): Person {
  const person = people.find((candidate) => candidate.username === username);
  if (!person) {
    throw new Error(`Seed author "${username}" is missing`);
  }
  return person;
}

function postRow(author: Person, content: string, sharedPostId: string | null, createdAt: Date): VolumePostRow {
  return {
    id: randomUUID(),
    authorId: author.id,
    content,
    sharedPostId,
    imageLayout: PostImageLayout.GALLERY,
    createdAt,
    updatedAt: createdAt,
  };
}

function contentTime(rng: Rng, author: Person, windowStart: number, recentStart: number, now: number): Date {
  const earliest = Math.max(author.createdAt.getTime() + DAY_MS, windowStart);
  if (rng.chance(0.4)) {
    const from = Math.max(earliest, recentStart);
    return new Date(from + rng.next() * Math.max(now - 60_000 - from, 1));
  }
  const end = Math.max(recentStart, earliest + 1);
  return new Date(earliest + rng.next() * (end - earliest));
}

function distribute(rng: Rng, total: number, count: number, min: number, max: number): number[] {
  const counts = Array.from({ length: count }, () => min);
  let remaining = total - count * min;
  let guard = 0;
  while (remaining > 0) {
    const index = rng.int(0, count - 1);
    if (counts[index] < max) {
      counts[index]++;
      remaining--;
    }
    guard++;
    if (guard > 100_000) {
      throw new Error('Could not distribute seed counts');
    }
  }
  return counts;
}

function assignPosts(
  rng: Rng,
  posts: VolumePostRow[],
  authors: Person[],
  counts: number[],
  windowStart: number,
  recentStart: number,
  now: number,
) {
  authors.forEach((author, index) => {
    for (let n = 0; n < counts[index]; n++) {
      posts.push(postRow(author, generatedPost(rng, author), null, contentTime(rng, author, windowStart, recentStart, now)));
    }
  });
}

function generatedPost(rng: Rng, author: Person): string {
  const slug = rng.pick(author.topicSlugs);
  const copy = TOPIC_COPY[slug];
  const body = rng.pick(POST_TEMPLATES)({
    tool: rng.pick(copy.tools),
    thing: rng.pick(copy.things),
    lesson: rng.pick(copy.lessons),
    n: rng.int(2, 40),
    n2: rng.int(1, 12),
    topic: label(slug),
  });
  return rng.chance(0.5) ? `${body}\n\n${rng.pick(CLOSERS)}` : body;
}

function buildReposts(
  rng: Rng,
  posts: VolumePostRow[],
  people: Person[],
  followersByAuthor: Map<string, string[]>,
  now: number,
): VolumePostRow[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const originals = rng.shuffle(posts.filter((post) => followersByAuthor.has(post.authorId)));
  const rows: VolumePostRow[] = [];
  const used = new Set<string>();

  for (const original of originals) {
    if (rows.length >= REPOST_COUNT) {
      break;
    }
    const followerIds = followersByAuthor.get(original.authorId) ?? [];
    const author = rng.shuffle(followerIds.map((id) => byId.get(id)!).filter(Boolean)).find((person) => {
      return !used.has(`${person.id}:${original.id}`);
    });
    if (!author) {
      continue;
    }
    used.add(`${author.id}:${original.id}`);
    const createdAt = new Date(
      Math.min(now - 60_000, original.createdAt.getTime() + rng.int(1, 10) * DAY_MS),
    );
    rows.push(
      postRow(
        author,
        rng.chance(0.7) ? rng.pick(REPOST_NOTES) : '',
        original.id,
        createdAt.getTime() > original.createdAt.getTime() ? createdAt : new Date(original.createdAt.getTime() + 60_000),
      ),
    );
  }

  if (rows.length !== REPOST_COUNT) {
    throw new Error(`Expected ${REPOST_COUNT} reposts, built ${rows.length}`);
  }
  return rows;
}

function buildArticles(
  rng: Rng,
  fixtures: FixtureArticle[],
  people: Person[],
  windowStart: number,
  recentStart: number,
  now: number,
): VolumeArticleRow[] {
  const rows: VolumeArticleRow[] = fixtures.map((article) => {
    const author = requirePerson(people, article.authorUsername);
    const createdAt = contentTime(rng, author, windowStart, recentStart, now);
    return {
      id: randomUUID(),
      authorId: author.id,
      title: article.title,
      slug: slugify(`${article.title}-${rowsLengthSafe(article.title)}`),
      content: blocksToMarkdown(article.content),
      coverImageUrl: article.coverImageUrl ?? null,
      isPublished: article.isPublished,
      createdAt,
      updatedAt: createdAt,
    };
  });

  const authors = rng
    .shuffle(people.filter((person) => person.kind === 'popular' || person.kind === 'regular'))
    .slice(0, ARTICLE_AUTHOR_COUNT);
  const counts = distribute(rng, GENERATED_ARTICLES, authors.length, 1, 6);
  const draftSlots = new Set(rng.shuffle(Array.from({ length: GENERATED_ARTICLES }, (_, index) => index)).slice(0, DRAFT_ARTICLES));
  let generatedIndex = 0;

  authors.forEach((author, authorIndex) => {
    for (let n = 0; n < counts[authorIndex]; n++) {
      const slug = rng.pick(author.topicSlugs);
      const createdAt = contentTime(rng, author, windowStart, recentStart, now);
      const title = articleTitle(rng, slug);
      rows.push({
        id: randomUUID(),
        authorId: author.id,
        title,
        slug: slugify(`${title}-${generatedIndex}`),
        content: articleBody(rng, slug),
        coverImageUrl: rng.pick(COVER_IMAGES),
        isPublished: !draftSlots.has(generatedIndex),
        createdAt,
        updatedAt: createdAt,
      });
      generatedIndex++;
    }
  });

  return rows;
}

function rowsLengthSafe(title: string): string {
  return slugify(title).slice(0, 12);
}

function articleTitle(rng: Rng, slug: string): string {
  const copy = TOPIC_COPY[slug];
  return rng
    .pick(TITLE_PATTERNS)
    .replaceAll('{topic}', label(slug))
    .replaceAll('{tool}', rng.pick(copy.tools))
    .replaceAll('{thing}', rng.pick(copy.things))
    .replaceAll('{focus}', rng.pick(FOCUSES));
}

function articleBody(rng: Rng, slug: string): string {
  const copy = TOPIC_COPY[slug];
  const name = label(slug);
  const tool = rng.pick(copy.tools);
  const thing = rng.pick(copy.things);
  const lesson = rng.pick(copy.lessons);
  return [
    `This is the version of a ${name} change I would hand to a teammate who has to maintain the ${thing} after I switch teams. The short version: ${lesson}.`,
    `## What we were actually fixing`,
    `The ${thing} looked fine in a demo and fell over the first week real people used it. We had ${tool} in the stack already. We were not using it at the boundary, which is the only place it pays for itself.`,
    `## The change`,
    '```',
    copy.code,
    '```',
    `## What I would repeat`,
    `${capitalize(lesson)}. Ship one path, keep the old one until the numbers move, and write down the rollback before you need it.`,
  ].join('\n\n');
}

function blocksToMarkdown(blocks: FixtureArticleBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === 'heading') {
        return `## ${block.content}`;
      }
      if (block.type === 'code') {
        return `\`\`\`ts\n${block.content}\n\`\`\``;
      }
      return block.content;
    })
    .join('\n\n');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

function tagPosts(
  rng: Rng,
  posts: VolumePostRow[],
  reposts: VolumePostRow[],
  people: Person[],
  topicIdBySlug: Map<string, string>,
): VolumePostTopicRow[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const rows: VolumePostTopicRow[] = [];
  const add = (post: VolumePostRow, count: number) => {
    const author = byId.get(post.authorId)!;
    for (const slug of rng.shuffle(author.topicSlugs).slice(0, Math.min(count, author.topicSlugs.length))) {
      rows.push({
        id: randomUUID(),
        postId: post.id,
        topicId: topicIdBySlug.get(slug)!,
        createdAt: post.createdAt,
      });
    }
  };
  for (const post of posts) {
    add(post, rng.chance(0.45) ? 2 : 1);
  }
  for (const post of reposts) {
    if (post.content) {
      add(post, 1);
    }
  }
  return rows;
}

function tagArticles(
  rng: Rng,
  articles: VolumeArticleRow[],
  people: Person[],
  topicIdBySlug: Map<string, string>,
): VolumeArticleTopicRow[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const rows: VolumeArticleTopicRow[] = [];
  for (const article of articles) {
    const author = byId.get(article.authorId)!;
    const count = Math.min(author.topicSlugs.length, rng.chance(0.5) ? 3 : 2);
    for (const slug of rng.shuffle(author.topicSlugs).slice(0, count)) {
      rows.push({
        id: randomUUID(),
        articleId: article.id,
        topicId: topicIdBySlug.get(slug)!,
        createdAt: article.createdAt,
      });
    }
  }
  return rows;
}

function postLikeCount(rng: Rng): number {
  const roll = rng.next();
  if (roll < 0.5) return rng.int(1, 6);
  if (roll < 0.8) return rng.int(7, 20);
  if (roll < 0.95) return rng.int(21, 50);
  return rng.int(51, 120);
}

function articleLikeCount(rng: Rng): number {
  const roll = rng.next();
  if (roll < 0.2) return rng.int(2, 8);
  if (roll < 0.7) return rng.int(9, 25);
  return rng.int(26, 60);
}

function postCommentCount(rng: Rng): number {
  const roll = rng.next();
  if (roll < 0.55) return 0;
  if (roll < 0.85) return rng.int(1, 3);
  if (roll < 0.97) return rng.int(4, 8);
  return rng.int(9, 18);
}

function articleCommentCount(rng: Rng): number {
  const roll = rng.next();
  if (roll < 0.2) return 0;
  if (roll < 0.7) return rng.int(2, 6);
  return rng.int(7, 15);
}

function postShareCount(rng: Rng): number {
  const roll = rng.next();
  if (roll < 0.7) return 0;
  if (roll < 0.9) return rng.int(1, 3);
  if (roll < 0.98) return rng.int(4, 10);
  return rng.int(11, 25);
}

function articleShareCount(rng: Rng): number {
  const roll = rng.next();
  if (roll < 0.4) return 0;
  if (roll < 0.8) return rng.int(1, 4);
  return rng.int(5, 12);
}

function likeTargets(
  rng: Rng,
  targets: Array<{ id: string; authorId: string; createdAt: Date }>,
  people: Person[],
  followersByAuthor: Map<string, string[]>,
  targetType: TargetType,
  countFor: (rng: Rng) => number,
): VolumeLikeRow[] {
  return interact(
    rng,
    targets,
    people,
    followersByAuthor,
    countFor,
    (userId, target, createdAt) => ({
      id: randomUUID(),
      userId,
      targetId: target.id,
      targetType,
      createdAt,
    }),
  );
}

function shareTargets(
  rng: Rng,
  targets: Array<{ id: string; authorId: string; createdAt: Date }>,
  people: Person[],
  followersByAuthor: Map<string, string[]>,
  targetType: TargetType,
  countFor: (rng: Rng) => number,
): VolumeShareRow[] {
  return interact(
    rng,
    targets,
    people,
    followersByAuthor,
    countFor,
    (userId, target, createdAt) => ({
      id: randomUUID(),
      userId,
      targetId: target.id,
      targetType,
      createdAt,
    }),
  );
}

function interact<T>(
  rng: Rng,
  targets: Array<{ id: string; authorId: string; createdAt: Date }>,
  people: Person[],
  followersByAuthor: Map<string, string[]>,
  countFor: (rng: Rng) => number,
  make: (userId: string, target: { id: string; createdAt: Date }, createdAt: Date) => T,
): T[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const rows: T[] = [];
  for (const target of targets) {
    const wanted = countFor(rng);
    const followerIds = followersByAuthor.get(target.authorId) ?? [];
    const preferred = rng.shuffle(followerIds).slice(0, Math.min(followerIds.length, Math.round(wanted * 0.7)));
    const exclude = new Set([target.authorId, ...preferred]);
    const restPool = people.filter((person) => !exclude.has(person.id)).map((person) => person.id);
    const chosen = [...preferred, ...rng.shuffle(restPool).slice(0, Math.max(wanted - preferred.length, 0))];
    for (const userId of chosen.slice(0, wanted)) {
      const actor = byId.get(userId)!;
      const from = Math.max(target.createdAt.getTime(), actor.createdAt.getTime()) + 60_000;
      rows.push(make(userId, target, new Date(from + rng.next() * DAY_MS)));
    }
  }
  return rows;
}

function commentTargets(
  rng: Rng,
  targets: Array<{ id: string; authorId: string; createdAt: Date }>,
  people: Person[],
  followersByAuthor: Map<string, string[]>,
  targetType: TargetType,
  countFor: (rng: Rng) => number,
  texts: string[],
): VolumeCommentRow[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const rows: VolumeCommentRow[] = [];
  for (const target of targets) {
    const wanted = countFor(rng);
    const followerIds = followersByAuthor.get(target.authorId) ?? [];
    const pool = rng.shuffle(
      people.filter((person) => person.id !== target.authorId).map((person) => person.id),
    );
    const preferred = followerIds.filter((id) => id !== target.authorId);
    const chosen = [...rng.shuffle(preferred), ...pool.filter((id) => !preferred.includes(id))].slice(0, wanted);
    for (const authorId of chosen) {
      const actor = byId.get(authorId)!;
      const from = Math.max(target.createdAt.getTime(), actor.createdAt.getTime()) + 60_000;
      const createdAt = new Date(from + rng.next() * 2 * DAY_MS);
      rows.push({
        id: randomUUID(),
        authorId,
        targetId: target.id,
        targetType,
        content: rng.pick(texts),
        parentId: null,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }
  return rows;
}

function buildReplies(rng: Rng, parents: VolumeCommentRow[], people: Person[], now: number): VolumeCommentRow[] {
  const rows: VolumeCommentRow[] = [];
  for (const parent of parents) {
    const replyCount = rng.chance(0.15) ? 1 : rng.chance(0.05) ? 2 : 0;
    if (replyCount === 0) {
      continue;
    }
    const candidates = rng.shuffle(people.filter((person) => person.id !== parent.authorId));
    for (let n = 0; n < replyCount && n < candidates.length; n++) {
      const actor = candidates[n];
      const from = Math.max(parent.createdAt.getTime(), actor.createdAt.getTime()) + 60_000;
      const createdAt = new Date(Math.min(now - 1000, from + rng.next() * DAY_MS));
      rows.push({
        id: randomUUID(),
        authorId: actor.id,
        targetId: parent.targetId,
        targetType: parent.targetType,
        content: rng.pick(REPLIES),
        parentId: parent.id,
        createdAt: createdAt.getTime() > parent.createdAt.getTime() ? createdAt : new Date(parent.createdAt.getTime() + 60_000),
        updatedAt: createdAt,
      });
    }
  }
  return rows;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
