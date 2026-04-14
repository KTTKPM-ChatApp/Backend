import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterConversationMembers1710000000003 implements MigrationInterface {
  name = 'AlterConversationMembers1710000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "conversation_members" 
      ADD COLUMN IF NOT EXISTS "role" varchar(16) NOT NULL DEFAULT 'member',
      ADD COLUMN IF NOT EXISTS "left_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "last_read_message_id" uuid,
      ADD COLUMN IF NOT EXISTS "is_muted" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "muted_until" timestamptz
    `);

    // Foreign key cho last_read_message_id
    await queryRunner.query(`
      ALTER TABLE "conversation_members" 
      ADD CONSTRAINT "FK_conversation_members_last_read_message_id" 
      FOREIGN KEY ("last_read_message_id") REFERENCES "messages"("id") ON DELETE SET NULL
    `);

    // Index cho role (để filter admin/member nhanh)
    await queryRunner.query(`
      CREATE INDEX "IDX_conversation_members_role" ON "conversation_members" ("role")
    `);

    // Index cho left_at (để lọc member chưa rời group)
    await queryRunner.query(`
      CREATE INDEX "IDX_conversation_members_left_at" ON "conversation_members" ("left_at") 
      WHERE "left_at" IS NULL
    `);

    // Index cho is_muted (cho Notification Service)
    await queryRunner.query(`
      CREATE INDEX "IDX_conversation_members_is_muted" ON "conversation_members" ("is_muted")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conversation_members_is_muted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conversation_members_left_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conversation_members_role"`);
    await queryRunner.query(`ALTER TABLE "conversation_members" DROP CONSTRAINT IF EXISTS "FK_conversation_members_last_read_message_id"`);
    await queryRunner.query(`
      ALTER TABLE "conversation_members" 
      DROP COLUMN IF EXISTS "muted_until",
      DROP COLUMN IF EXISTS "is_muted",
      DROP COLUMN IF EXISTS "last_read_message_id",
      DROP COLUMN IF EXISTS "left_at",
      DROP COLUMN IF EXISTS "role"
    `);
  }
}
