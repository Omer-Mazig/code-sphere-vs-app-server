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
import { Topic } from '../topics/entities/topic.entity';
import { UserFollowedTopic } from '../topics/entities/user-followed-topic.entity';
import { PostTopic } from '../topics/entities/post-topic.entity';
import { ArticleTopic } from '../topics/entities/article-topic.entity';
import { CURATED_TOPICS } from '../topics/topics.constants';
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
  avatarUrl?: string;
  emailVerified: boolean;
};

type SeedPost = {
  authorUsername: string;
  content: string;
};

type SeedArticleBlock = {
  type: 'paragraph' | 'heading' | 'code';
  content: string;
};

type SeedArticle = {
  authorUsername: string;
  title: string;
  content: SeedArticleBlock[];
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
    @InjectRepository(Topic)
    private readonly topicRepository: Repository<Topic>,
    @InjectRepository(UserFollowedTopic)
    private readonly userFollowedTopicRepository: Repository<UserFollowedTopic>,
    @InjectRepository(PostTopic)
    private readonly postTopicRepository: Repository<PostTopic>,
    @InjectRepository(ArticleTopic)
    private readonly articleTopicRepository: Repository<ArticleTopic>,
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
    await this.topicRepository
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

    const topicMap = await this.seedTopics();
    const topicFollowsCreated = await this.seedTopicFollows(userMap, topicMap);

    // 2. Follows (build a realistic social graph)
    const followsCreated = await this.seedFollows(userMap);

    // 3. Posts
    const postEntities = await this.seedPosts(this.posts, userMap);

    // 4. Articles
    const articleEntities = await this.seedArticles(this.articles, userMap);

    await this.seedContentTopics(postEntities, articleEntities, topicMap);

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
      topics: Object.keys(topicMap).length,
      topicFollows: topicFollowsCreated,
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
            avatarUrl: u.avatarUrl,
            isActive: true,
            emailVerified: true,
          }),
        );
      }

      map[u.username] = existing.id;
    }

    return map;
  }

  // =================== Topics ===================

  private async seedTopics() {
    const map: Record<string, string> = {};

    for (const topic of CURATED_TOPICS) {
      let existing = await this.topicRepository.findOne({
        where: { slug: topic.slug },
      });
      if (!existing) {
        existing = await this.topicRepository.save(
          this.topicRepository.create({
            slug: topic.slug,
            name: topic.name,
            description: topic.description,
          }),
        );
      }
      map[topic.slug] = existing.id;
    }

    return map;
  }

  private async seedTopicFollows(
    userMap: Record<string, string>,
    topicMap: Record<string, string>,
  ) {
    const pairs: [string, string][] = [
      ['sarah_dev', 'typescript'],
      ['sarah_dev', 'react'],
      ['alex_code', 'javascript'],
      ['mike_ts', 'typescript'],
      ['priya_devops', 'devops'],
      ['priya_devops', 'kubernetes'],
      ['lina_rust', 'rust'],
      ['emma_go', 'go'],
    ];

    let created = 0;
    for (const [username, slug] of pairs) {
      const userId = userMap[username];
      const topicId = topicMap[slug];
      if (!userId || !topicId) {
        continue;
      }
      const exists = await this.userFollowedTopicRepository.findOne({
        where: { userId, topicId },
      });
      if (exists) {
        continue;
      }
      await this.userFollowedTopicRepository.save(
        this.userFollowedTopicRepository.create({ userId, topicId }),
      );
      created++;
    }
    return created;
  }

  private async seedContentTopics(
    posts: Post[],
    articles: Article[],
    topicMap: Record<string, string>,
  ) {
    const typescript = topicMap.typescript;
    const react = topicMap.react;
    const devops = topicMap.devops;
    if (typescript && posts[0]) {
      await this.postTopicRepository.save(
        this.postTopicRepository.create({
          postId: posts[0].id,
          topicId: typescript,
        }),
      );
    }
    if (react && posts[1]) {
      await this.postTopicRepository.save(
        this.postTopicRepository.create({
          postId: posts[1].id,
          topicId: react,
        }),
      );
    }
    if (typescript && articles[0]) {
      await this.articleTopicRepository.save(
        this.articleTopicRepository.create({
          articleId: articles[0].id,
          topicId: typescript,
        }),
      );
    }
    if (devops && articles[1]) {
      await this.articleTopicRepository.save(
        this.articleTopicRepository.create({
          articleId: articles[1].id,
          topicId: devops,
        }),
      );
    }
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
      ['nina_swift', 'sarah_dev'],
      ['tom_java', 'sarah_dev'],
      ['priya_devops', 'sarah_dev'],
      ['carlos_mobile', 'sarah_dev'],
      ['maya_design', 'sarah_dev'],
      ['david_db', 'sarah_dev'],
      ['olivia_sec', 'sarah_dev'],
      ['ryan_startup', 'sarah_dev'],

      // alex_code is active, gets followers
      ['sarah_dev', 'alex_code'],
      ['mike_ts', 'alex_code'],
      ['jordan_py', 'alex_code'],
      ['tom_java', 'alex_code'],
      ['david_db', 'alex_code'],

      // mike_ts ↔ lina_rust (mutual)
      ['mike_ts', 'lina_rust'],
      ['lina_rust', 'mike_ts'],
      ['maya_design', 'mike_ts'],

      // jordan_py follows a few
      ['jordan_py', 'emma_go'],
      ['jordan_py', 'lina_rust'],
      ['jordan_py', 'david_db'],

      // emma_go follows a few
      ['emma_go', 'alex_code'],
      ['emma_go', 'jordan_py'],
      ['emma_go', 'priya_devops'],

      // New user connections
      ['nina_swift', 'carlos_mobile'],
      ['carlos_mobile', 'nina_swift'],
      ['nina_swift', 'maya_design'],
      ['tom_java', 'david_db'],
      ['david_db', 'tom_java'],
      ['priya_devops', 'emma_go'],
      ['priya_devops', 'olivia_sec'],
      ['olivia_sec', 'priya_devops'],
      ['ryan_startup', 'alex_code'],
      ['ryan_startup', 'mike_ts'],
      ['maya_design', 'sarah_dev'],
      ['carlos_mobile', 'mike_ts'],

      // admin follows key people
      ['cs_admin', 'sarah_dev'],
      ['cs_admin', 'alex_code'],
      ['cs_admin', 'ryan_startup'],
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
          content: this.articleBlocksToMarkdown(a.content),
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

    // Seed comments on posts — ~3-5 per post
    for (const post of posts) {
      const commentCount = 3 + Math.floor(Math.random() * 3);
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

    // Seed comments on articles — ~3-6 per article
    for (const article of articles) {
      const commentCount = 3 + Math.floor(Math.random() * 4);
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

  private articleBlocksToMarkdown(blocks: SeedArticleBlock[]): string {
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

  // =================== Seed data ===================

  private readonly users: SeedUser[] = [
    {
      email: 'admin@codesphere.dev',
      password: 'Admin1234!',
      username: 'cs_admin',
      displayName: 'CodeSphere Admin',
      bio: 'Official CodeSphere admin account.',
      emailVerified: true,
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
      avatarUrl: 'https://i.pravatar.cc/150?u=sarah_dev',
      emailVerified: true,
    },
    {
      email: 'alex@example.com',
      password: 'Password123!',
      username: 'alex_code',
      displayName: 'Alex Rivera',
      bio: 'Backend engineer @ BigCorp. Distributed systems nerd. Rust in my spare time.',
      location: 'Austin, TX',
      github: 'alexrivera',
      avatarUrl: 'https://i.pravatar.cc/150?u=alex_code',
      emailVerified: true,
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
      avatarUrl: 'https://i.pravatar.cc/150?u=mike_ts',
      emailVerified: true,
    },
    {
      email: 'lina@example.com',
      password: 'Password123!',
      username: 'lina_rust',
      displayName: 'Lina Torres',
      bio: 'Systems programmer. Rust evangelist. Contributing to the Linux kernel on weekends.',
      location: 'Berlin, Germany',
      github: 'linatorres',
      avatarUrl: 'https://i.pravatar.cc/150?u=lina_rust',
      emailVerified: true,
    },
    {
      email: 'jordan@example.com',
      password: 'Password123!',
      username: 'jordan_py',
      displayName: 'Jordan Kim',
      bio: 'Data engineer & ML hobbyist. Python is life. Writing about data pipelines and MLOps.',
      location: 'Seoul, South Korea',
      github: 'jordankim',
      avatarUrl: 'https://i.pravatar.cc/150?u=jordan_py',
      emailVerified: true,
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
      avatarUrl: 'https://i.pravatar.cc/150?u=emma_go',
      emailVerified: true,
    },
    {
      email: 'nina@example.com',
      password: 'Password123!',
      username: 'nina_swift',
      displayName: 'Nina Patel',
      bio: 'iOS engineer building delightful mobile experiences. SwiftUI advocate. Previously at Apple.',
      location: 'Cupertino, CA',
      github: 'ninapatel',
      avatarUrl: 'https://i.pravatar.cc/150?u=nina_swift',
      emailVerified: true,
    },
    {
      email: 'tom@example.com',
      password: 'Password123!',
      username: 'tom_java',
      displayName: 'Tom Weber',
      bio: 'Java backend developer. Spring Boot, Kafka, and way too much coffee. Building fintech APIs.',
      location: 'Zurich, Switzerland',
      github: 'tomweber',
      avatarUrl: 'https://i.pravatar.cc/150?u=tom_java',
      emailVerified: true,
    },
    {
      email: 'priya@example.com',
      password: 'Password123!',
      username: 'priya_devops',
      displayName: 'Priya Sharma',
      bio: 'DevOps engineer. CI/CD pipelines, GitOps, and making deploys boring (in a good way).',
      location: 'Bangalore, India',
      website: 'https://priyasharma.dev',
      github: 'priyasharma',
      avatarUrl: 'https://i.pravatar.cc/150?u=priya_devops',
      emailVerified: true,
    },
    {
      email: 'carlos@example.com',
      password: 'Password123!',
      username: 'carlos_mobile',
      displayName: 'Carlos Mendez',
      bio: 'React Native developer. Cross-platform apps that feel native. Expo enthusiast.',
      location: 'Barcelona, Spain',
      github: 'carlosmendez',
      avatarUrl: 'https://i.pravatar.cc/150?u=carlos_mobile',
      emailVerified: true,
    },
    {
      email: 'maya@example.com',
      password: 'Password123!',
      username: 'maya_design',
      displayName: 'Maya Okonkwo',
      bio: 'Design systems engineer. Bridging design and code with tokens, Storybook, and accessibility.',
      location: 'Toronto, Canada',
      website: 'https://mayaokonkwo.design',
      github: 'mayaokonkwo',
      avatarUrl: 'https://i.pravatar.cc/150?u=maya_design',
      emailVerified: true,
    },
    {
      email: 'david@example.com',
      password: 'Password123!',
      username: 'david_db',
      displayName: 'David Okafor',
      bio: 'Database engineer. PostgreSQL tuning, query optimization, and schema design at scale.',
      location: 'Lagos, Nigeria',
      github: 'davidokafor',
      avatarUrl: 'https://i.pravatar.cc/150?u=david_db',
      emailVerified: true,
    },
    {
      email: 'olivia@example.com',
      password: 'Password123!',
      username: 'olivia_sec',
      displayName: 'Olivia Grant',
      bio: 'Application security engineer. Threat modeling, OWASP, and making security a team sport.',
      location: 'Melbourne, Australia',
      github: 'oliviagrant',
      avatarUrl: 'https://i.pravatar.cc/150?u=olivia_sec',
      emailVerified: true,
    },
    {
      email: 'ryan@example.com',
      password: 'Password123!',
      username: 'ryan_startup',
      displayName: 'Ryan Foster',
      bio: 'CTO at a seed-stage startup. Full-stack generalist. Shipping fast, learning faster.',
      location: 'New York, NY',
      website: 'https://ryanfoster.io',
      github: 'ryanfoster',
      avatarUrl: 'https://i.pravatar.cc/150?u=ryan_startup',
      emailVerified: true,
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
    {
      authorUsername: 'nina_swift',
      content:
        'SwiftUI previews are underrated for rapid UI iteration. I can test 5 layout variants in the time it used to take to rebuild once in UIKit.\n\nPro tip: use #Preview with different device sizes and dark mode variants.',
    },
    {
      authorUsername: 'tom_java',
      content:
        'Just discovered virtual threads in Java 21. Our API latency under load dropped 40% with minimal code changes.\n\nIf you are still spinning up thread pools manually, it is worth a look.',
    },
    {
      authorUsername: 'priya_devops',
      content:
        'Deployed our first GitOps workflow today — Argo CD syncing from main branch to staging automatically.\n\nNo more "works on my machine" deploys. PR merges trigger rollouts with automatic rollback on failure.',
    },
    {
      authorUsername: 'carlos_mobile',
      content:
        'Expo SDK 52 is a game changer for React Native dev. The new architecture support finally feels production-ready.\n\nBuilt and shipped a feature to both iOS and Android in one afternoon.',
    },
    {
      authorUsername: 'maya_design',
      content:
        'Shipped our design token migration this week. 200+ hardcoded colors replaced with semantic tokens.\n\nDark mode went from "we will do it later" to "it just works" overnight.',
    },
    {
      authorUsername: 'david_db',
      content:
        'Found a query doing a sequential scan on 12M rows. Added a partial index, runtime went from 8s to 12ms.\n\nAlways check EXPLAIN ANALYZE before blaming the ORM.',
    },
    {
      authorUsername: 'olivia_sec',
      content:
        'Ran our first threat modeling session with the product team today. Found 3 critical gaps before they became production incidents.\n\nSecurity is not a gate — it is a conversation.',
    },
    {
      authorUsername: 'ryan_startup',
      content:
        'Week 47 at the startup. We finally have paying customers. The MVP that felt embarrassingly simple 6 months ago is now generating revenue.\n\nShip early, iterate fast, listen to users.',
    },
    {
      authorUsername: 'sarah_dev',
      content:
        'Pair programming session today reminded me why I love this job. Two brains on a tricky race condition — solved in 20 minutes what would have taken me 2 hours solo.',
    },
    {
      authorUsername: 'alex_code',
      content:
        'Event sourcing is not for every project, but when audit trails are a hard requirement, it is worth the complexity.\n\nWe are 3 months in and compliance reviews got dramatically easier.',
    },
    {
      authorUsername: 'mike_ts',
      content:
        'Migrated our component library to CSS modules + Tailwind v4. Bundle size down 18%, and designers can finally tweak spacing without a PR.\n\nUtility-first CSS won.',
    },
    {
      authorUsername: 'lina_rust',
      content:
        'Contributed my first patch to the Linux kernel mailing list. The review process is intense but the feedback quality is unmatched.\n\nRust in kernel space is getting real.',
    },
    {
      authorUsername: 'jordan_py',
      content:
        'Polars is replacing pandas in our data pipelines. 10x faster on large DataFrames and the API is actually pleasant.\n\nIf you have not tried it yet, start with a single ETL job.',
    },
    {
      authorUsername: 'nina_swift',
      content:
        'Apple Vision Pro dev kits arrived at the office. Spatial computing UI patterns are wild — everything you know about 2D layout goes out the window.\n\nExciting times for mobile devs.',
    },
    {
      authorUsername: 'tom_java',
      content:
        'Spring Boot 3.4 native image support cut our cold start from 4s to 200ms on Lambda.\n\nGraalVM compilation is finicky but the runtime savings are real for serverless.',
    },
    {
      authorUsername: 'priya_devops',
      content:
        'Chaos engineering Friday: we killed a random pod in production. HPA recovered in 30 seconds, zero user impact.\n\nConfidence in our infra is at an all-time high.',
    },
    {
      authorUsername: 'david_db',
      content:
        'PostgreSQL 17 JSONB improvements are no joke. Our document-heavy queries are 3x faster after upgrading.\n\nAlways read the release notes before upgrading — there are gems in every version.',
    },
    {
      authorUsername: 'maya_design',
      content:
        'Accessibility audit found 47 issues in our app. Fixed the top 10 in a sprint — screen reader users went from "unusable" to "pretty good".\n\nWCAG is not optional.',
    },
    {
      authorUsername: 'ryan_startup',
      content:
        'Hiring our first engineer next month. Job posting is live — looking for a generalist who loves TypeScript and does not mind wearing many hats.\n\nDM me if you know someone great.',
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
            "Generics might look scary at first, but they're just a way to make your code both flexible and type-safe. Start simple:\n\n- Add a single type parameter\n- Constrain it when the compiler asks\n- Use it in the components you already reuse\n\nYou'll be writing generic-heavy code in no time.",
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
    {
      authorUsername: 'nina_swift',
      title: 'SwiftUI Architecture Patterns That Scale',
      coverImageUrl:
        'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800',
      isPublished: true,
      content: [
        {
          type: 'paragraph',
          content:
            'SwiftUI makes it easy to build UIs quickly, but without structure your codebase becomes unmaintainable fast. Here are the patterns I use on production apps with 100k+ users.',
        },
        { type: 'heading', content: 'MVVM with ObservableObject' },
        {
          type: 'paragraph',
          content:
            'Keep views dumb. ViewModels handle business logic and state. Use @StateObject for ownership and @ObservedObject for injected dependencies.',
        },
        { type: 'heading', content: 'Feature Modules' },
        {
          type: 'paragraph',
          content:
            'Split your app into feature modules (Auth, Feed, Profile). Each module owns its views, view models, and models. Shared code lives in a Core module.',
        },
        { type: 'heading', content: 'Conclusion' },
        {
          type: 'paragraph',
          content:
            'SwiftUI rewards good architecture. Invest early in clear boundaries and your future self will thank you when the app grows.',
        },
      ],
    },
    {
      authorUsername: 'david_db',
      title: 'PostgreSQL Indexing Strategies for High-Traffic Apps',
      coverImageUrl:
        'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800',
      isPublished: true,
      content: [
        {
          type: 'paragraph',
          content:
            'Indexes are the single biggest lever for database performance, but the wrong index can hurt writes and waste disk space. Here is a practical guide based on years of tuning production PostgreSQL.',
        },
        { type: 'heading', content: 'B-Tree vs GIN vs GiST' },
        {
          type: 'paragraph',
          content:
            'B-Tree indexes handle equality and range queries on scalar columns. GIN indexes excel at JSONB and full-text search. GiST is for geometric and custom types. Pick the right tool.',
        },
        { type: 'heading', content: 'Partial Indexes' },
        {
          type: 'code',
          content:
            'CREATE INDEX idx_active_users ON users (email)\n  WHERE is_active = true;',
        },
        {
          type: 'paragraph',
          content:
            'Partial indexes are smaller and faster when your queries always filter on the same condition. We use them heavily for soft-deleted records.',
        },
        { type: 'heading', content: 'Monitoring Index Usage' },
        {
          type: 'paragraph',
          content:
            'Query pg_stat_user_indexes regularly. Drop indexes with zero scans — they cost write performance for no benefit.',
        },
      ],
    },
    {
      authorUsername: 'olivia_sec',
      title: 'A Developer-Friendly Guide to OWASP Top 10',
      coverImageUrl:
        'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800',
      isPublished: true,
      content: [
        {
          type: 'paragraph',
          content:
            'Security vulnerabilities are not just for security teams. Every developer should understand the OWASP Top 10 and how to prevent these issues in their code.',
        },
        { type: 'heading', content: 'Injection Attacks' },
        {
          type: 'paragraph',
          content:
            'Never concatenate user input into SQL queries. Use parameterized queries or an ORM. Same applies to shell commands and LDAP queries.',
        },
        { type: 'heading', content: 'Broken Authentication' },
        {
          type: 'paragraph',
          content:
            'Use bcrypt or argon2 for password hashing. Implement rate limiting on login endpoints. Rotate refresh tokens. Session fixation is still a real attack vector.',
        },
        { type: 'heading', content: 'Security Headers' },
        {
          type: 'paragraph',
          content:
            'Set Content-Security-Policy, X-Frame-Options, and Strict-Transport-Security. Most frameworks make this easy — there is no excuse to skip them.',
        },
      ],
    },
    {
      authorUsername: 'priya_devops',
      title: 'GitOps in Practice: From Zero to Production',
      coverImageUrl:
        'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800',
      isPublished: true,
      content: [
        {
          type: 'paragraph',
          content:
            'GitOps treats Git as the single source of truth for infrastructure and application state. Here is how we adopted it and what we learned along the way.',
        },
        { type: 'heading', content: 'The GitOps Loop' },
        {
          type: 'paragraph',
          content:
            'Developer merges PR → CI builds image → CI updates manifest in Git → Argo CD detects drift → cluster syncs automatically. No kubectl apply from laptops.',
        },
        { type: 'heading', content: 'Directory Structure' },
        {
          type: 'code',
          content:
            'gitops-repo/\n  apps/\n    api/\n      base/\n      overlays/\n        staging/\n        production/\n  infrastructure/\n    monitoring/\n    ingress/',
        },
        { type: 'heading', content: 'Rollback Strategy' },
        {
          type: 'paragraph',
          content:
            'Because every deploy is a Git commit, rollback is git revert + sync. We can roll back to any point in history in under 2 minutes.',
        },
      ],
    },
    {
      authorUsername: 'maya_design',
      title: 'Building Accessible Design Systems from Day One',
      coverImageUrl:
        'https://images.unsplash.com/photo-1559028012-481c04fa7025?w=800',
      isPublished: true,
      content: [
        {
          type: 'paragraph',
          content:
            'Accessibility is often treated as a polish step, but baking it into your design system from the start saves enormous rework and makes your product usable for everyone.',
        },
        { type: 'heading', content: 'Color Contrast Tokens' },
        {
          type: 'paragraph',
          content:
            'Define semantic color tokens (text-primary, text-muted) with WCAG AA contrast ratios baked in. Designers pick tokens, not raw hex values.',
        },
        { type: 'heading', content: 'Focus States' },
        {
          type: 'paragraph',
          content:
            'Every interactive component needs a visible focus ring. Do not remove outline: none without providing an alternative. Keyboard users depend on it.',
        },
        { type: 'heading', content: 'Testing with Real Users' },
        {
          type: 'paragraph',
          content:
            'Automated tools catch ~30% of issues. Pair axe-core scans with screen reader testing and, when possible, sessions with disabled users.',
        },
      ],
    },
  ];
}
