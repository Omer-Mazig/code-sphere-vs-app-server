import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMediaObjects1756700000000 implements MigrationInterface {
  name = 'CreateMediaObjects1756700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "media_objects" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "storageKey" character varying NOT NULL,
        "mimeType" character varying NOT NULL,
        "byteSize" integer NOT NULL,
        "uploaderId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_media_objects" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_media_objects_storageKey" UNIQUE ("storageKey"),
        CONSTRAINT "FK_media_objects_uploaderId"
          FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "media_objects"`);
  }
}
