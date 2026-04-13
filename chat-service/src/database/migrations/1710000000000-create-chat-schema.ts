import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatSchema1710000000000 implements MigrationInterface {
  name = 'CreateChatSchema1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid NOT NULL,
        "type" varchar(16) NOT NULL,
        "title" varchar(255),
        "created_by" varchar(128) NOT NULL,
        "direct_key" varchar(255),
        "last_message_id" uuid,
        "last_message_preview" text,
        "last_message_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversations_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_conversations_direct_key" ON "conversations" ("direct_key")
      WHERE "direct_key" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE TABLE "conversation_members" (
        "conversation_id" uuid NOT NULL,
        "user_id" varchar(128) NOT NULL,
        "joined_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversation_members" PRIMARY KEY ("conversation_id", "user_id"),
        CONSTRAINT "FK_conversation_members_conversation_id" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_conversation_members_user_conversation" ON "conversation_members" ("user_id", "conversation_id")
    `);
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL,
        "conversation_id" uuid NOT NULL,
        "sender_id" varchar(128) NOT NULL,
        "content_type" varchar(32) NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_messages_conversation_id" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_messages_conversation_created_at_id" ON "messages" ("conversation_id", "created_at" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      CREATE TABLE "outbox_events" (
        "id" uuid NOT NULL,
        "event_type" varchar(128) NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "payload" jsonb NOT NULL,
        "status" varchar(32) NOT NULL,
        "occurred_at" timestamptz NOT NULL,
        "published_at" timestamptz,
        "retry_count" integer NOT NULL DEFAULT 0,
        "error_message" text,
        CONSTRAINT "PK_outbox_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_outbox_events_status_occurred_at" ON "outbox_events" ("status", "occurred_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_outbox_events_status_occurred_at"`);
    await queryRunner.query(`DROP TABLE "outbox_events"`);
    await queryRunner.query(`DROP INDEX "IDX_messages_conversation_created_at_id"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP INDEX "IDX_conversation_members_user_conversation"`);
    await queryRunner.query(`DROP TABLE "conversation_members"`);
    await queryRunner.query(`DROP INDEX "IDX_conversations_direct_key"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
  }
}
