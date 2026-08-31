import { MigrationInterface, QueryRunner } from 'typeorm';
import { CURATED_TOPICS } from '../../topics/topics.constants';

export class AddTopics1756800000000 implements MigrationInterface {
  name = 'AddTopics1756800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "topics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_topics" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_topics_slug" UNIQUE ("slug")
      )
    `);

    for (const topic of CURATED_TOPICS) {
      await queryRunner.query(
        `INSERT INTO "topics" ("slug", "name", "description") VALUES ($1, $2, $3)`,
        [topic.slug, topic.name, topic.description],
      );
    }

    await queryRunner.query(`
      CREATE TABLE "user_followed_topics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "topicId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_followed_topics" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_followed_topics_user_topic" UNIQUE ("userId", "topicId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "user_followed_topics"
      ADD CONSTRAINT "FK_user_followed_topics_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "user_followed_topics"
      ADD CONSTRAINT "FK_user_followed_topics_topic"
      FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE TABLE "post_topics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "postId" uuid NOT NULL,
        "topicId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_topics" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_post_topics_post_topic" UNIQUE ("postId", "topicId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "post_topics"
      ADD CONSTRAINT "FK_post_topics_post"
      FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "post_topics"
      ADD CONSTRAINT "FK_post_topics_topic"
      FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE TABLE "article_topics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "articleId" uuid NOT NULL,
        "topicId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_article_topics" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_article_topics_article_topic" UNIQUE ("articleId", "topicId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "article_topics"
      ADD CONSTRAINT "FK_article_topics_article"
      FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "article_topics"
      ADD CONSTRAINT "FK_article_topics_topic"
      FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "article_topics" DROP CONSTRAINT "FK_article_topics_topic"`);
    await queryRunner.query(`ALTER TABLE "article_topics" DROP CONSTRAINT "FK_article_topics_article"`);
    await queryRunner.query(`DROP TABLE "article_topics"`);
    await queryRunner.query(`ALTER TABLE "post_topics" DROP CONSTRAINT "FK_post_topics_topic"`);
    await queryRunner.query(`ALTER TABLE "post_topics" DROP CONSTRAINT "FK_post_topics_post"`);
    await queryRunner.query(`DROP TABLE "post_topics"`);
    await queryRunner.query(
      `ALTER TABLE "user_followed_topics" DROP CONSTRAINT "FK_user_followed_topics_topic"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_followed_topics" DROP CONSTRAINT "FK_user_followed_topics_user"`,
    );
    await queryRunner.query(`DROP TABLE "user_followed_topics"`);
    await queryRunner.query(`DROP TABLE "topics"`);
  }
}
