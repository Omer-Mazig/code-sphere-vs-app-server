import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { Post } from '../posts/entities/post.entity';
import { Article } from '../articles/entities/article.entity';
import { Follow } from '../users/entities/follow.entity';
import { Like, TargetType } from '../interactions/entities/like.entity';
import { Comment } from '../interactions/entities/comment.entity';
import { Share } from '../interactions/entities/share.entity';
// ----- Seed types -----

type SeedUser = {
  email: string;
  password: string;
  username: string;
  displayName: string;
  bio?: string;
  location?: string;
  website?: string;
  github?: string;
};

type SeedPost = {
  authorUsername: string;
  content: string;
};

type SeedArticle = {
  authorUsername: string;
  title: string;
  content: Record<string, unknown>[];
  coverImageUrl?: string;
  isPublished: boolean;
};

// ----- Service -----

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(Like)
    private readonly likeRepository: Repository<Like>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Share)
    private readonly shareRepository: Repository<Share>,
  ) {}

  /**
   * Wipe everything (leaf tables first to respect FK constraints).
   */
  async clearAllData() {
    await this.shareRepository
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
    await this.likeRepository
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
    await this.commentRepository
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
    await this.followRepository
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
    await this.articleRepository
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
    await this.postRepository
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
    await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
    await this.userRepository
      .createQueryBuilder()
      .delete()
      .where('1=1')
      .execute();
    return { cleared: true };
  }

  /**
   * Full seed orchestration — order matters because later steps reference earlier IDs.
   */
  async run() {
    // 1. Users
    const userMap = await this.seedUsers(this.users);
    const userIds = Object.values(userMap);

    // 2. Follows (build a realistic social graph)
    const followsCreated = await this.seedFollows(userMap);

    // 3. Posts
    const postEntities = await this.seedPosts(this.posts, userMap);

    // 4. Articles
    const articleEntities = await this.seedArticles(this.articles, userMap);

    // 5. Likes on posts & articles
    const likesCreated = await this.seedLikes(
      userIds,
      postEntities,
      articleEntities,
    );

    // 6. Comments on posts & articles
    const commentsCreated = await this.seedComments(
      userIds,
      postEntities,
      articleEntities,
    );

    // 7. Shares
    const sharesCreated = await this.seedShares(
      userIds,
      postEntities,
      articleEntities,
    );

    return {
      users: Object.keys(userMap).length,
      follows: followsCreated,
      posts: postEntities.length,
      articles: articleEntities.length,
      likes: likesCreated,
      comments: commentsCreated,
      shares: sharesCreated,
    };
  }

  // =================== Users ===================

  async seedUsers(users: SeedUser[]) {
    const map: Record<string, string> = {}; // username → id

    for (const u of users) {
      let existing = await this.userRepository.findOne({
        where: { email: u.email },
      });

      if (!existing) {
        existing = await this.userRepository.save(
          this.userRepository.create({
            email: u.email,
            passwordHash: await bcrypt.hash(u.password, 10),
            username: u.username,
            displayName: u.displayName,
            bio: u.bio,
            location: u.location,
            website: u.website,
            github: u.github,
            isActive: true,
            emailVerified: true,
          }),
        );
      }

      map[u.username] = existing.id;
    }

    return map;
  }

  // =================== Follows ===================

  private async seedFollows(userMap: Record<string, string>) {
    // Define a realistic follow graph — not everyone follows everyone
    const followPairs: [string, string][] = [
      // sarah_dev is popular — most people follow her
      ['alex_code', 'sarah_dev'],
      ['mike_ts', 'sarah_dev'],
      ['lina_rust', 'sarah_dev'],
      ['jordan_py', 'sarah_dev'],
      ['emma_go', 'sarah_dev'],

      // alex_code is active, gets followers
      ['sarah_dev', 'alex_code'],
      ['mike_ts', 'alex_code'],
      ['jordan_py', 'alex_code'],

      // mike_ts ↔ lina_rust (mutual)
      ['mike_ts', 'lina_rust'],
      ['lina_rust', 'mike_ts'],

      // jordan_py follows a few
      ['jordan_py', 'emma_go'],
      ['jordan_py', 'lina_rust'],

      // emma_go follows a few
      ['emma_go', 'alex_code'],
      ['emma_go', 'jordan_py'],

      // admin follows key people
      ['cs_admin', 'sarah_dev'],
      ['cs_admin', 'alex_code'],
    ];

    let created = 0;
    for (const [followerUsername, followingUsername] of followPairs) {
      const followerId = userMap[followerUsername];
      const followingId = userMap[followingUsername];
      if (!followerId || !followingId) continue;

      const exists = await this.followRepository.findOne({
        where: { followerId, followingId },
      });
      if (exists) continue;

      await this.followRepository.save(
        this.followRepository.create({ followerId, followingId }),
      );
      created++;
    }

    return created;
  }

  // =================== Posts ===================

  private async seedPosts(posts: SeedPost[], userMap: Record<string, string>) {
    const saved: Post[] = [];

    for (const p of posts) {
      const authorId = userMap[p.authorUsername];
      if (!authorId) continue;

      const entity = await this.postRepository.save(
        this.postRepository.create({ authorId, content: p.content }),
      );
      saved.push(entity);
    }

    return saved;
  }

  // =================== Articles ===================

  private async seedArticles(
    articles: SeedArticle[],
    userMap: Record<string, string>,
  ) {
    const saved: Article[] = [];

    for (const a of articles) {
      const authorId = userMap[a.authorUsername];
      if (!authorId) continue;

      const slug =
        this.slugify(a.title) +
        '-' +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 5);

      const entity = await this.articleRepository.save(
        this.articleRepository.create({
          authorId,
          title: a.title,
          slug,
          content: a.content,
          coverImageUrl: a.coverImageUrl,
          isPublished: a.isPublished,
        }),
      );
      saved.push(entity);
    }

    return saved;
  }

  // =================== Likes ===================

  private async seedLikes(
    userIds: string[],
    posts: Post[],
    articles: Article[],
  ) {
    let created = 0;

    // Each user likes ~60% of posts (randomly)
    for (const userId of userIds) {
      for (const post of posts) {
        if (Math.random() < 0.6) {
          const exists = await this.likeRepository.findOne({
            where: { userId, targetId: post.id, targetType: TargetType.POST },
          });
          if (!exists) {
            await this.likeRepository.save(
              this.likeRepository.create({
                userId,
                targetId: post.id,
                targetType: TargetType.POST,
              }),
            );
            created++;
          }
        }
      }

      // Each user likes ~40% of articles
      for (const article of articles) {
        if (Math.random() < 0.4) {
          const exists = await this.likeRepository.findOne({
            where: {
              userId,
              targetId: article.id,
              targetType: TargetType.ARTICLE,
            },
          });
          if (!exists) {
            await this.likeRepository.save(
              this.likeRepository.create({
                userId,
                targetId: article.id,
                targetType: TargetType.ARTICLE,
              }),
            );
            created++;
          }
        }
      }
    }

    return created;
  }

  // =================== Comments ===================

  private async seedComments(
    userIds: string[],
    posts: Post[],
    articles: Article[],
  ) {
    let created = 0;

    // Predefined realistic comment texts — pool to pick from
    const postComments = [
      'Totally agree with this!',
      'Great insight, thanks for sharing.',
      'I had the exact same experience last week.',
      'This is the way. 🔥',
      'Interesting perspective, but have you considered the trade-offs?',
      'Bookmarking this for later.',
      "Clean approach — I'd love to see a follow-up.",
      'Solid advice, especially for juniors.',
      'This changed how I think about testing.',
      "I've been saying this for years. +1",
    ];

    const articleComments = [
      'Amazing article! Well-written and easy to follow.',
      'I wish I had this resource when I was starting out.',
      'The code examples are really helpful, thank you.',
      'Great deep dive. Looking forward to part 2!',
      'Minor nit: the third code block has a typo, but otherwise excellent.',
      'This is one of the best explanations I have read on this topic.',
      'How would this change with the latest version?',
      'Saved this. Will definitely reference it in my next project.',
    ];

    // Seed comments on posts — ~2-4 per post
    for (const post of posts) {
      const commentCount = 2 + Math.floor(Math.random() * 3);
      const shuffledUsers = [...userIds].sort(() => Math.random() - 0.5);

      for (let i = 0; i < commentCount && i < shuffledUsers.length; i++) {
        const text =
          postComments[Math.floor(Math.random() * postComments.length)];
        await this.commentRepository.save(
          this.commentRepository.create({
            authorId: shuffledUsers[i],
            targetId: post.id,
            targetType: TargetType.POST,
            content: text,
          }),
        );
        created++;
      }
    }

    // Seed comments on articles — ~2-5 per article
    for (const article of articles) {
      const commentCount = 2 + Math.floor(Math.random() * 4);
      const shuffledUsers = [...userIds].sort(() => Math.random() - 0.5);

      for (let i = 0; i < commentCount && i < shuffledUsers.length; i++) {
        const text =
          articleComments[Math.floor(Math.random() * articleComments.length)];
        await this.commentRepository.save(
          this.commentRepository.create({
            authorId: shuffledUsers[i],
            targetId: article.id,
            targetType: TargetType.ARTICLE,
            content: text,
          }),
        );
        created++;
      }
    }

    return created;
  }

  // =================== Shares ===================

  private async seedShares(
    userIds: string[],
    posts: Post[],
    articles: Article[],
  ) {
    let created = 0;

    // ~25% of users share each post
    for (const post of posts) {
      for (const userId of userIds) {
        if (Math.random() < 0.25) {
          const exists = await this.shareRepository.findOne({
            where: { userId, targetId: post.id, targetType: TargetType.POST },
          });
          if (!exists) {
            await this.shareRepository.save(
              this.shareRepository.create({
                userId,
                targetId: post.id,
                targetType: TargetType.POST,
              }),
            );
            created++;
          }
        }
      }
    }

    // ~20% of users share each article
    for (const article of articles) {
      for (const userId of userIds) {
        if (Math.random() < 0.2) {
          const exists = await this.shareRepository.findOne({
            where: {
              userId,
              targetId: article.id,
              targetType: TargetType.ARTICLE,
            },
          });
          if (!exists) {
            await this.shareRepository.save(
              this.shareRepository.create({
                userId,
                targetId: article.id,
                targetType: TargetType.ARTICLE,
              }),
            );
            created++;
          }
        }
      }
    }

    return created;
  }

  // =================== Helpers ===================

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  // =================== Seed data ===================

  private readonly users: SeedUser[] = [
    {
      email: 'admin@codesphere.dev',
      password: 'Admin1234!',
      username: 'cs_admin',
      displayName: 'CodeSphere Admin',
      bio: 'Official CodeSphere admin account.',
    },
    {
      email: 'sarah@example.com',
      password: 'Password123!',
      username: 'sarah_dev',
      displayName: 'Sarah Chen',
      bio: 'Senior full-stack engineer. TypeScript enthusiast. Open-source contributor. Building tools that make devs happier.',
      location: 'San Francisco, CA',
      website: 'https://sarahchen.dev',
      github: 'sarahchen',
    },
    {
      email: 'alex@example.com',
      password: 'Password123!',
      username: 'alex_code',
      displayName: 'Alex Rivera',
      bio: 'Backend engineer @ BigCorp. Distributed systems nerd. Rust in my spare time.',
      location: 'Austin, TX',
      github: 'alexrivera',
    },
    {
      email: 'mike@example.com',
      password: 'Password123!',
      username: 'mike_ts',
      displayName: 'Mike Johnson',
      bio: 'Frontend architect. React + TypeScript daily. Opinions are my own.',
      location: 'London, UK',
      website: 'https://mikej.io',
      github: 'mikejohnson',
    },
    {
      email: 'lina@example.com',
      password: 'Password123!',
      username: 'lina_rust',
      displayName: 'Lina Torres',
      bio: 'Systems programmer. Rust evangelist. Contributing to the Linux kernel on weekends.',
      location: 'Berlin, Germany',
      github: 'linatorres',
    },
    {
      email: 'jordan@example.com',
      password: 'Password123!',
      username: 'jordan_py',
      displayName: 'Jordan Kim',
      bio: 'Data engineer & ML hobbyist. Python is life. Writing about data pipelines and MLOps.',
      location: 'Seoul, South Korea',
      github: 'jordankim',
    },
    {
      email: 'emma@example.com',
      password: 'Password123!',
      username: 'emma_go',
      displayName: 'Emma Nakamura',
      bio: 'Cloud infrastructure engineer. Go, Kubernetes, Terraform. Building reliable systems at scale.',
      location: 'Tokyo, Japan',
      website: 'https://emmanakamura.dev',
      github: 'emmanakamura',
    },
  ];

  private readonly posts: SeedPost[] = [
    {
      authorUsername: 'sarah_dev',
      content:
        "Just migrated our monolith to a microservices architecture. Took 6 months but the deployment velocity improvement is insane — went from weekly releases to multiple deploys per day.\n\nBiggest lesson: don't try to split everything at once. Start with the domain that changes the most.",
    },
    {
      authorUsername: 'alex_code',
      content:
        'Hot take: most \"10x engineers\" are just people who are really good at saying no to unnecessary features.\n\nThe best code is the code you never have to write.',
    },
    {
      authorUsername: 'mike_ts',
      content:
        "Spent the weekend converting our React app from JavaScript to TypeScript. Found 14 bugs just from the type errors. 14!\n\nIf you're still on the fence about TypeScript, this is your sign.",
    },
    {
      authorUsername: 'lina_rust',
      content:
        "Rust's borrow checker rejected my code for the 47th time today and every single time it was right. The compiler is the best code reviewer I've ever had.",
    },
    {
      authorUsername: 'jordan_py',
      content:
        "TIL that Python's walrus operator (:=) can make list comprehensions SO much cleaner when you need to both filter and transform.\n\nBefore: [transform(x) for x in data if condition(transform(x))]\nAfter: [y for x in data if condition(y := transform(x))]",
    },
    {
      authorUsername: 'emma_go',
      content:
        'Our Kubernetes cluster just survived Black Friday with zero downtime. 300% traffic spike, auto-scaling kicked in perfectly.\n\nAll those months of load testing and chaos engineering paid off. Infra team is celebrating tonight. 🎉',
    },
    {
      authorUsername: 'sarah_dev',
      content:
        "Unpopular opinion: README-driven development is underrated.\n\nWrite the README first. If you can't explain what your project does in 3 sentences, you don't understand the problem well enough yet.",
    },
    {
      authorUsername: 'alex_code',
      content:
        'Debugging a production issue at 2 AM. The cause? A single missing `await` keyword.\n\nasync/await is great until you forget the await part. Always lint for floating promises, people.',
    },
    {
      authorUsername: 'mike_ts',
      content:
        'New blog post: "Why I stopped using Redux and switched to TanStack Query + Zustand"\n\nTLDR: Most of what we put in global state is actually server state. Once you treat it that way, everything gets simpler.',
    },
    {
      authorUsername: 'jordan_py',
      content:
        'Just gave my first conference talk! \"Building Real-Time ML Pipelines with Apache Kafka and Python\"\n\nWas terrified but the Q&A session was amazing. Highly recommend submitting CFPs even if you feel like an impostor.',
    },
    {
      authorUsername: 'lina_rust',
      content:
        "Replaced our C++ image processing service with Rust. Same performance, zero segfaults in 3 months of production. Memory safety isn't just a buzzword — it's a superpower.",
    },
    {
      authorUsername: 'emma_go',
      content:
        "Tip for anyone learning Go: don't fight the language. If you find yourself writing Java-style OOP patterns in Go, step back.\n\nComposition over inheritance. Interfaces are implicit. Simplicity is a feature, not a limitation.",
    },
  ];

  private readonly articles: SeedArticle[] = [
    {
      authorUsername: 'sarah_dev',
      title: 'A Practical Guide to TypeScript Generics',
      coverImageUrl:
        'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800',
      isPublished: true,
      content: [
        {
          type: 'paragraph',
          content:
            "Generics are one of the most powerful features in TypeScript, yet many developers avoid them because they seem intimidating. In this guide, I'll walk you through generics from the basics to advanced patterns you can use in your daily work.",
        },
        { type: 'heading', content: 'Why Generics?' },
        {
          type: 'paragraph',
          content:
            'Generics allow you to write reusable, type-safe code without sacrificing flexibility. Think of them as "type parameters" — just like function parameters let you pass different values, generics let you pass different types.',
        },
        { type: 'heading', content: 'Your First Generic Function' },
        {
          type: 'code',
          content:
            'function identity<T>(value: T): T {\n  return value;\n}\n\nconst num = identity(42);       // type: number\nconst str = identity("hello");  // type: string',
        },
        {
          type: 'paragraph',
          content:
            'The `T` is a type variable. When you call `identity(42)`, TypeScript infers that `T` is `number`. No type assertions needed.',
        },
        { type: 'heading', content: 'Constraining Generics' },
        {
          type: 'code',
          content:
            'function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {\n  return obj[key];\n}\n\nconst user = { name: "Sarah", age: 30 };\nconst name = getProperty(user, "name"); // string\n// getProperty(user, "email"); // Error!',
        },
        {
          type: 'paragraph',
          content:
            'By using `extends keyof T`, we tell TypeScript that `K` must be a valid key of `T`. This gives us autocomplete and compile-time safety.',
        },
        { type: 'heading', content: 'Generic Patterns in React' },
        {
          type: 'code',
          content:
            'type ListProps<T> = {\n  items: T[];\n  renderItem: (item: T) => React.ReactNode;\n};\n\nfunction List<T>({ items, renderItem }: ListProps<T>) {\n  return <ul>{items.map(renderItem)}</ul>;\n}',
        },
        {
          type: 'paragraph',
          content:
            'This pattern is incredibly useful for building reusable components. The `List` component works with any type while maintaining full type safety for the render function.',
        },
        { type: 'heading', content: 'Conclusion' },
        {
          type: 'paragraph',
          content:
            "Generics might look scary at first, but they're just a way to make your code both flexible and type-safe. Start simple, add constraints when needed, and you'll be writing generic-heavy code in no time.",
        },
      ],
    },
    {
      authorUsername: 'alex_code',
      title: 'Designing Resilient Distributed Systems: Lessons from Production',
      coverImageUrl:
        'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
      isPublished: true,
      content: [
        {
          type: 'paragraph',
          content:
            "After 5 years of building and operating distributed systems, I've learned that failure isn't just possible — it's inevitable. The question isn't whether your system will fail, but how gracefully it handles failure.",
        },
        { type: 'heading', content: 'The Circuit Breaker Pattern' },
        {
          type: 'paragraph',
          content:
            'When a downstream service starts failing, the worst thing you can do is keep hammering it with requests. A circuit breaker detects failures and "opens" the circuit, failing fast instead of waiting for timeouts.',
        },
        {
          type: 'code',
          content:
            'enum CircuitState { CLOSED, OPEN, HALF_OPEN }\n\nclass CircuitBreaker {\n  private state = CircuitState.CLOSED;\n  private failureCount = 0;\n  private threshold = 5;\n  private resetTimeout = 30000;\n\n  async call<T>(fn: () => Promise<T>): Promise<T> {\n    if (this.state === CircuitState.OPEN) {\n      throw new Error("Circuit is open");\n    }\n    try {\n      const result = await fn();\n      this.onSuccess();\n      return result;\n    } catch (err) {\n      this.onFailure();\n      throw err;\n    }\n  }\n}',
        },
        { type: 'heading', content: 'Retry with Exponential Backoff' },
        {
          type: 'paragraph',
          content:
            'Retries are essential, but naive retries can cause thundering herd problems. Always use exponential backoff with jitter to spread out retry attempts.',
        },
        { type: 'heading', content: 'Idempotency is Non-Negotiable' },
        {
          type: 'paragraph',
          content:
            'In a distributed system, messages can be delivered more than once. Every write operation should be idempotent — processing the same request twice should produce the same result as processing it once.',
        },
        {
          type: 'paragraph',
          content:
            'Use idempotency keys for API endpoints. Store them in a fast lookup (Redis works great) and check before processing any mutation.',
        },
        { type: 'heading', content: 'Takeaways' },
        {
          type: 'paragraph',
          content:
            'Build for failure from day one. Use circuit breakers, retries with backoff, idempotency keys, and health checks. Monitor everything. Your future self at 3 AM will thank you.',
        },
      ],
    },
    {
      authorUsername: 'mike_ts',
      title: 'State Management in 2026: TanStack Query Changed Everything',
      coverImageUrl:
        'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
      isPublished: true,
      content: [
        {
          type: 'paragraph',
          content:
            'For years, the React community treated all state the same — whether it was UI state (a modal open/closed) or server state (a list of users from an API). Redux became the default, and we shoved everything into a single global store.',
        },
        {
          type: 'paragraph',
          content:
            'Then TanStack Query (formerly React Query) came along and changed the game.',
        },
        {
          type: 'heading',
          content: 'The Core Insight: Server State is Different',
        },
        {
          type: 'paragraph',
          content:
            "Server state has unique characteristics: it's persisted remotely, it can become stale, it's shared across components, and it requires async fetching. Treating it like local UI state leads to massive boilerplate.",
        },
        { type: 'heading', content: 'The Query Options Factory Pattern' },
        {
          type: 'paragraph',
          content:
            "One pattern I've found invaluable is the query options factory. Instead of scattering query keys and functions across components, centralize them.",
        },
        {
          type: 'code',
          content:
            'export const productsQueryFactory = {\n  all: () => queryOptions({ queryKey: ["products"] }),\n  list: (filters?: Filters) => queryOptions({\n    queryKey: [...productsQueryFactory.all().queryKey, "list", filters],\n    queryFn: () => api.getProducts(filters),\n  }),\n  detail: (id: string) => queryOptions({\n    queryKey: [...productsQueryFactory.all().queryKey, id],\n    queryFn: () => api.getProduct(id),\n  }),\n};',
        },
        {
          type: 'paragraph',
          content:
            'This gives you consistent cache keys, easy invalidation, and a single source of truth for how data is fetched.',
        },
        { type: 'heading', content: 'What About Client State?' },
        {
          type: 'paragraph',
          content:
            "For the small amount of truly client-side state (theme, sidebar open, form state), I use Zustand or just React context. No need for a heavyweight solution when you've already handled 80% of your state with TanStack Query.",
        },
        { type: 'heading', content: 'Conclusion' },
        {
          type: 'paragraph',
          content:
            'Stop fighting your data. Use the right tool for the right kind of state. Your codebase will be smaller, faster, and infinitely more maintainable.',
        },
      ],
    },
    {
      authorUsername: 'lina_rust',
      title: 'Why Rust Ownership Makes You a Better Programmer',
      coverImageUrl:
        'https://images.unsplash.com/photo-1550439062-609e1531270e?w=800',
      isPublished: true,
      content: [
        {
          type: 'paragraph',
          content:
            "Rust's ownership system is notorious for its steep learning curve. New Rustaceans spend hours fighting the borrow checker, wondering why the compiler won't let them do things that seem perfectly reasonable. But here's the thing: the borrow checker is almost always right.",
        },
        { type: 'heading', content: 'What is Ownership?' },
        {
          type: 'paragraph',
          content:
            'Every value in Rust has exactly one owner. When the owner goes out of scope, the value is dropped (freed). You can lend references (borrows), but the rules ensure you never have dangling pointers or data races.',
        },
        {
          type: 'code',
          content:
            'fn main() {\n    let s1 = String::from("hello");\n    let s2 = s1;  // s1 is MOVED, no longer valid\n    // println!("{}", s1);  // Compile error!\n    println!("{}", s2);  // Works fine\n}',
        },
        { type: 'heading', content: 'How This Makes You Better' },
        {
          type: 'paragraph',
          content:
            "After learning Rust, you start noticing resource management issues in every language. You'll catch potential memory leaks in Go, spot race conditions in JavaScript Promises, and write cleaner C++ — all because Rust trained you to think about ownership.",
        },
        { type: 'heading', content: 'The Payoff' },
        {
          type: 'paragraph',
          content:
            'The upfront cost of learning ownership pays dividends. Our team replaced a C++ service with Rust and went from 2-3 memory-related incidents per month to zero. The code is just as fast, far safer, and honestly more readable.',
        },
      ],
    },
    {
      authorUsername: 'jordan_py',
      title: 'Building Your First ML Pipeline with Python and Apache Kafka',
      coverImageUrl:
        'https://images.unsplash.com/photo-1527474305487-b87b222841cc?w=800',
      isPublished: true,
      content: [
        {
          type: 'paragraph',
          content:
            "Machine learning models are useless if they can't process data in real time. In this article, I'll show you how to build a production-ready ML pipeline using Python and Apache Kafka.",
        },
        { type: 'heading', content: 'Architecture Overview' },
        {
          type: 'paragraph',
          content:
            'Our pipeline has three stages: data ingestion (Kafka producer), feature engineering (Kafka Streams or Faust), and model inference (Kafka consumer + scikit-learn/PyTorch).',
        },
        { type: 'heading', content: 'Setting Up the Producer' },
        {
          type: 'code',
          content:
            'from kafka import KafkaProducer\nimport json\n\nproducer = KafkaProducer(\n    bootstrap_servers=["localhost:9092"],\n    value_serializer=lambda v: json.dumps(v).encode("utf-8"),\n)\n\ndef send_event(event: dict):\n    producer.send("raw-events", value=event)\n    producer.flush()',
        },
        { type: 'heading', content: 'Model Inference Consumer' },
        {
          type: 'paragraph',
          content:
            'The consumer reads processed features from Kafka, runs them through a pre-trained model, and writes predictions back to another topic. This decoupled design means you can update the model without touching the pipeline.',
        },
        { type: 'heading', content: 'Lessons Learned' },
        {
          type: 'paragraph',
          content:
            "Schema evolution is critical — use Avro or Protobuf, not raw JSON. Monitor consumer lag religiously. And always, always have a dead letter queue for messages your pipeline can't process.",
        },
      ],
    },
    {
      authorUsername: 'emma_go',
      title: "Kubernetes in Production: What They Don't Tell You",
      coverImageUrl:
        'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800',
      isPublished: true,
      content: [
        {
          type: 'paragraph',
          content:
            "Every Kubernetes tutorial makes it look easy: write a YAML file, `kubectl apply`, done. But running K8s in production is a different beast entirely. Here's what I wish I knew before we went all-in.",
        },
        { type: 'heading', content: 'Resource Limits Are Not Optional' },
        {
          type: 'paragraph',
          content:
            "If you don't set CPU and memory limits, one runaway pod can take down your entire node. Set requests AND limits for every container. Use LimitRange and ResourceQuota to enforce this at the namespace level.",
        },
        { type: 'heading', content: 'Pod Disruption Budgets Save Lives' },
        {
          type: 'code',
          content:
            'apiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata:\n  name: api-pdb\nspec:\n  minAvailable: 2\n  selector:\n    matchLabels:\n      app: api',
        },
        {
          type: 'paragraph',
          content:
            'Without a PDB, a node drain during maintenance can kill all your pods at once. Always define how many pods must stay available.',
        },
        { type: 'heading', content: 'Observability is Everything' },
        {
          type: 'paragraph',
          content:
            'You need three pillars: metrics (Prometheus + Grafana), logs (Loki or ELK), and traces (Jaeger or Tempo). Without all three, debugging production issues becomes guesswork.',
        },
        { type: 'heading', content: 'Final Thoughts' },
        {
          type: 'paragraph',
          content:
            "Kubernetes is incredibly powerful, but it's not magic. Invest in understanding it deeply, automate everything you can, and respect the complexity. Your on-call rotations will thank you.",
        },
      ],
    },
  ];
}
