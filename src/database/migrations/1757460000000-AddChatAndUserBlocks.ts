import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatAndUserBlocks1757460000000 implements MigrationInterface {
  name = 'AddChatAndUserBlocks1757460000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userLowId" uuid NOT NULL,
        "userHighId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_conversations_user_pair" UNIQUE ("userLowId", "userHighId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD CONSTRAINT "FK_conversations_user_low"
      FOREIGN KEY ("userLowId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD CONSTRAINT "FK_conversations_user_high"
      FOREIGN KEY ("userHighId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE TABLE "conversation_participants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "lastReadAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversation_participants" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_conversation_participants_pair" UNIQUE ("conversationId", "userId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "conversation_participants"
      ADD CONSTRAINT "FK_conversation_participants_conversation"
      FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "conversation_participants"
      ADD CONSTRAINT "FK_conversation_participants_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "senderId" uuid NOT NULL,
        "body" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_messages" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_chat_messages_conversation_created" ON "chat_messages" ("conversationId", "createdAt")`,
    );
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      ADD CONSTRAINT "FK_chat_messages_conversation"
      FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
      ADD CONSTRAINT "FK_chat_messages_sender"
      FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE TABLE "user_blocks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "blockerId" uuid NOT NULL,
        "blockedId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_blocks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_blocks_pair" UNIQUE ("blockerId", "blockedId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "user_blocks"
      ADD CONSTRAINT "FK_user_blocks_blocker"
      FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "user_blocks"
      ADD CONSTRAINT "FK_user_blocks_blocked"
      FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_blocks"`);
    await queryRunner.query(`DROP TABLE "chat_messages"`);
    await queryRunner.query(`DROP TABLE "conversation_participants"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
  }
}
