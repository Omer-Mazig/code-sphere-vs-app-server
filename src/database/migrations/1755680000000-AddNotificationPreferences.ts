import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationPreferences1755680000000
  implements MigrationInterface
{
  name = 'AddNotificationPreferences1755680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "mentions" boolean NOT NULL DEFAULT true,
        "comments" boolean NOT NULL DEFAULT true,
        "likes" boolean NOT NULL DEFAULT true,
        "newFollowers" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_preferences_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_notification_preferences_userId"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO "notification_preferences" ("userId", "mentions", "comments", "likes", "newFollowers")
      SELECT "id", true, true, true, true FROM "users"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
  }
}
