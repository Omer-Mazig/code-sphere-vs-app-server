import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArticleNotificationTypes1756820000000
  implements MigrationInterface
{
  name = 'AddArticleNotificationTypes1756820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE 'ARTICLE_LIKED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE 'ARTICLE_COMMENTED'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL cannot remove a value from an enum type.
  }
}
