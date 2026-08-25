import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserMentionedNotificationType1755670000000
  implements MigrationInterface
{
  name = 'AddUserMentionedNotificationType1755670000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE 'USER_MENTIONED'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL cannot remove a value from an enum type.
  }
}
