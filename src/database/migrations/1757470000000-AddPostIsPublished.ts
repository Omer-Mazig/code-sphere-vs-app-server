import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostIsPublished1757470000000 implements MigrationInterface {
  name = 'AddPostIsPublished1757470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "posts" ADD "isPublished" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "isPublished"`);
  }
}
