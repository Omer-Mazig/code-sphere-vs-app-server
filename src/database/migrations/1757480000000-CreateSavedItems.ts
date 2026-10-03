import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSavedItems1757480000000 implements MigrationInterface {
  name = 'CreateSavedItems1757480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."saved_items_targettype_enum" AS ENUM('POST', 'ARTICLE', 'EVENT')`,
    );
    await queryRunner.query(`
      CREATE TABLE "saved_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "targetId" uuid NOT NULL,
        "targetType" "public"."saved_items_targettype_enum" NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_saved_items_user_target" UNIQUE ("userId", "targetId", "targetType")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "saved_items"
      ADD CONSTRAINT "FK_saved_items_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "saved_items"`);
    await queryRunner.query(`DROP TYPE "public"."saved_items_targettype_enum"`);
  }
}
