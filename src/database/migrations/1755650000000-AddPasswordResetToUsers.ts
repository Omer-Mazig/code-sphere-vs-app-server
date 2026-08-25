import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetToUsers1755650000000
  implements MigrationInterface
{
  name = 'AddPasswordResetToUsers1755650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "passwordResetTokenHash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "passwordResetExpiresAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "passwordResetExpiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "passwordResetTokenHash"`,
    );
  }
}
