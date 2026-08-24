import { createHash } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthService } from '../src/auth/auth.service';
import { ErrorCode } from '../src/common/errors/error-codes.enum';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { PostsService } from '../src/posts/posts.service';
import { createTestingApp, resetDatabase } from './testing-app';
import { registerVerifiedUser, TEST_PASSWORD } from './test-helpers';

describe('Auth + posts services (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authService: AuthService;
  let postsService: PostsService;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestingApp());
    authService = app.get(AuthService);
    postsService = app.get(PostsService);
  });

  afterEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rotates refresh tokens in the database and treats reuse as theft', async () => {
    const { user } = await registerVerifiedUser(app, 'rot');
    const login = await authService.login(
      { email: user.email, password: TEST_PASSWORD },
      {},
    );

    const tokens = dataSource.getRepository(RefreshToken);
    const loginHash = createHash('sha256')
      .update(login.refreshToken)
      .digest('hex');
    const first = await tokens.findOneByOrFail({ tokenHash: loginHash });
    expect(first.revokedAt).toBeNull();

    const rotated = await authService.refresh(login.refreshToken, {});
    const afterRotation = await tokens.findOneByOrFail({ id: first.id });
    expect(afterRotation.revokedAt).not.toBeNull();
    expect(afterRotation.replacedByTokenId).toBeTruthy();
    expect(rotated.refreshToken).not.toBe(login.refreshToken);

    await expect(
      authService.refresh(login.refreshToken, {}),
    ).rejects.toMatchObject({
      errorCode: ErrorCode.AUTHENTICATION_ERROR,
    });

    const remaining = await tokens.find({
      where: { userId: login.user.id },
    });
    expect(remaining.every((token) => token.revokedAt != null)).toBe(true);
  });

  it('blocks updating another user post at the service layer', async () => {
    const author = await registerVerifiedUser(app, 'auth');
    const other = await registerVerifiedUser(app, 'oth');
    const post = await postsService.create(author.session.user.id, {
      content: 'owned by author',
    });

    await expect(
      postsService.update(post.id, other.session.user.id, {
        content: 'hijacked',
      }),
    ).rejects.toMatchObject({
      errorCode: ErrorCode.POST_UPDATE_FORBIDDEN,
    });

    const updated = await postsService.update(post.id, author.session.user.id, {
      content: 'edited by owner',
    });
    expect(updated.content).toBe('edited by owner');
  });
});
