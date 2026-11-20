import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `organizations.eiin` holds the school's government code: Bangladesh's
 * EIIN (up to 10 digits) or India's UDISE+ code (11 digits).
 */
export class SchoolCodeLength1792430000000 implements MigrationInterface {
  name = 'SchoolCodeLength1792430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organizations" ALTER COLUMN "eiin" TYPE character varying(11)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organizations" ALTER COLUMN "eiin" TYPE character varying(10) USING left("eiin", 10)`,
    );
  }
}
