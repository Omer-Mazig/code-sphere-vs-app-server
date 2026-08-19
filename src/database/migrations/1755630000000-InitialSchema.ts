import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1755630000000 implements MigrationInterface {
  name = 'InitialSchema1755630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(
      `CREATE TYPE "public"."likes_targettype_enum" AS ENUM('POST', 'ARTICLE', 'COMMENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."comments_targettype_enum" AS ENUM('POST', 'ARTICLE', 'COMMENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shares_targettype_enum" AS ENUM('POST', 'ARTICLE', 'COMMENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('POST_LIKED', 'POST_COMMENTED', 'COMMENT_REPLIED', 'NEW_FOLLOWER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_targettype_enum" AS ENUM('POST', 'ARTICLE', 'USER')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "username" character varying NOT NULL,
        "displayName" character varying,
        "bio" text,
        "avatarUrl" character varying,
        "website" character varying,
        "github" character varying,
        "location" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "follows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "followerId" uuid NOT NULL,
        "followingId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_follows" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_follows_follower_following" UNIQUE ("followerId", "followingId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "posts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "authorId" uuid NOT NULL,
        "content" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_posts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "articles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "authorId" uuid NOT NULL,
        "title" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "content" jsonb NOT NULL,
        "coverImageUrl" character varying,
        "isPublished" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_articles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_articles_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "likes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "targetId" uuid NOT NULL,
        "targetType" "public"."likes_targettype_enum" NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_likes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_likes_user_target" UNIQUE ("userId", "targetId", "targetType")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "authorId" uuid NOT NULL,
        "targetId" uuid NOT NULL,
        "targetType" "public"."comments_targettype_enum" NOT NULL,
        "content" text NOT NULL,
        "parentId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comments" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "shares" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "targetId" uuid NOT NULL,
        "targetType" "public"."shares_targettype_enum" NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shares" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_shares_user_target" UNIQUE ("userId", "targetId", "targetType")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "tokenHash" character varying NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "revokedAt" TIMESTAMP,
        "replacedByTokenId" character varying,
        "userAgent" character varying,
        "ipAddress" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" "public"."notifications_type_enum" NOT NULL,
        "targetType" "public"."notifications_targettype_enum",
        "payload" jsonb NOT NULL,
        "isRead" boolean NOT NULL DEFAULT false,
        "readAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "notification_stream_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "tokenHash" character varying NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_stream_tokens" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_comments_target_parent_created" ON "comments" ("targetId", "targetType", "parentId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_parent_created" ON "comments" ("parentId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_read_created" ON "notifications" ("userId", "isRead", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_target_read_created" ON "notifications" ("userId", "targetType", "isRead", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_stream_tokens_tokenHash" ON "notification_stream_tokens" ("tokenHash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_stream_tokens_user_expires" ON "notification_stream_tokens" ("userId", "expiresAt")`,
    );

    await queryRunner.query(
      `ALTER TABLE "follows" ADD CONSTRAINT "FK_follows_follower" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "follows" ADD CONSTRAINT "FK_follows_following" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD CONSTRAINT "FK_posts_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" ADD CONSTRAINT "FK_articles_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "likes" ADD CONSTRAINT "FK_likes_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_parent" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shares" ADD CONSTRAINT "FK_shares_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_notifications_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shares" DROP CONSTRAINT "FK_shares_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_parent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_author"`,
    );
    await queryRunner.query(
      `ALTER TABLE "likes" DROP CONSTRAINT "FK_likes_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" DROP CONSTRAINT "FK_articles_author"`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" DROP CONSTRAINT "FK_posts_author"`,
    );
    await queryRunner.query(
      `ALTER TABLE "follows" DROP CONSTRAINT "FK_follows_following"`,
    );
    await queryRunner.query(
      `ALTER TABLE "follows" DROP CONSTRAINT "FK_follows_follower"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_stream_tokens_user_expires"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_stream_tokens_tokenHash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notifications_user_target_read_created"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notifications_user_read_created"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_comments_parent_created"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_comments_target_parent_created"`,
    );

    await queryRunner.query(`DROP TABLE "notification_stream_tokens"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "shares"`);
    await queryRunner.query(`DROP TABLE "comments"`);
    await queryRunner.query(`DROP TABLE "likes"`);
    await queryRunner.query(`DROP TABLE "articles"`);
    await queryRunner.query(`DROP TABLE "posts"`);
    await queryRunner.query(`DROP TABLE "follows"`);
    await queryRunner.query(`DROP TABLE "users"`);

    await queryRunner.query(
      `DROP TYPE "public"."notifications_targettype_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."shares_targettype_enum"`);
    await queryRunner.query(`DROP TYPE "public"."comments_targettype_enum"`);
    await queryRunner.query(`DROP TYPE "public"."likes_targettype_enum"`);
  }
}
