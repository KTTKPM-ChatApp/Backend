import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMessageReactions1710000000004 implements MigrationInterface {
  name = 'CreateMessageReactions1710000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "message_reactions" (
        "message_id" uuid NOT NULL,
        "user_id" varchar(128) NOT NULL,
        "reaction" varchar(32) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_reactions" PRIMARY KEY ("message_id", "user_id"),
        CONSTRAINT "FK_message_reactions_message_id" 
          FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE
      )
    `);

    // Index để tìm reactions theo message
    await queryRunner.query(`
      CREATE INDEX "IDX_message_reactions_message_id" ON "message_reactions" ("message_id")
    `);

    // Index để tìm reactions theo user
    await queryRunner.query(`
      CREATE INDEX "IDX_message_reactions_user_id" ON "message_reactions" ("user_id")
    `);

    // Unique constraint để mỗi user chỉ có 1 reaction trên mỗi message
    // (Nếu user reaction lại, sẽ update thay vì insert mới)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_message_reactions_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_message_reactions_message_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "message_reactions"`);
  }
}
