import { MigrationInterface, QueryRunner } from 'typeorm';

export class ArticleContentMarkdown1756810000000 implements MigrationInterface {
  name = 'ArticleContentMarkdown1756810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles"
      ADD COLUMN "contentMarkdown" text
    `);

    await queryRunner.query(`
      UPDATE "articles"
      SET "contentMarkdown" = COALESCE((
        SELECT string_agg(
          CASE
            WHEN elem->>'type' = 'heading' THEN '## ' || COALESCE(elem->>'content', '')
            WHEN elem->>'type' = 'code' THEN E'\`\`\`\n' || COALESCE(elem->>'content', '') || E'\n\`\`\`'
            ELSE COALESCE(elem->>'content', '')
          END,
          E'\n\n'
          ORDER BY ord
        )
        FROM jsonb_array_elements("content") WITH ORDINALITY AS t(elem, ord)
      ), '')
      WHERE jsonb_typeof("content") = 'array'
    `);

    await queryRunner.query(`
      UPDATE "articles"
      SET "contentMarkdown" = "content"#>>'{}'
      WHERE "contentMarkdown" IS NULL
        AND jsonb_typeof("content") = 'string'
    `);

    await queryRunner.query(`
      UPDATE "articles"
      SET "contentMarkdown" = COALESCE("content"::text, '')
      WHERE "contentMarkdown" IS NULL
    `);

    await queryRunner.query(`ALTER TABLE "articles" DROP COLUMN "content"`);
    await queryRunner.query(
      `ALTER TABLE "articles" RENAME COLUMN "contentMarkdown" TO "content"`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" ALTER COLUMN "content" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles"
      ADD COLUMN "contentBlocks" jsonb
    `);

    await queryRunner.query(`
      UPDATE "articles"
      SET "contentBlocks" = jsonb_build_array(
        jsonb_build_object('type', 'paragraph', 'content', "content")
      )
    `);

    await queryRunner.query(`ALTER TABLE "articles" DROP COLUMN "content"`);
    await queryRunner.query(
      `ALTER TABLE "articles" RENAME COLUMN "contentBlocks" TO "content"`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" ALTER COLUMN "content" SET NOT NULL`,
    );
  }
}
