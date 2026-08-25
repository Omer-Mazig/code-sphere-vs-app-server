import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSharedPostToPosts1755660000000 implements MigrationInterface {
  name = 'AddSharedPostToPosts1755660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "posts" ADD "sharedPostId" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_posts_sharedPostId" ON "posts" ("sharedPostId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD CONSTRAINT "FK_posts_sharedPost" FOREIGN KEY ("sharedPostId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "posts" DROP CONSTRAINT "FK_posts_sharedPost"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_posts_sharedPostId"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "sharedPostId"`);
  }
}
