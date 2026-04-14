import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterMessagesAddReplyAndMetadata1710000000001 implements MigrationInterface {
  name = 'AlterMessagesAddReplyAndMetadata1710000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Thêm các cột mới vào bảng messages
    await queryRunner.query(`
      ALTER TABLE "messages" 
      ADD COLUMN IF NOT EXISTS "reply_to_message_id" uuid,
      ADD COLUMN IF NOT EXISTS "is_deleted" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "edited_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "metadata" jsonb
    `);

    // Thêm foreign key cho reply_to_message_id
    await queryRunner.query(`
      ALTER TABLE "messages" 
      ADD CONSTRAINT "FK_messages_reply_to_message_id" 
      FOREIGN KEY ("reply_to_message_id") REFERENCES "messages"("id") ON DELETE SET NULL
    `);

    // Tạo index cho reply_to_message_id
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_messages_reply_to" ON "messages" ("reply_to_message_id")
    `);

    // Tạo index cho is_deleted để filter nhanh
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_messages_is_deleted" ON "messages" ("is_deleted")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_is_deleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_reply_to"`);
    await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "FK_messages_reply_to_message_id"`);
    await queryRunner.query(`
      ALTER TABLE "messages" 
      DROP COLUMN IF EXISTS "metadata",
      DROP COLUMN IF EXISTS "edited_at",
      DROP COLUMN IF EXISTS "deleted_at",
      DROP COLUMN IF EXISTS "is_deleted",
      DROP COLUMN IF EXISTS "reply_to_message_id"
    `);
  }
}
