import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationToUsers1755640000000 implements MigrationInterface {
  name = 'AddEmailVerificationToUsers1755640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "emailVerified" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "emailVerified" SET DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "emailVerificationTokenHash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "emailVerificationExpiresAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "emailVerificationExpiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "emailVerificationTokenHash"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerified"`);
  }
}
