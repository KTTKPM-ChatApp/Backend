import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMessageReadReceipts1710000000002 implements MigrationInterface {
  name = 'CreateMessageReadReceipts1710000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "message_read_receipts" (
        "message_id" uuid NOT NULL,
        "user_id" varchar(128) NOT NULL,
        "read_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_read_receipts" PRIMARY KEY ("message_id", "user_id"),
        CONSTRAINT "FK_message_read_receipts_message_id" 
          FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE
      )
    `);

    // Index để tìm nhanh receipts theo message
    await queryRunner.query(`
      CREATE INDEX "IDX_message_read_receipts_message_id" ON "message_read_receipts" ("message_id")
    `);

    // Index để tìm nhanh receipts theo user
    await queryRunner.query(`
      CREATE INDEX "IDX_message_read_receipts_user_id" ON "message_read_receipts" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_message_read_receipts_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_message_read_receipts_message_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "message_read_receipts"`);
  }
}
