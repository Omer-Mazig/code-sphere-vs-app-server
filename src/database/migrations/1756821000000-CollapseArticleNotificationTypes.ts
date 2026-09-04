import { MigrationInterface, QueryRunner } from 'typeorm';

export class CollapseArticleNotificationTypes1756821000000
  implements MigrationInterface
{
  name = 'CollapseArticleNotificationTypes1756821000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_notifications_unread_collapse"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_notifications_unread_collapse"
      ON "notifications" ("userId", "type", "targetType", "targetId")
      WHERE "isRead" = false
        AND "type" IN ('POST_LIKED', 'POST_COMMENTED', 'ARTICLE_LIKED', 'ARTICLE_COMMENTED', 'NEW_FOLLOWER')
        AND "targetId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_notifications_unread_collapse"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_notifications_unread_collapse"
      ON "notifications" ("userId", "type", "targetType", "targetId")
      WHERE "isRead" = false
        AND "type" IN ('POST_LIKED', 'POST_COMMENTED', 'NEW_FOLLOWER')
        AND "targetId" IS NOT NULL
    `);
  }
}
