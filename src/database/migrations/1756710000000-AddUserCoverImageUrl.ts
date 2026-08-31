import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserCoverImageUrl1756710000000 implements MigrationInterface {
  name = 'AddUserCoverImageUrl1756710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "coverImageUrl" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "coverImageUrl"`);
  }
}
