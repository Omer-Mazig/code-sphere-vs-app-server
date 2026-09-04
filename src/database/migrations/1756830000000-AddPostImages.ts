import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostImages1756830000000 implements MigrationInterface {
  name = 'AddPostImages1756830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."posts_imageLayout_enum" AS ENUM('GALLERY', 'CAROUSEL')`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD "imageLayout" "public"."posts_imageLayout_enum" NOT NULL DEFAULT 'GALLERY'`,
    );
    await queryRunner.query(`
      CREATE TABLE "post_images" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "postId" uuid NOT NULL,
        "mediaId" uuid NOT NULL,
        "position" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_images" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_post_images_post_position" UNIQUE ("postId", "position"),
        CONSTRAINT "UQ_post_images_post_media" UNIQUE ("postId", "mediaId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "post_images"
      ADD CONSTRAINT "FK_post_images_post"
      FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "post_images"
      ADD CONSTRAINT "FK_post_images_media"
      FOREIGN KEY ("mediaId") REFERENCES "media_objects"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "post_images"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "imageLayout"`);
    await queryRunner.query(`DROP TYPE "public"."posts_imageLayout_enum"`);
  }
}
