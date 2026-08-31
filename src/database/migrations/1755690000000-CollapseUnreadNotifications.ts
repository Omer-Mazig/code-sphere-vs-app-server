import { MigrationInterface, QueryRunner } from 'typeorm';

export class CollapseUnreadNotifications1755690000000
  implements MigrationInterface
{
  name = 'CollapseUnreadNotifications1755690000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "targetId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `UPDATE "notifications" SET "updatedAt" = "createdAt"`,
    );

    await queryRunner.query(`
      UPDATE "notifications"
      SET "targetId" = (payload->>'postId')::uuid
      WHERE "type" IN ('POST_LIKED', 'POST_COMMENTED', 'USER_MENTIONED')
        AND payload->>'postId' IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "notifications"
      SET "targetId" = (payload->>'targetId')::uuid
      WHERE "type" = 'COMMENT_REPLIED'
        AND payload->>'targetId' IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "notifications"
      SET "targetId" = "userId"
      WHERE "type" = 'NEW_FOLLOWER'
    `);

    await queryRunner.query(`
      DELETE FROM "notifications" AS older
      USING "notifications" AS newer
      WHERE older."isRead" = false
        AND newer."isRead" = false
        AND older."id" <> newer."id"
        AND older."userId" = newer."userId"
        AND older."type" = newer."type"
        AND older."targetType" = newer."targetType"
        AND older."targetId" = newer."targetId"
        AND older."type" IN ('POST_LIKED', 'POST_COMMENTED', 'NEW_FOLLOWER')
        AND older."targetId" IS NOT NULL
        AND (
          older."createdAt" < newer."createdAt"
          OR (older."createdAt" = newer."createdAt" AND older."id" < newer."id")
        )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_notifications_unread_collapse"
      ON "notifications" ("userId", "type", "targetType", "targetId")
      WHERE "isRead" = false
        AND "type" IN ('POST_LIKED', 'POST_COMMENTED', 'NEW_FOLLOWER')
        AND "targetId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_notifications_unread_collapse"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "targetId"`,
    );
  }
}
